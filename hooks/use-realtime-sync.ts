/**
 * Realtime Sync Hook
 * 
 * Subscribes to Supabase Realtime changes and invalidates
 * TanStack Query cache when data changes on the server.
 * 
 * This enables instant sync across devices without manual refresh.
 */

import { useEffect, useRef } from 'react';
import { AppState, AppStateStatus } from 'react-native';
import { RealtimeChannel } from '@supabase/supabase-js';

import { useAuth } from '@/contexts/auth-context';
import { queryClient, queryKeys } from '@/lib/query-client';
import { supabase } from '@/lib/supabase';

type TableName = 'expenses' | 'expense_splits' | 'settlements' | 'groups' | 'group_members';

interface RealtimePayload {
  schema: string;
  table: TableName;
  commit_timestamp: string;
  eventType: 'INSERT' | 'UPDATE' | 'DELETE';
  new: Record<string, unknown>;
  old: Record<string, unknown>;
}

/**
 * Handles cache invalidation based on which table changed
 */
function handleTableChange(table: TableName, payload: RealtimePayload) {
  console.log(`[Realtime] ${payload.eventType} on ${table}`, payload.new?.id || payload.old?.id);

  switch (table) {
    case 'expenses':
    case 'expense_splits':
      // Invalidate expense-related queries
      queryClient.invalidateQueries({ queryKey: queryKeys.recentActivity });
      queryClient.invalidateQueries({ queryKey: queryKeys.friends });
      queryClient.invalidateQueries({ queryKey: queryKeys.groups });
      
      // If we have the group_id, invalidate that specific group
      const groupId = (payload.new?.group_id || payload.old?.group_id) as string;
      if (groupId) {
        queryClient.invalidateQueries({ queryKey: queryKeys.group(groupId) });
        queryClient.invalidateQueries({ queryKey: queryKeys.expenses(groupId) });
      }
      break;

    case 'settlements':
      queryClient.invalidateQueries({ queryKey: queryKeys.recentActivity });
      queryClient.invalidateQueries({ queryKey: queryKeys.friends });
      queryClient.invalidateQueries({ queryKey: queryKeys.groups });
      
      const settlementGroupId = (payload.new?.group_id || payload.old?.group_id) as string;
      if (settlementGroupId) {
        queryClient.invalidateQueries({ queryKey: queryKeys.group(settlementGroupId) });
        queryClient.invalidateQueries({ queryKey: queryKeys.settlements({ groupId: settlementGroupId }) });
      }
      break;

    case 'groups':
      queryClient.invalidateQueries({ queryKey: queryKeys.groups });
      
      const changedGroupId = (payload.new?.id || payload.old?.id) as string;
      if (changedGroupId) {
        queryClient.invalidateQueries({ queryKey: queryKeys.group(changedGroupId) });
      }
      break;

    case 'group_members':
      queryClient.invalidateQueries({ queryKey: queryKeys.groups });
      queryClient.invalidateQueries({ queryKey: queryKeys.friends });
      
      const memberGroupId = (payload.new?.group_id || payload.old?.group_id) as string;
      if (memberGroupId) {
        queryClient.invalidateQueries({ queryKey: queryKeys.group(memberGroupId) });
      }
      break;
  }
}

/**
 * Hook to subscribe to Supabase Realtime changes
 * 
 * Call this once at the app root level (e.g., in _layout.tsx)
 */
export function useRealtimeSync() {
  const { user } = useAuth();
  const channelRef = useRef<RealtimeChannel | null>(null);
  const appStateRef = useRef<AppStateStatus>(AppState.currentState);

  useEffect(() => {
    if (!user) {
      // Clean up if user logs out
      if (channelRef.current) {
        console.log('[Realtime] Cleaning up - user logged out');
        supabase.removeChannel(channelRef.current);
        channelRef.current = null;
      }
      return;
    }

    // Create realtime channel
    const channel = supabase
      .channel('db-changes')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'expenses' },
        (payload) => handleTableChange('expenses', payload as unknown as RealtimePayload)
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'expense_splits' },
        (payload) => handleTableChange('expense_splits', payload as unknown as RealtimePayload)
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'settlements' },
        (payload) => handleTableChange('settlements', payload as unknown as RealtimePayload)
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'groups' },
        (payload) => handleTableChange('groups', payload as unknown as RealtimePayload)
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'group_members' },
        (payload) => handleTableChange('group_members', payload as unknown as RealtimePayload)
      )
      .subscribe((status) => {
        console.log('[Realtime] Subscription status:', status);
      });

    channelRef.current = channel;

    // Handle app state changes - reconnect when app comes to foreground
    const handleAppStateChange = (nextState: AppStateStatus) => {
      if (appStateRef.current.match(/inactive|background/) && nextState === 'active') {
        console.log('[Realtime] App returned to foreground, refreshing data');
        // Invalidate all queries to get fresh data
        queryClient.invalidateQueries();
      }
      appStateRef.current = nextState;
    };

    const subscription = AppState.addEventListener('change', handleAppStateChange);

    // Cleanup
    return () => {
      console.log('[Realtime] Cleaning up subscription');
      subscription.remove();
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
        channelRef.current = null;
      }
    };
  }, [user]);
}

/**
 * Friends Hook
 * 
 * Calculates balances with all users across all groups.
 */

import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/auth-context';
import { useSync } from '@/contexts/sync-context';
import type { Friend, CurrencyCode, UserSummary } from '@/types';

interface UseFriendsResult {
  friends: Friend[];
  isLoading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
}

export function useFriends(): UseFriendsResult {
  const { user } = useAuth();
  const { isOnline } = useSync();
  
  const [friends, setFriends] = useState<Friend[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchFriends = useCallback(async () => {
    if (!user) {
      setFriends([]);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      if (!isOnline) {
        // TODO: Load from cache
        setIsLoading(false);
        return;
      }

      // Get all groups user is member of
      const { data: memberData } = await supabase
        .from('group_members')
        .select('group_id')
        .eq('user_id', user.id);

      if (!memberData || memberData.length === 0) {
        setFriends([]);
        setIsLoading(false);
        return;
      }

      const allGroupIds = memberData.map((m) => m.group_id);

      // Filter out deleted groups and get group types
      const { data: activeGroups } = await supabase
        .from('groups')
        .select('id, type')
        .in('id', allGroupIds)
        .is('deleted_at', null);

      const groupIds = activeGroups?.map((g) => g.id) || [];
      
      // Create a map of group types for later use
      const groupTypeMap = new Map<string, string>();
      activeGroups?.forEach((g) => {
        groupTypeMap.set(g.id, g.type || 'group');
      });

      if (groupIds.length === 0) {
        setFriends([]);
        setIsLoading(false);
        return;
      }

      // Get all other members in these active groups
      const { data: otherMembers } = await supabase
        .from('group_members')
        .select(`
          user_id,
          group_id,
          users:user_id (id, name, phone, avatar_url)
        `)
        .in('group_id', groupIds)
        .neq('user_id', user.id);

      if (!otherMembers || otherMembers.length === 0) {
        setFriends([]);
        setIsLoading(false);
        return;
      }

      // Unique users
      const userMap = new Map<string, { user: UserSummary; groupIds: string[] }>();
      otherMembers.forEach((m) => {
        const existing = userMap.get(m.user_id);
        if (existing) {
          existing.groupIds.push(m.group_id);
        } else {
          userMap.set(m.user_id, {
            user: m.users as unknown as UserSummary,
            groupIds: [m.group_id],
          });
        }
      });

      // Calculate balance with each user using database function
      const friendsData: Friend[] = [];
      
      for (const [friendId, data] of userMap.entries()) {
        const { data: balance } = await supabase.rpc('calculate_balance_between_users', {
          user1_id: user.id,
          user2_id: friendId,
        });

        // Get last activity (most recent expense or settlement involving both)
        const { data: lastExpense } = await supabase
          .from('expenses')
          .select('created_at')
          .in('group_id', data.groupIds)
          .or(`paid_by.eq.${friendId},paid_by.eq.${user.id}`)
          .order('created_at', { ascending: false })
          .limit(1)
          .single();

        // Count only non-direct (regular) groups for "shared groups" display
        // Direct (1:1) groups should not be counted
        const regularGroupsCount = data.groupIds.filter(
          (gid) => groupTypeMap.get(gid) !== 'direct'
        ).length;

        friendsData.push({
          user: data.user,
          total_balance: Number(balance) || 0,
          primary_currency: 'INR' as CurrencyCode, // TODO: Calculate most common currency
          shared_groups: regularGroupsCount,
          last_activity: lastExpense?.created_at || null,
        });
      }

      // Sort by absolute balance (highest first)
      friendsData.sort((a, b) => Math.abs(b.total_balance) - Math.abs(a.total_balance));

      setFriends(friendsData);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to fetch friends';
      setError(message);
      console.error('[useFriends] Error:', err);
    } finally {
      setIsLoading(false);
    }
  }, [user, isOnline]);

  useEffect(() => {
    fetchFriends();
  }, [fetchFriends]);

  return {
    friends,
    isLoading,
    error,
    refresh: fetchFriends,
  };
}

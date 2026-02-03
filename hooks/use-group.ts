/**
 * Single Group Hook
 * 
 * Fetches detailed information about a specific group.
 * Uses TanStack Query for caching and deduplication.
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/contexts/auth-context';
import { useSync } from '@/contexts/sync-context';
import { supabase } from '@/lib/supabase';
import { syncQueue } from '@/lib/sync-queue';
import { queryKeys } from '@/lib/query-client';
import { cache } from '@/lib/storage';
import type {
  DbGroup,
  DbGroupUpdate,
  GroupMember,
  GroupMemberBalance,
  UserSummary,
} from '@/types';
import { useState } from 'react';

export interface GroupDetail extends DbGroup {
  members: GroupMember[];
  balances: GroupMemberBalance[];
}

async function fetchGroupData(groupId: string, userId: string): Promise<GroupDetail | null> {
  // Fetch group details
  const { data: groupData, error: groupError } = await supabase
    .from('groups')
    .select('*')
    .eq('id', groupId)
    .single();

  if (groupError) throw groupError;

  // Fetch members with user details
  const { data: membersData, error: membersError } = await supabase
    .from('group_members')
    .select(`
      id,
      user_id,
      role,
      joined_at,
      users:user_id (id, name, phone, avatar_url)
    `)
    .eq('group_id', groupId);

  if (membersError) throw membersError;

  const members: GroupMember[] = (membersData || []).map((m) => ({
    id: m.id,
    user_id: m.user_id,
    role: m.role,
    joined_at: m.joined_at,
    user: m.users as unknown as UserSummary,
  }));

  // Fetch balances
  const { data: balancesData, error: balancesError } = await supabase
    .from('group_balances')
    .select('*')
    .eq('group_id', groupId);

  if (balancesError) throw balancesError;

  const balances: GroupMemberBalance[] = (balancesData || []).map((b) => {
    const member = members.find((m) => m.user_id === b.user_id);
    return {
      user: member?.user || { id: b.user_id, name: b.user_name, phone: '', avatar_url: null },
      total_paid: Number(b.total_paid),
      total_owed: Number(b.total_owed),
      total_settled_paid: Number(b.total_settled_paid),
      total_settled_received: Number(b.total_settled_received),
      net_balance: (Number(b.total_paid) - Number(b.total_owed)) -
        (Number(b.total_settled_paid) - Number(b.total_settled_received)),
    };
  });

  const result: GroupDetail = {
    ...groupData,
    members,
    balances,
  };

  // Cache the result for offline access
  await cache.setGroupDetail(groupId, result);

  return result;
}

interface UseGroupResult {
  group: GroupDetail | null;
  isLoading: boolean;
  error: string | null;
  updateGroup: (updates: DbGroupUpdate) => Promise<boolean>;
  addMember: (phone: string, name: string) => Promise<boolean>;
  removeMember: (userId: string) => Promise<boolean>;
  leaveGroup: () => Promise<boolean>;
  deleteGroup: () => Promise<boolean>;
  restoreGroup: () => Promise<boolean>;
  refresh: () => Promise<void>;
}

export function useGroup(groupId: string | undefined): UseGroupResult {
  const { user } = useAuth();
  const { isOnline } = useSync();
  const queryClient = useQueryClient();
  const [mutationError, setMutationError] = useState<string | null>(null);

  // Query for fetching group data
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: queryKeys.group(groupId || ''),
    queryFn: async () => {
      // Return cached data when offline
      if (!isOnline) {
        return cache.getGroupDetail<GroupDetail>(groupId!);
      }
      
      // Online: try to fetch, but catch network errors gracefully
      try {
        return await fetchGroupData(groupId!, user!.id);
      } catch (err) {
        // If network error and we have cache, return cache instead
        const cached = await cache.getGroupDetail<GroupDetail>(groupId!);
        if (cached) {
          console.log('[useGroup] Network error, using cached data');
          return cached;
        }
        throw err; // Re-throw if no cache available
      }
    },
    enabled: !!groupId && !!user, // Allow query to run offline (will use cache)
    staleTime: 2 * 60 * 1000, // 2 minutes for group details
    refetchOnMount: isOnline ? 'always' : false, // Only refetch when online
  });

  // Helper to invalidate related queries
  const invalidateQueries = () => {
    queryClient.invalidateQueries({ queryKey: queryKeys.group(groupId || '') });
    queryClient.invalidateQueries({ queryKey: queryKeys.groups });
    queryClient.invalidateQueries({ queryKey: queryKeys.friends });
  };

  // Update group mutation
  const updateGroupMutation = useMutation({
    mutationFn: async (updates: DbGroupUpdate) => {
      if (!groupId) throw new Error('No group ID');
      
      if (isOnline) {
        const { error: updateError } = await supabase
          .from('groups')
          .update(updates)
          .eq('id', groupId);

        if (updateError) throw updateError;
      } else {
        await syncQueue.add('UPDATE_GROUP', { id: groupId, ...updates });
      }
    },
    onSuccess: invalidateQueries,
    onError: (err) => {
      setMutationError(err instanceof Error ? err.message : 'Failed to update group');
    },
  });

  // Add member mutation
  const addMemberMutation = useMutation({
    mutationFn: async ({ phone, name }: { phone: string; name: string }) => {
      if (!groupId) throw new Error('No group ID');

      // Block offline - screens should prevent this, but guard here too
      if (!isOnline) {
        throw new Error('Adding members requires an internet connection');
      }

      let userId: string;

      const { data: userData } = await supabase
        .from('users')
        .select('id')
        .eq('phone', phone)
        .single();

      if (userData) {
        userId = userData.id;
      } else {
        const { data: shadowUser, error: shadowError } = await supabase
          .from('users')
          .insert({ phone, name, is_registered: false })
          .select('id')
          .single();

        if (shadowError) throw shadowError;
        userId = shadowUser.id;
      }

      const { error: addError } = await supabase
        .from('group_members')
        .insert({ group_id: groupId, user_id: userId, role: 'member' });

      if (addError) throw addError;
    },
    onSuccess: invalidateQueries,
    onError: (err) => {
      setMutationError(err instanceof Error ? err.message : 'Failed to add member');
    },
  });

  // Remove member mutation
  const removeMemberMutation = useMutation({
    mutationFn: async (userId: string) => {
      if (!groupId) throw new Error('No group ID');

      // Block offline - screens should prevent this, but guard here too
      if (!isOnline) {
        throw new Error('Leaving groups requires an internet connection');
      }

      const { error: removeError } = await supabase
        .from('group_members')
        .delete()
        .eq('group_id', groupId)
        .eq('user_id', userId);

      if (removeError) throw removeError;
    },
    onSuccess: invalidateQueries,
    onError: (err) => {
      setMutationError(err instanceof Error ? err.message : 'Failed to remove member');
    },
  });

  // Delete group mutation (soft delete)
  const deleteGroupMutation = useMutation({
    mutationFn: async () => {
      if (!groupId) throw new Error('No group ID');

      // Block offline - screens should prevent this, but guard here too
      if (!isOnline) {
        throw new Error('Deleting groups requires an internet connection');
      }

      const { error: deleteError } = await supabase
        .rpc('soft_delete_group', { p_group_id: groupId });

      if (deleteError) throw deleteError;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.groups });
      queryClient.invalidateQueries({ queryKey: queryKeys.friends });
      // Remove the specific group from cache
      queryClient.removeQueries({ queryKey: queryKeys.group(groupId || '') });
    },
    onError: (err) => {
      setMutationError(err instanceof Error ? err.message : 'Failed to delete group');
    },
  });

  // Restore group mutation
  const restoreGroupMutation = useMutation({
    mutationFn: async () => {
      if (!groupId) throw new Error('No group ID');

      if (isOnline) {
        const { error: restoreError } = await supabase
          .rpc('restore_group', { p_group_id: groupId });

        if (restoreError) throw restoreError;
      } else {
        await syncQueue.add('RESTORE_GROUP', { id: groupId });
      }
    },
    onSuccess: invalidateQueries,
    onError: (err) => {
      setMutationError(err instanceof Error ? err.message : 'Failed to restore group');
    },
  });

  // Wrapper functions
  const updateGroup = async (updates: DbGroupUpdate): Promise<boolean> => {
    setMutationError(null);
    try {
      await updateGroupMutation.mutateAsync(updates);
      return true;
    } catch {
      return false;
    }
  };

  const addMember = async (phone: string, name: string): Promise<boolean> => {
    setMutationError(null);
    try {
      await addMemberMutation.mutateAsync({ phone, name });
      return true;
    } catch {
      return false;
    }
  };

  const removeMember = async (userId: string): Promise<boolean> => {
    setMutationError(null);
    try {
      await removeMemberMutation.mutateAsync(userId);
      return true;
    } catch {
      return false;
    }
  };

  const leaveGroup = async (): Promise<boolean> => {
    if (!user) return false;
    return removeMember(user.id);
  };

  const deleteGroup = async (): Promise<boolean> => {
    setMutationError(null);
    try {
      await deleteGroupMutation.mutateAsync();
      return true;
    } catch {
      return false;
    }
  };

  const restoreGroup = async (): Promise<boolean> => {
    setMutationError(null);
    try {
      await restoreGroupMutation.mutateAsync();
      return true;
    } catch {
      return false;
    }
  };

  const refresh = async () => {
    await refetch();
  };

  return {
    group: data ?? null,
    isLoading,
    error: error ? (error instanceof Error ? error.message : 'Failed to fetch group') : mutationError,
    updateGroup,
    addMember,
    removeMember,
    leaveGroup,
    deleteGroup,
    restoreGroup,
    refresh,
  };
}

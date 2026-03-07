/**
 * Friends Hook
 * 
 * Calculates balances with all users across all groups.
 * Uses TanStack Query for caching and deduplication.
 */

import { useAuth } from '@/contexts/auth-context';
import { useSync } from '@/contexts/sync-context';
import { queryKeys } from '@/lib/query-client';
import { cache } from '@/lib/storage';
import { supabase } from '@/lib/supabase';
import type { CurrencyCode, Friend, UserSummary } from '@/types';
import { useQuery, useQueryClient } from '@tanstack/react-query';

async function fetchFriends(userId: string): Promise<Friend[]> {
  // Get all groups user is member of
  const { data: memberData } = await supabase
    .from('group_members')
    .select('group_id')
    .eq('user_id', userId);

  if (!memberData || memberData.length === 0) {
    return [];
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
    return [];
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
    .neq('user_id', userId);

  if (!otherMembers || otherMembers.length === 0) {
    return [];
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
      user1_id: userId,
      user2_id: friendId,
    });

    const totalBalance = Number(balance) || 0;

    // Skip friends with settled (zero) balance - only show those with pending balances
    if (totalBalance === 0) continue;

    // Get last activity (most recent expense or settlement involving both)
    const { data: lastExpense } = await supabase
      .from('expenses')
      .select('created_at')
      .in('group_id', data.groupIds)
      .or(`paid_by.eq.${friendId},paid_by.eq.${userId}`)
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    // Count only non-direct (regular) groups for "shared groups" display
    // Direct (1:1) groups should not be counted
    const regularGroupsCount = data.groupIds.filter(
      (gid) => groupTypeMap.get(gid) !== 'direct'
    ).length;

    // Check if a direct (1:1) group exists with this friend
    const hasDirectGroup = data.groupIds.some(
      (gid) => groupTypeMap.get(gid) === 'direct'
    );

    friendsData.push({
      user: data.user,
      total_balance: totalBalance,
      primary_currency: 'INR' as CurrencyCode, // TODO: Calculate most common currency
      shared_groups: regularGroupsCount,
      last_activity: lastExpense?.created_at || null,
      hasDirectGroup,
    });
  }

  // Sort by absolute balance (highest first)
  friendsData.sort((a, b) => Math.abs(b.total_balance) - Math.abs(a.total_balance));

  // Cache the result for offline access
  await cache.setFriends(friendsData);

  return friendsData;
}

interface UseFriendsResult {
  friends: Friend[];
  isLoading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
}

export function useFriends(): UseFriendsResult {
  const { user } = useAuth();
  const { isOnline } = useSync();
  const queryClient = useQueryClient();

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: queryKeys.friends,
    queryFn: async () => {
      // Return cached data when offline
      if (!isOnline) {
        return cache.getFriends<Friend>();
      }
      
      // Online: try to fetch, but catch network errors gracefully
      try {
        return await fetchFriends(user!.id);
      } catch (err) {
        // If network error and we have cache, return cache instead
        const cached = await cache.getFriends<Friend>();
        if (cached && cached.length > 0) {
          console.log('[useFriends] Network error, using cached data');
          return cached;
        }
        throw err; // Re-throw if no cache available
      }
    },
    enabled: !!user, // Allow query to run offline (will use cache)
    staleTime: 30 * 1000, // 30 seconds - more responsive to changes
    refetchOnMount: isOnline ? 'always' : false, // Only refetch when online
  });

  const refresh = async () => {
    await refetch();
  };

  return {
    friends: data ?? [],
    isLoading,
    error: error ? (error instanceof Error ? error.message : 'Failed to fetch friends') : null,
    refresh,
  };
}

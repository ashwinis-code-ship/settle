/**
 * Groups Hook
 * 
 * Manages list of groups the user is a member of.
 * Uses TanStack Query for caching and deduplication.
 */

import { useAuth } from '@/contexts/auth-context';
import { useSync } from '@/contexts/sync-context';
import { uploadGroupImage } from '@/lib/image-upload';
import { queryKeys } from '@/lib/query-client';
import { cache } from '@/lib/storage';
import { supabase } from '@/lib/supabase';
import { syncQueue } from '@/lib/sync-queue';
import { formatPhoneNumber } from '@/lib/utils';
import type { DbGroup, GroupFormData, GroupListItem } from '@/types';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';

async function fetchGroups(userId: string): Promise<GroupListItem[]> {
  // Get groups user is member of
  const { data: memberData, error: memberError } = await supabase
    .from('group_members')
    .select('group_id')
    .eq('user_id', userId);

  if (memberError) throw memberError;

  if (!memberData || memberData.length === 0) {
    await cache.setGroups([]);
    return [];
  }

  const groupIds = memberData.map((m) => m.group_id);

  // Fetch group details (only explicit groups, not 1:1 direct groups, exclude deleted)
  const { data: groupsData, error: groupsError } = await supabase
    .from('groups')
    .select('*')
    .in('id', groupIds)
    .eq('type', 'group') // Filter out 'direct' (1:1) groups
    .is('deleted_at', null) // Filter out soft-deleted groups
    .order('updated_at', { ascending: false });

  if (groupsError) throw groupsError;

  // Cache raw groups
  await cache.setGroups(groupsData || []);

  // Get member counts
  const { data: allMembers } = await supabase
    .from('group_members')
    .select('group_id')
    .in('group_id', groupIds);

  const memberCounts: Record<string, number> = {};
  allMembers?.forEach((m) => {
    memberCounts[m.group_id] = (memberCounts[m.group_id] || 0) + 1;
  });

  // Calculate balances using the database function
  const balancePromises = groupIds.map(async (groupId) => {
    const { data: balanceData } = await supabase
      .from('group_balances')
      .select('*')
      .eq('group_id', groupId)
      .eq('user_id', userId)
      .single();

    if (balanceData) {
      return {
        groupId,
        balance: (balanceData.total_paid - balanceData.total_owed) -
          (balanceData.total_settled_paid - balanceData.total_settled_received),
      };
    }
    return { groupId, balance: 0 };
  });

  const balances = await Promise.all(balancePromises);
  const balanceMap: Record<string, number> = {};
  balances.forEach(({ groupId, balance }) => {
    balanceMap[groupId] = balance;
  });

  // Transform to GroupListItem
  const groupsList: GroupListItem[] = (groupsData || []).map((g) => ({
    id: g.id,
    name: g.name,
    image_url: g.image_url,
    currency: g.currency,
    member_count: memberCounts[g.id] || 1,
    your_balance: balanceMap[g.id] || 0,
    last_activity: g.updated_at,
  }));

  // Cache the transformed list for offline access
  await cache.setGroupsList(groupsList);

  return groupsList;
}

interface UseGroupsResult {
  groups: GroupListItem[];
  isLoading: boolean;
  error: string | null;
  createGroup: (data: GroupFormData) => Promise<string | null>;
  refresh: () => Promise<void>;
}

export function useGroups(): UseGroupsResult {
  const { user } = useAuth();
  const { isOnline } = useSync();
  const queryClient = useQueryClient();
  const [mutationError, setMutationError] = useState<string | null>(null);

  // Query for fetching groups
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: queryKeys.groups,
    queryFn: async () => {
      if (!isOnline) {
        // First try cached transformed list (has full data with balances)
        const cachedList = await cache.getGroupsList<GroupListItem>();
        if (cachedList && cachedList.length > 0) {
          return cachedList;
        }
        // Fallback to raw groups cache (limited data)
        const cached = await cache.getGroups();
        if (cached && cached.length > 0) {
          return (cached as DbGroup[])
            .filter((g) => !(g as any).deleted_at)
            .map((g) => ({
              id: g.id,
              name: g.name,
              image_url: g.image_url,
              currency: g.currency,
              member_count: 0,
              your_balance: 0,
              last_activity: g.updated_at,
            }));
        }
        return [];
      }
      
      // Online: try to fetch, but catch network errors gracefully
      try {
        return await fetchGroups(user!.id);
      } catch (err) {
        // If network error and we have cache, return cache instead
        const cachedList = await cache.getGroupsList<GroupListItem>();
        if (cachedList && cachedList.length > 0) {
          console.log('[useGroups] Network error, using cached data');
          return cachedList;
        }
        throw err; // Re-throw if no cache available
      }
    },
    enabled: !!user,
    staleTime: 30 * 1000, // 30 seconds - more responsive to changes
    refetchOnMount: isOnline ? 'always' : false, // Only refetch when online
  });

  // Mutation for creating groups
  const createGroupMutation = useMutation({
    mutationFn: async (formData: GroupFormData): Promise<string | null> => {
      if (!user) return null;

      // Verify session is active
      const { data: { session }, error: sessionError } = await supabase.auth.getSession();
      if (sessionError || !session) {
        throw new Error('Please sign in again');
      }

      const groupData = {
        name: formData.name,
        description: formData.description || null,
        currency: formData.currency,
        created_by: user.id,
        type: 'group' as const,
      };

      if (isOnline) {
        const { data: newGroup, error: createError } = await supabase
          .from('groups')
          .insert(groupData)
          .select('id')
          .single();

        if (createError) throw createError;

        // Handle members (find existing or create shadow users)
        if (formData.members.length > 0) {
          // Normalize all phone numbers first
          const membersWithNormalizedPhone = formData.members.map(m => {
            const sanitized = formatPhoneNumber(m.phone);
            const normalizedPhone = sanitized.startsWith('+') ? sanitized : `+91${sanitized.replace(/^0/, '')}`;
            return { ...m, normalizedPhone };
          });

          const phones = membersWithNormalizedPhone.map(m => m.normalizedPhone);

          // Find existing users
          const { data: existingUsers, error: usersError } = await supabase
            .from('users')
            .select('id, phone')
            .in('phone', phones);

          if (usersError) throw usersError;

          const existingUserMap = new Map((existingUsers || []).map(u => [u.phone, u.id]));
          const memberIds: string[] = [];

          // Get current user's normalized phone
          const currentUserPhone = user.phone?.startsWith('+') ? user.phone : `+91${user.phone?.replace(/^0/, '')}`;

          // Process all members
          for (const member of membersWithNormalizedPhone) {
            // Skip creator
            if (member.normalizedPhone === currentUserPhone) continue;

            if (existingUserMap.has(member.normalizedPhone)) {
              memberIds.push(existingUserMap.get(member.normalizedPhone)!);
            } else {
              // Create shadow user with upsert to handle race conditions
              const { data: shadowUser, error: shadowError } = await supabase
                .from('users')
                .upsert({
                  phone: member.normalizedPhone,
                  name: member.name,
                  is_registered: false
                }, { onConflict: 'phone', ignoreDuplicates: false })
                .select('id')
                .single();

              if (shadowError) {
                // If upsert failed, try to fetch existing user
                const { data: existingUser } = await supabase
                  .from('users')
                  .select('id')
                  .eq('phone', member.normalizedPhone)
                  .single();
                
                if (existingUser) {
                  memberIds.push(existingUser.id);
                } else {
                  console.error('Failed to create/find user:', shadowError);
                }
                continue;
              }
              memberIds.push(shadowUser.id);
            }
          }

          // Add members to group
          if (memberIds.length > 0) {
            const memberInserts = memberIds.map(userId => ({
              group_id: newGroup.id,
              user_id: userId,
              role: 'member' as const,
            }));

            const { error: memberAddError } = await supabase
              .from('group_members')
              .insert(memberInserts);

            if (memberAddError) throw memberAddError;
          }
        }

        // Upload group image if provided
        if (formData.imageUri) {
          try {
            const uploadResult = await uploadGroupImage(formData.imageUri, newGroup.id);
            if (uploadResult.success && uploadResult.url) {
              // Update group with image URL
              await supabase
                .from('groups')
                .update({ image_url: uploadResult.url })
                .eq('id', newGroup.id);
            }
          } catch (imgErr) {
            console.error('[useGroups] Image upload failed:', imgErr);
            // Don't fail group creation if image upload fails
          }
        }

        return newGroup.id;
      } else {
        // Queue for later sync
        await syncQueue.add('CREATE_GROUP', groupData);
        return `temp_${Date.now()}`;
      }
    },
    onSuccess: () => {
      // Invalidate queries to refetch fresh data
      queryClient.invalidateQueries({ queryKey: queryKeys.groups });
      queryClient.invalidateQueries({ queryKey: queryKeys.friends });
    },
    onError: (err) => {
      setMutationError(err instanceof Error ? err.message : 'Failed to create group');
    },
  });

  const createGroup = async (data: GroupFormData): Promise<string | null> => {
    setMutationError(null);
    return createGroupMutation.mutateAsync(data);
  };

  const refresh = async () => {
    await refetch();
  };

  return {
    groups: data ?? [],
    isLoading,
    error: error ? (error instanceof Error ? error.message : 'Failed to fetch groups') : mutationError,
    createGroup,
    refresh,
  };
}

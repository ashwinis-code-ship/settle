/**
 * Groups Hook
 * 
 * Manages list of groups the user is a member of.
 * Uses TanStack Query for caching and deduplication.
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/contexts/auth-context';
import { useSync } from '@/contexts/sync-context';
import { cache } from '@/lib/storage';
import { supabase } from '@/lib/supabase';
import { syncQueue } from '@/lib/sync-queue';
import { formatPhoneNumber } from '@/lib/utils';
import { uploadGroupImage } from '@/lib/image-upload';
import { queryKeys } from '@/lib/query-client';
import type { DbGroup, GroupFormData, GroupListItem } from '@/types';
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
        // Return cached data when offline
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
      return fetchGroups(user!.id);
    },
    enabled: !!user,
    staleTime: 30 * 1000, // 30 seconds - more responsive to changes
    refetchOnMount: 'always', // Always refetch when component mounts
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
          const phones = formData.members.map(m => {
            const sanitized = formatPhoneNumber(m.phone);
            return sanitized.startsWith('+') ? sanitized : `+91${sanitized.replace(/^0/, '')}`;
          });

          // Find existing users
          const { data: existingUsers, error: usersError } = await supabase
            .from('users')
            .select('id, phone')
            .in('phone', phones);

          if (usersError) throw usersError;

          const existingUserMap = new Map((existingUsers || []).map(u => [u.phone, u.id]));
          const memberIds: string[] = [];

          // Process all members
          for (const member of formData.members) {
            if (member.phone === user.phone) continue; // Skip creator

            if (existingUserMap.has(member.phone)) {
              memberIds.push(existingUserMap.get(member.phone)!);
            } else {
              // Create shadow user
              const { data: shadowUser, error: shadowError } = await supabase
                .from('users')
                .insert({
                  phone: member.phone,
                  name: member.name,
                  is_registered: false
                })
                .select('id')
                .single();

              if (shadowError) {
                console.error('Failed to create shadow user:', shadowError);
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

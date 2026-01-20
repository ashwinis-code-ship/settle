/**
 * Groups Hook
 * 
 * Manages list of groups the user is a member of.
 */

import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { cache } from '@/lib/storage';
import { syncQueue } from '@/lib/sync-queue';
import { useAuth } from '@/contexts/auth-context';
import { useSync } from '@/contexts/sync-context';
import type { DbGroup, GroupFormData, GroupListItem, CurrencyCode } from '@/types';

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
  
  const [groups, setGroups] = useState<GroupListItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchGroups = useCallback(async () => {
    if (!user) {
      setGroups([]);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      // Try cache first
      const cached = await cache.getGroups();
      if (cached && cached.length > 0) {
        // Transform cached data to GroupListItem format
        const cachedGroups = (cached as DbGroup[]).map((g) => ({
          id: g.id,
          name: g.name,
          image_url: g.image_url,
          currency: g.currency,
          member_count: 0, // Will be updated from server
          your_balance: 0, // Will be calculated
          last_activity: g.updated_at,
        }));
        setGroups(cachedGroups);
        
        if (!isOnline) {
          setIsLoading(false);
          return;
        }
      }

      // Fetch from server if online
      if (isOnline) {
        // Get groups user is member of
        const { data: memberData, error: memberError } = await supabase
          .from('group_members')
          .select('group_id')
          .eq('user_id', user.id);

        if (memberError) throw memberError;

        if (!memberData || memberData.length === 0) {
          setGroups([]);
          await cache.setGroups([]);
          setIsLoading(false);
          return;
        }

        const groupIds = memberData.map((m) => m.group_id);

        // Fetch group details (only explicit groups, not 1:1 direct groups)
        const { data: groupsData, error: groupsError } = await supabase
          .from('groups')
          .select('*')
          .in('id', groupIds)
          .eq('type', 'group') // Filter out 'direct' (1:1) groups
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
            .eq('user_id', user.id)
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

        setGroups(groupsList);
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to fetch groups';
      setError(message);
      console.error('[useGroups] Error:', err);
    } finally {
      setIsLoading(false);
    }
  }, [user, isOnline]);

  const createGroup = useCallback(async (data: GroupFormData): Promise<string | null> => {
    if (!user) return null;

    // Verify session is active
    const { data: { session }, error: sessionError } = await supabase.auth.getSession();
    if (sessionError || !session) {
      console.error('[useGroups] No active session:', sessionError);
      setError('Please sign in again');
      return null;
    }

    if (session.user.id !== user.id) {
      console.error('[useGroups] Session user mismatch:', { sessionUserId: session.user.id, contextUserId: user.id });
      setError('Session mismatch. Please sign in again');
      return null;
    }

    const groupData = {
      name: data.name,
      description: data.description || null,
      currency: data.currency,
      created_by: user.id,
      type: 'group' as const,
    };

    try {
      if (isOnline) {
        console.log('[useGroups] Creating group with data:', { ...groupData, created_by: user.id });
        const { data: newGroup, error: createError } = await supabase
          .from('groups')
          .insert(groupData)
          .select('id')
          .single();

        if (createError) {
          console.error('[useGroups] Create error details:', {
            code: createError.code,
            message: createError.message,
            details: createError.details,
            hint: createError.hint,
          });
          throw createError;
        }

        // Note: Creator is automatically added as admin by trigger (add_creator_as_admin)
        // Add other members by phone
        if (data.member_phones.length > 0) {
          const { data: users } = await supabase
            .from('users')
            .select('id')
            .in('phone', data.member_phones);

          if (users && users.length > 0) {
            // Filter out the creator if they're somehow in the list
            const memberInserts = users
              .filter((u) => u.id !== user.id)
              .map((u) => ({
                group_id: newGroup.id,
                user_id: u.id,
                role: 'member' as const,
              }));

            if (memberInserts.length > 0) {
              await supabase.from('group_members').insert(memberInserts);
            }
          }
        }

        await fetchGroups();
        return newGroup.id;
      } else {
        // Queue for later sync
        await syncQueue.add('CREATE_GROUP', groupData);
        
        // Create temporary local group
        const tempId = `temp_${Date.now()}`;
        const tempGroup: GroupListItem = {
          id: tempId,
          name: data.name,
          image_url: null,
          currency: data.currency,
          member_count: 1,
          your_balance: 0,
          last_activity: new Date().toISOString(),
        };
        
        setGroups((prev) => [tempGroup, ...prev]);
        return tempId;
      }
    } catch (err) {
      console.error('[useGroups] createGroup error:', err);
      setError(err instanceof Error ? err.message : 'Failed to create group');
      return null;
    }
  }, [user, isOnline, fetchGroups]);

  useEffect(() => {
    fetchGroups();
  }, [fetchGroups]);

  return {
    groups,
    isLoading,
    error,
    createGroup,
    refresh: fetchGroups,
  };
}

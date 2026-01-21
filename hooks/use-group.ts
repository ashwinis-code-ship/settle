/**
 * Single Group Hook
 * 
 * Fetches detailed information about a specific group.
 */

import { useAuth } from '@/contexts/auth-context';
import { useSync } from '@/contexts/sync-context';
import { supabase } from '@/lib/supabase';
import { syncQueue } from '@/lib/sync-queue';
import type {
  DbGroup,
  DbGroupUpdate,
  GroupMember,
  GroupMemberBalance,
  UserSummary,
} from '@/types';
import { useCallback, useEffect, useState } from 'react';

interface GroupDetail extends DbGroup {
  members: GroupMember[];
  balances: GroupMemberBalance[];
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
  refresh: () => Promise<void>;
}

export function useGroup(groupId: string | undefined): UseGroupResult {
  const { user } = useAuth();
  const { isOnline } = useSync();

  const [group, setGroup] = useState<GroupDetail | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchGroup = useCallback(async () => {
    if (!groupId || !user) {
      setGroup(null);
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

      setGroup({
        ...groupData,
        members,
        balances,
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to fetch group';
      setError(message);
      console.error('[useGroup] Error:', err);
    } finally {
      setIsLoading(false);
    }
  }, [groupId, user, isOnline]);

  const updateGroup = useCallback(async (updates: DbGroupUpdate): Promise<boolean> => {
    if (!groupId || !group) return false;

    const previousGroup = group;
    setGroup({ ...group, ...updates, updated_at: new Date().toISOString() });

    try {
      if (isOnline) {
        const { error: updateError } = await supabase
          .from('groups')
          .update(updates)
          .eq('id', groupId);

        if (updateError) throw updateError;
        await fetchGroup();
      } else {
        await syncQueue.add('UPDATE_GROUP', { id: groupId, ...updates });
      }
      return true;
    } catch (err) {
      setGroup(previousGroup);
      setError(err instanceof Error ? err.message : 'Failed to update group');
      return false;
    }
  }, [groupId, group, isOnline, fetchGroup]);

  const addMember = useCallback(async (phone: string, name: string): Promise<boolean> => {
    if (!groupId) return false;

    try {
      if (isOnline) {
        // Find user by phone
        let userId: string;

        const { data: userData, error: userError } = await supabase
          .from('users')
          .select('id')
          .eq('phone', phone)
          .single();

        if (userData) {
          userId = userData.id;
        } else {
          // User not found, create shadow user
          // Migration sets default UUID
          const { data: shadowUser, error: shadowError } = await supabase
            .from('users')
            .insert({
              phone,
              name,
              is_registered: false
            })
            .select('id')
            .single();

          if (shadowError) throw shadowError;
          userId = shadowUser.id;
        }

        const { error: addError } = await supabase
          .from('group_members')
          .insert({
            group_id: groupId,
            user_id: userId,
            role: 'member',
          });

        if (addError) throw addError;
        await fetchGroup();
      } else {
        await syncQueue.add('ADD_GROUP_MEMBER', { group_id: groupId, phone, name });
      }
      return true;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to add member');
      return false;
    }
  }, [groupId, isOnline, fetchGroup]);

  const removeMember = useCallback(async (userId: string): Promise<boolean> => {
    if (!groupId) return false;

    try {
      if (isOnline) {
        const { error: removeError } = await supabase
          .from('group_members')
          .delete()
          .eq('group_id', groupId)
          .eq('user_id', userId);

        if (removeError) throw removeError;
        await fetchGroup();
      } else {
        await syncQueue.add('REMOVE_GROUP_MEMBER', { group_id: groupId, user_id: userId });
      }
      return true;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to remove member');
      return false;
    }
  }, [groupId, isOnline, fetchGroup]);

  const leaveGroup = useCallback(async (): Promise<boolean> => {
    if (!user) return false;
    return removeMember(user.id);
  }, [user, removeMember]);

  const deleteGroup = useCallback(async (): Promise<boolean> => {
    if (!groupId) return false;

    try {
      if (isOnline) {
        const { error: deleteError } = await supabase
          .from('groups')
          .delete()
          .eq('id', groupId);

        if (deleteError) throw deleteError;
      } else {
        await syncQueue.add('DELETE_GROUP', { id: groupId });
      }
      setGroup(null);
      return true;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete group');
      return false;
    }
  }, [groupId, isOnline]);

  useEffect(() => {
    fetchGroup();
  }, [fetchGroup]);

  return {
    group,
    isLoading,
    error,
    updateGroup,
    addMember,
    removeMember,
    leaveGroup,
    deleteGroup,
    refresh: fetchGroup,
  };
}

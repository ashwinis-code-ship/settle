/**
 * Direct (1:1) Group Hook
 * 
 * Finds or creates a hidden 1:1 group between the current user and another user.
 * These groups are used for direct expenses between two people.
 */

import { useCallback, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/auth-context';
import { useSync } from '@/contexts/sync-context';
import type { CurrencyCode } from '@/types';

interface UseDirectGroupResult {
  /**
   * Find or create a 1:1 group with another user.
   * Returns the group ID.
   */
  findOrCreateDirectGroup: (
    otherUserId: string,
    currency?: CurrencyCode
  ) => Promise<string | null>;
  isLoading: boolean;
  error: string | null;
}

export function useDirectGroup(): UseDirectGroupResult {
  const { user } = useAuth();
  const { isOnline } = useSync();

  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const findOrCreateDirectGroup = useCallback(async (
    otherUserId: string,
    currency: CurrencyCode = 'INR'
  ): Promise<string | null> => {
    if (!user) {
      setError('Not authenticated');
      return null;
    }

    if (!isOnline) {
      setError('Cannot create direct group while offline');
      return null;
    }

    if (otherUserId === user.id) {
      setError('Cannot create a group with yourself');
      return null;
    }

    setIsLoading(true);
    setError(null);

    try {
      // Find existing direct group between these two users
      // A direct group has exactly 2 members: current user and other user
      const { data: myGroups, error: myGroupsError } = await supabase
        .from('group_members')
        .select('group_id')
        .eq('user_id', user.id);

      if (myGroupsError) throw myGroupsError;

      if (myGroups && myGroups.length > 0) {
        const myGroupIds = myGroups.map((g) => g.group_id);

        // Find direct groups I'm in
        const { data: directGroups, error: directError } = await supabase
          .from('groups')
          .select('id')
          .in('id', myGroupIds)
          .eq('type', 'direct');

        if (directError) throw directError;

        if (directGroups && directGroups.length > 0) {
          const directGroupIds = directGroups.map((g) => g.id);

          // Check if other user is in any of these direct groups
          const { data: sharedGroups, error: sharedError } = await supabase
            .from('group_members')
            .select('group_id')
            .eq('user_id', otherUserId)
            .in('group_id', directGroupIds);

          if (sharedError) throw sharedError;

          if (sharedGroups && sharedGroups.length > 0) {
            // Found existing direct group
            console.log('[useDirectGroup] Found existing direct group:', sharedGroups[0].group_id);
            return sharedGroups[0].group_id;
          }
        }
      }

      // No existing direct group found, create one
      console.log('[useDirectGroup] Creating new direct group');

      // Get other user's name for the group name
      const { data: otherUser, error: userError } = await supabase
        .from('users')
        .select('name')
        .eq('id', otherUserId)
        .single();

      if (userError) throw userError;

      // Create the direct group
      const { data: newGroup, error: createError } = await supabase
        .from('groups')
        .insert({
          name: `${otherUser.name}`, // Name it after the other person (for display)
          type: 'direct',
          currency,
          created_by: user.id,
        })
        .select('id')
        .single();

      if (createError) throw createError;

      // Add the other user as a member
      // (Current user is added automatically by the trigger)
      const { error: memberError } = await supabase
        .from('group_members')
        .insert({
          group_id: newGroup.id,
          user_id: otherUserId,
          role: 'member',
        });

      if (memberError) throw memberError;

      console.log('[useDirectGroup] Created new direct group:', newGroup.id);
      return newGroup.id;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to find or create direct group';
      setError(message);
      console.error('[useDirectGroup] Error:', err);
      return null;
    } finally {
      setIsLoading(false);
    }
  }, [user, isOnline]);

  return {
    findOrCreateDirectGroup,
    isLoading,
    error,
  };
}

/**
 * User Hook
 * 
 * Manages current user profile data with offline support.
 */

import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { cache } from '@/lib/storage';
import { syncQueue } from '@/lib/sync-queue';
import { useAuth } from '@/contexts/auth-context';
import { useSync } from '@/contexts/sync-context';
import type { DbUser, DbUserUpdate } from '@/types';

interface UseUserResult {
  user: DbUser | null;
  isLoading: boolean;
  error: string | null;
  updateUser: (updates: DbUserUpdate) => Promise<boolean>;
  refresh: () => Promise<void>;
}

export function useUser(): UseUserResult {
  const { user: authUser } = useAuth();
  const { isOnline } = useSync();
  
  const [user, setUser] = useState<DbUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchUser = useCallback(async () => {
    if (!authUser) {
      setUser(null);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      // Try cache first
      const cached = await cache.getUser();
      if (cached) {
        setUser(cached as DbUser);
      }

      // Fetch from server if online
      if (isOnline) {
        const { data, error: fetchError } = await supabase
          .from('users')
          .select('*')
          .eq('id', authUser.id)
          .single();

        if (fetchError) throw fetchError;

        if (data) {
          setUser(data);
          await cache.setUser(data);
        }
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to fetch user';
      setError(message);
      console.error('[useUser] Error:', err);
    } finally {
      setIsLoading(false);
    }
  }, [authUser, isOnline]);

  const updateUser = useCallback(async (updates: DbUserUpdate): Promise<boolean> => {
    if (!authUser || !user) return false;

    // Optimistic update
    const previousUser = user;
    setUser({ ...user, ...updates, updated_at: new Date().toISOString() });

    try {
      if (isOnline) {
        const { error: updateError } = await supabase
          .from('users')
          .update(updates)
          .eq('id', authUser.id);

        if (updateError) throw updateError;

        // Refresh to get server state
        await fetchUser();
      } else {
        // Queue for later sync
        await syncQueue.add('UPDATE_USER', { id: authUser.id, ...updates });
        // Update cache
        await cache.setUser({ ...user, ...updates });
      }
      return true;
    } catch (err) {
      // Rollback optimistic update
      setUser(previousUser);
      setError(err instanceof Error ? err.message : 'Failed to update user');
      return false;
    }
  }, [authUser, user, isOnline, fetchUser]);

  useEffect(() => {
    fetchUser();
  }, [fetchUser]);

  return {
    user,
    isLoading,
    error,
    updateUser,
    refresh: fetchUser,
  };
}

/**
 * Categories Hook
 * 
 * Fetches and caches expense categories.
 * Categories rarely change, so we cache aggressively.
 */

import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { cache } from '@/lib/storage';
import { useSync } from '@/contexts/sync-context';
import type { DbCategory } from '@/types';

interface UseCategoriesResult {
  categories: DbCategory[];
  isLoading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
  getCategoryById: (id: string) => DbCategory | undefined;
}

export function useCategories(): UseCategoriesResult {
  const { isOnline } = useSync();
  
  const [categories, setCategories] = useState<DbCategory[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchCategories = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      // Try cache first
      const cached = await cache.getCategories();
      if (cached && cached.length > 0) {
        setCategories(cached as DbCategory[]);
        setIsLoading(false);
        
        // If we have cached data and we're offline, don't try to fetch
        if (!isOnline) return;
      }

      // Fetch from server if online
      if (isOnline) {
        const { data, error: fetchError } = await supabase
          .from('categories')
          .select('*')
          .order('sort_order');

        if (fetchError) throw fetchError;

        if (data) {
          setCategories(data);
          await cache.setCategories(data);
        }
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to fetch categories';
      setError(message);
      console.error('[useCategories] Error:', err);
    } finally {
      setIsLoading(false);
    }
  }, [isOnline]);

  const getCategoryById = useCallback((id: string): DbCategory | undefined => {
    return categories.find((c) => c.id === id);
  }, [categories]);

  useEffect(() => {
    fetchCategories();
  }, [fetchCategories]);

  return {
    categories,
    isLoading,
    error,
    refresh: fetchCategories,
    getCategoryById,
  };
}

/**
 * Single Expense Hook
 * 
 * Fetches and manages a single expense with full details.
 */

import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { syncQueue } from '@/lib/sync-queue';
import { useAuth } from '@/contexts/auth-context';
import { useSync } from '@/contexts/sync-context';
import type {
  CurrencyCode,
  DbCategory,
  DbExpenseUpdate,
  Expense,
  ExpenseSplitInfo,
  UserSummary,
} from '@/types';

interface UseExpenseResult {
  expense: Expense | null;
  isLoading: boolean;
  error: string | null;
  updateExpense: (updates: DbExpenseUpdate, newSplits?: { user_id: string; amount: number }[]) => Promise<boolean>;
  deleteExpense: () => Promise<boolean>;
  refresh: () => Promise<void>;
  canEdit: boolean;
}

export function useExpense(expenseId: string | undefined): UseExpenseResult {
  const { user } = useAuth();
  const { isOnline } = useSync();

  const [expense, setExpense] = useState<Expense | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchExpense = useCallback(async () => {
    if (!expenseId || !user) {
      setExpense(null);
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

      // Fetch expense with relations
      const { data: expenseData, error: expenseError } = await supabase
        .from('expenses')
        .select(`
          *,
          paid_by_user:paid_by (id, name, phone, avatar_url),
          category:category_id (*)
        `)
        .eq('id', expenseId)
        .single();

      if (expenseError) throw expenseError;

      // Fetch splits with user details
      const { data: splitsData, error: splitsError } = await supabase
        .from('expense_splits')
        .select(`
          user_id,
          amount,
          user:user_id (id, name, phone, avatar_url)
        `)
        .eq('expense_id', expenseId);

      if (splitsError) throw splitsError;

      const splits: ExpenseSplitInfo[] = (splitsData || []).map((s) => ({
        user_id: s.user_id,
        amount: Number(s.amount),
        user: s.user as unknown as UserSummary,
      }));

      setExpense({
        ...expenseData,
        amount: Number(expenseData.amount),
        currency: expenseData.currency as CurrencyCode,
        paid_by_user: expenseData.paid_by_user as UserSummary,
        category: expenseData.category as DbCategory | null,
        splits,
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to fetch expense';
      setError(message);
      console.error('[useExpense] Error:', err);
    } finally {
      setIsLoading(false);
    }
  }, [expenseId, user, isOnline]);

  const updateExpense = useCallback(async (
    updates: DbExpenseUpdate,
    newSplits?: { user_id: string; amount: number }[]
  ): Promise<boolean> => {
    if (!expenseId || !expense) return false;

    try {
      if (isOnline) {
        // Update expense
        const { error: updateError } = await supabase
          .from('expenses')
          .update(updates)
          .eq('id', expenseId);

        if (updateError) throw updateError;

        // Update splits if provided
        if (newSplits) {
          // Delete old splits
          await supabase
            .from('expense_splits')
            .delete()
            .eq('expense_id', expenseId);

          // Insert new splits
          const splitsWithExpenseId = newSplits.map((s) => ({
            ...s,
            expense_id: expenseId,
          }));

          const { error: splitsError } = await supabase
            .from('expense_splits')
            .insert(splitsWithExpenseId);

          if (splitsError) throw splitsError;
        }

        await fetchExpense();
      } else {
        await syncQueue.add('UPDATE_EXPENSE', { id: expenseId, ...updates, splits: newSplits });
        
        // Optimistic update
        setExpense((prev) => prev ? { ...prev, ...updates } : null);
      }
      return true;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update expense');
      return false;
    }
  }, [expenseId, expense, isOnline, fetchExpense]);

  const deleteExpense = useCallback(async (): Promise<boolean> => {
    if (!expenseId) return false;

    try {
      if (isOnline) {
        const { error: deleteError } = await supabase
          .from('expenses')
          .delete()
          .eq('id', expenseId);

        if (deleteError) throw deleteError;
      } else {
        await syncQueue.add('DELETE_EXPENSE', { id: expenseId });
      }
      setExpense(null);
      return true;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete expense');
      return false;
    }
  }, [expenseId, isOnline]);

  useEffect(() => {
    fetchExpense();
  }, [fetchExpense]);

  // User can edit if they created the expense
  const canEdit = expense?.created_by === user?.id;

  return {
    expense,
    isLoading,
    error,
    updateExpense,
    deleteExpense,
    refresh: fetchExpense,
    canEdit,
  };
}

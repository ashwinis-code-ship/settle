/**
 * Single Expense Hook
 * 
 * Fetches and manages a single expense with full details.
 * Uses TanStack Query for caching and deduplication.
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { syncQueue } from '@/lib/sync-queue';
import { useAuth } from '@/contexts/auth-context';
import { useSync } from '@/contexts/sync-context';
import { queryKeys } from '@/lib/query-client';
import type {
  CurrencyCode,
  DbCategory,
  DbExpenseUpdate,
  Expense,
  ExpenseSplitInfo,
  UserSummary,
} from '@/types';
import { useState } from 'react';

async function fetchExpenseData(expenseId: string): Promise<Expense> {
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

  return {
    ...expenseData,
    amount: Number(expenseData.amount),
    currency: expenseData.currency as CurrencyCode,
    paid_by_user: expenseData.paid_by_user as UserSummary,
    category: expenseData.category as DbCategory | null,
    splits,
  };
}

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
  const queryClient = useQueryClient();
  const [mutationError, setMutationError] = useState<string | null>(null);

  // Query for fetching expense
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['expense', expenseId],
    queryFn: () => fetchExpenseData(expenseId!),
    enabled: !!expenseId && !!user && isOnline,
    staleTime: 2 * 60 * 1000, // 2 minutes
  });

  // Helper to invalidate related queries
  const invalidateQueries = (groupId?: string) => {
    queryClient.invalidateQueries({ queryKey: ['expense', expenseId] });
    if (groupId) {
      queryClient.invalidateQueries({ queryKey: queryKeys.expenses(groupId) });
      queryClient.invalidateQueries({ queryKey: queryKeys.group(groupId) });
    }
    queryClient.invalidateQueries({ queryKey: queryKeys.groups });
    queryClient.invalidateQueries({ queryKey: queryKeys.friends });
  };

  // Update expense mutation
  const updateExpenseMutation = useMutation({
    mutationFn: async ({ updates, newSplits }: { 
      updates: DbExpenseUpdate; 
      newSplits?: { user_id: string; amount: number }[] 
    }) => {
      if (!expenseId || !data) throw new Error('No expense');

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
      } else {
        await syncQueue.add('UPDATE_EXPENSE', { id: expenseId, ...updates, splits: newSplits });
      }
      
      return data.group_id;
    },
    onSuccess: (groupId) => {
      invalidateQueries(groupId);
    },
    onError: (err) => {
      setMutationError(err instanceof Error ? err.message : 'Failed to update expense');
    },
  });

  // Delete expense mutation
  const deleteExpenseMutation = useMutation({
    mutationFn: async () => {
      if (!expenseId) throw new Error('No expense ID');

      const groupId = data?.group_id;

      if (isOnline) {
        const { error: deleteError } = await supabase
          .from('expenses')
          .delete()
          .eq('id', expenseId);

        if (deleteError) throw deleteError;
      } else {
        await syncQueue.add('DELETE_EXPENSE', { id: expenseId });
      }
      
      return groupId;
    },
    onSuccess: (groupId) => {
      // Remove expense from cache
      queryClient.removeQueries({ queryKey: ['expense', expenseId] });
      if (groupId) {
        queryClient.invalidateQueries({ queryKey: queryKeys.expenses(groupId) });
        queryClient.invalidateQueries({ queryKey: queryKeys.group(groupId) });
      }
      queryClient.invalidateQueries({ queryKey: queryKeys.groups });
      queryClient.invalidateQueries({ queryKey: queryKeys.friends });
    },
    onError: (err) => {
      setMutationError(err instanceof Error ? err.message : 'Failed to delete expense');
    },
  });

  const updateExpense = async (
    updates: DbExpenseUpdate,
    newSplits?: { user_id: string; amount: number }[]
  ): Promise<boolean> => {
    setMutationError(null);
    try {
      await updateExpenseMutation.mutateAsync({ updates, newSplits });
      return true;
    } catch {
      return false;
    }
  };

  const deleteExpense = async (): Promise<boolean> => {
    setMutationError(null);
    try {
      await deleteExpenseMutation.mutateAsync();
      return true;
    } catch {
      return false;
    }
  };

  const refresh = async () => {
    await refetch();
  };

  // User can edit if they created the expense
  const canEdit = data?.created_by === user?.id;

  return {
    expense: data ?? null,
    isLoading,
    error: error ? (error instanceof Error ? error.message : 'Failed to fetch expense') : mutationError,
    updateExpense,
    deleteExpense,
    refresh,
    canEdit,
  };
}

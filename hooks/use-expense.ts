/**
 * Single Expense Hook
 * 
 * Fetches and manages a single expense with full details.
 * Uses TanStack Query for caching and deduplication.
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { syncQueue } from '@/lib/sync-queue';
import { pendingExpenses, type PendingExpense } from '@/lib/pending-items';
import { useAuth } from '@/contexts/auth-context';
import { useSync } from '@/contexts/sync-context';
import { useGroup } from '@/hooks/use-group';
import { queryKeys } from '@/lib/query-client';
import type {
  CurrencyCode,
  DbCategory,
  DbExpenseUpdate,
  Expense,
  ExpenseSplitInfo,
  UserSummary,
} from '@/types';
import { useState, useEffect } from 'react';

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
  const { isOnline, canEditItem, refreshPendingItems } = useSync();
  const queryClient = useQueryClient();
  const [mutationError, setMutationError] = useState<string | null>(null);
  const [pendingExpense, setPendingExpense] = useState<PendingExpense | null>(null);

  // Check if this is a pending expense
  const isPending = expenseId?.startsWith('pending_') ?? false;

  // Load pending expense if needed
  useEffect(() => {
    if (isPending && expenseId) {
      pendingExpenses.get(expenseId).then(setPendingExpense);
    }
  }, [expenseId, isPending]);

  // Query for fetching expense from server (only if not pending)
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['expense', expenseId],
    queryFn: () => fetchExpenseData(expenseId!),
    enabled: !!expenseId && !!user && isOnline && !isPending,
    staleTime: 2 * 60 * 1000, // 2 minutes
  });

  // Convert pending expense to Expense format if needed
  const expense: Expense | null = isPending && pendingExpense
    ? {
        id: pendingExpense.id,
        group_id: pendingExpense.group_id,
        paid_by: pendingExpense.paid_by,
        amount: pendingExpense.amount,
        currency: pendingExpense.currency,
        description: pendingExpense.description,
        category_id: pendingExpense.category_id,
        notes: pendingExpense.notes,
        expense_date: pendingExpense.expense_date,
        created_by: pendingExpense.created_by,
        created_at: pendingExpense.created_at,
        updated_at: pendingExpense.created_at,
        paid_by_user: { id: pendingExpense.paid_by, name: pendingExpense.paid_by_name, phone: '', avatar_url: null },
        category: pendingExpense.category_id ? { id: pendingExpense.category_id, name: '', icon: pendingExpense.category_icon || '📦', color: '#C9C9C9', sort_order: 0 } : null,
        splits: pendingExpense.splits.map(s => ({ user_id: s.user_id, amount: s.amount, user: { id: s.user_id, name: '', phone: '', avatar_url: null } })),
      }
    : data ?? null;

  // Group membership: used to allow any group member to edit/delete synced expenses
  const { group } = useGroup(expense?.group_id ?? undefined);
  const isInExpenseGroup = !!group?.members?.some((m) => m.user_id === user?.id);

  // Helper to invalidate related queries
  const invalidateQueries = (groupId?: string) => {
    queryClient.invalidateQueries({ queryKey: ['expense', expenseId] });
    if (groupId) {
      queryClient.invalidateQueries({ queryKey: queryKeys.expenses(groupId) });
      queryClient.invalidateQueries({ queryKey: queryKeys.group(groupId) });
    }
    queryClient.invalidateQueries({ queryKey: queryKeys.groups });
    queryClient.invalidateQueries({ queryKey: queryKeys.friends });
    queryClient.invalidateQueries({ queryKey: queryKeys.recentActivity });
  };

  // Update expense mutation
  const updateExpenseMutation = useMutation({
    mutationFn: async ({ updates, newSplits }: { 
      updates: DbExpenseUpdate; 
      newSplits?: { user_id: string; amount: number }[] 
    }) => {
      if (!expenseId || !expense) throw new Error('No expense');

      // Handle pending expense update
      if (isPending && pendingExpense) {
        await pendingExpenses.update(expenseId, {
          ...pendingExpense,
          description: updates.description ?? pendingExpense.description,
          amount: updates.amount ?? pendingExpense.amount,
          category_id: updates.category_id ?? pendingExpense.category_id,
          notes: updates.notes ?? pendingExpense.notes,
          splits: newSplits ?? pendingExpense.splits,
        });
        // Update local state
        const updated = await pendingExpenses.get(expenseId);
        setPendingExpense(updated);
        await refreshPendingItems();
        return expense.group_id;
      }

      // Can't update synced items when offline
      if (!isOnline) {
        throw new Error('Cannot edit synced items while offline');
      }

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

      const groupId = expense?.group_id;

      // Handle pending expense deletion
      if (isPending && pendingExpense) {
        await syncQueue.remove(pendingExpense.syncActionId);
        await pendingExpenses.remove(expenseId);
        await refreshPendingItems();
        return groupId;
      }

      // Can't delete synced items when offline
      if (!isOnline) {
        throw new Error('Cannot delete synced items while offline');
      }

      if (isOnline) {
        const { error: deleteError } = await supabase
          .from('expenses')
          .delete()
          .eq('id', expenseId);

        if (deleteError) throw deleteError;
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
      queryClient.invalidateQueries({ queryKey: queryKeys.recentActivity });
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

  // User can edit if:
  // - Pending (not synced yet): only creator (pending exists only on their device).
  // - Synced: any group member, when online.
  const isCreator = expense?.created_by === user?.id;
  const canEdit =
    (isPending && isCreator) || (!isPending && isInExpenseGroup && isOnline);

  return {
    expense,
    isLoading: isLoading && !isPending,
    error: error ? (error instanceof Error ? error.message : 'Failed to fetch expense') : mutationError,
    updateExpense,
    deleteExpense,
    refresh,
    canEdit,
  };
}

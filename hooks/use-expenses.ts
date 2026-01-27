/**
 * Expenses Hook
 * 
 * Manages expenses for a specific group.
 * Uses TanStack Query for caching and deduplication.
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { syncQueue } from '@/lib/sync-queue';
import { useAuth } from '@/contexts/auth-context';
import { useSync } from '@/contexts/sync-context';
import { queryKeys } from '@/lib/query-client';
import type {
  DbCategory,
  ExpenseFormData,
  ExpenseListItem,
  UserSummary,
  CurrencyCode,
} from '@/types';
import { useState } from 'react';

async function fetchExpenses(groupId: string, userId: string): Promise<ExpenseListItem[]> {
  // Fetch expenses with paid_by user and category
  const { data: expensesData, error: expensesError } = await supabase
    .from('expenses')
    .select(`
      *,
      paid_by_user:paid_by (id, name, phone, avatar_url),
      category:category_id (*)
    `)
    .eq('group_id', groupId)
    .order('expense_date', { ascending: false })
    .order('created_at', { ascending: false });

  if (expensesError) throw expensesError;

  // Get splits for user's share calculation
  const expenseIds = (expensesData || []).map((e) => e.id);
  
  const { data: splitsData } = await supabase
    .from('expense_splits')
    .select('expense_id, user_id, amount')
    .in('expense_id', expenseIds);

  // Build splits map
  const splitsMap: Record<string, { user_id: string; amount: number }[]> = {};
  splitsData?.forEach((split) => {
    if (!splitsMap[split.expense_id]) {
      splitsMap[split.expense_id] = [];
    }
    splitsMap[split.expense_id].push(split);
  });

  // Transform to ExpenseListItem
  return (expensesData || []).map((e) => {
    const splits = splitsMap[e.id] || [];
    const userSplit = splits.find((s) => s.user_id === userId);
    const youPaid = e.paid_by === userId;

    return {
      id: e.id,
      description: e.description,
      amount: Number(e.amount),
      currency: e.currency as CurrencyCode,
      paid_by: e.paid_by_user as UserSummary,
      category: e.category as DbCategory | null,
      expense_date: e.expense_date,
      your_share: youPaid ? 0 : (userSplit?.amount || 0),
      you_paid: youPaid,
      split_count: splits.length,
    };
  });
}

interface UseExpensesResult {
  expenses: ExpenseListItem[];
  isLoading: boolean;
  error: string | null;
  createExpense: (data: ExpenseFormData) => Promise<string | null>;
  deleteExpense: (expenseId: string) => Promise<boolean>;
  refresh: () => Promise<void>;
}

export function useExpenses(groupId: string | undefined): UseExpensesResult {
  const { user } = useAuth();
  const { isOnline } = useSync();
  const queryClient = useQueryClient();
  const [mutationError, setMutationError] = useState<string | null>(null);

  // Query for fetching expenses
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: queryKeys.expenses(groupId || ''),
    queryFn: () => fetchExpenses(groupId!, user!.id),
    enabled: !!groupId && !!user && isOnline,
    staleTime: 2 * 60 * 1000, // 2 minutes
  });

  // Helper to invalidate related queries
  const invalidateQueries = () => {
    queryClient.invalidateQueries({ queryKey: queryKeys.expenses(groupId || '') });
    queryClient.invalidateQueries({ queryKey: queryKeys.group(groupId || '') });
    queryClient.invalidateQueries({ queryKey: queryKeys.groups });
    queryClient.invalidateQueries({ queryKey: queryKeys.friends });
  };

  // Create expense mutation
  const createExpenseMutation = useMutation({
    mutationFn: async (formData: ExpenseFormData): Promise<string> => {
      if (!groupId || !user) throw new Error('No group or user');

      const amount = parseFloat(formData.amount);
      if (isNaN(amount) || amount <= 0) {
        throw new Error('Invalid amount');
      }

      // Calculate splits based on split type
      let splits: { user_id: string; amount: number }[];
      
      if (formData.split_type === 'equal_all') {
        const { data: members } = await supabase
          .from('group_members')
          .select('user_id')
          .eq('group_id', groupId);

        const memberIds = members?.map((m) => m.user_id) || [user.id];
        const splitAmount = amount / memberIds.length;
        
        splits = memberIds.map((userId) => ({
          user_id: userId,
          amount: Math.round(splitAmount * 100) / 100,
        }));
      } else {
        const splitAmount = amount / formData.split_between.length;
        splits = formData.split_between.map((userId) => ({
          user_id: userId,
          amount: Math.round(splitAmount * 100) / 100,
        }));
      }

      if (isOnline) {
        const { data: newExpense, error: expenseError } = await supabase
          .from('expenses')
          .insert({
            group_id: groupId,
            paid_by: formData.paid_by,
            amount,
            currency: formData.currency,
            description: formData.description,
            category_id: formData.category_id,
            notes: formData.notes || null,
            expense_date: formData.expense_date.toISOString().split('T')[0],
            created_by: user.id,
          })
          .select('id')
          .single();

        if (expenseError) throw expenseError;

        const splitsWithExpenseId = splits.map((s) => ({
          ...s,
          expense_id: newExpense.id,
        }));

        const { error: splitsError } = await supabase
          .from('expense_splits')
          .insert(splitsWithExpenseId);

        if (splitsError) throw splitsError;

        return newExpense.id;
      } else {
        await syncQueue.add('CREATE_EXPENSE', {
          group_id: groupId,
          paid_by: formData.paid_by,
          amount,
          currency: formData.currency,
          description: formData.description,
          category_id: formData.category_id,
          notes: formData.notes || null,
          expense_date: formData.expense_date.toISOString().split('T')[0],
          created_by: user.id,
          splits,
        });
        return `temp_${Date.now()}`;
      }
    },
    onSuccess: invalidateQueries,
    onError: (err) => {
      setMutationError(err instanceof Error ? err.message : 'Failed to create expense');
    },
  });

  // Delete expense mutation
  const deleteExpenseMutation = useMutation({
    mutationFn: async (expenseId: string) => {
      if (isOnline) {
        const { error: deleteError } = await supabase
          .from('expenses')
          .delete()
          .eq('id', expenseId);

        if (deleteError) throw deleteError;
      } else {
        await syncQueue.add('DELETE_EXPENSE', { id: expenseId });
      }
    },
    onSuccess: invalidateQueries,
    onError: (err) => {
      setMutationError(err instanceof Error ? err.message : 'Failed to delete expense');
    },
  });

  const createExpense = async (formData: ExpenseFormData): Promise<string | null> => {
    setMutationError(null);
    try {
      return await createExpenseMutation.mutateAsync(formData);
    } catch {
      return null;
    }
  };

  const deleteExpense = async (expenseId: string): Promise<boolean> => {
    setMutationError(null);
    try {
      await deleteExpenseMutation.mutateAsync(expenseId);
      return true;
    } catch {
      return false;
    }
  };

  const refresh = async () => {
    await refetch();
  };

  return {
    expenses: data ?? [],
    isLoading,
    error: error ? (error instanceof Error ? error.message : 'Failed to fetch expenses') : mutationError,
    createExpense,
    deleteExpense,
    refresh,
  };
}

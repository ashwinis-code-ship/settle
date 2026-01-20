/**
 * Expenses Hook
 * 
 * Manages expenses for a specific group.
 */

import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { syncQueue } from '@/lib/sync-queue';
import { useAuth } from '@/contexts/auth-context';
import { useSync } from '@/contexts/sync-context';
import type {
  DbCategory,
  ExpenseFormData,
  ExpenseListItem,
  UserSummary,
  CurrencyCode,
} from '@/types';

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
  
  const [expenses, setExpenses] = useState<ExpenseListItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchExpenses = useCallback(async () => {
    if (!groupId || !user) {
      setExpenses([]);
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
      const expensesList: ExpenseListItem[] = (expensesData || []).map((e) => {
        const splits = splitsMap[e.id] || [];
        const userSplit = splits.find((s) => s.user_id === user.id);
        const youPaid = e.paid_by === user.id;

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

      setExpenses(expensesList);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to fetch expenses';
      setError(message);
      console.error('[useExpenses] Error:', err);
    } finally {
      setIsLoading(false);
    }
  }, [groupId, user, isOnline]);

  const createExpense = useCallback(async (data: ExpenseFormData): Promise<string | null> => {
    if (!groupId || !user) return null;

    const amount = parseFloat(data.amount);
    if (isNaN(amount) || amount <= 0) {
      setError('Invalid amount');
      return null;
    }

    // Calculate splits based on split type
    let splits: { user_id: string; amount: number }[];
    
    if (data.split_type === 'equal_all') {
      // Get all group members
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
      // equal_selected
      const splitAmount = amount / data.split_between.length;
      splits = data.split_between.map((userId) => ({
        user_id: userId,
        amount: Math.round(splitAmount * 100) / 100,
      }));
    }

    const expenseData = {
      group_id: groupId,
      paid_by: data.paid_by,
      amount,
      currency: data.currency,
      description: data.description,
      category_id: data.category_id,
      notes: data.notes || null,
      expense_date: data.expense_date.toISOString().split('T')[0],
      created_by: user.id,
      splits,
    };

    try {
      if (isOnline) {
        // Insert expense
        const { data: newExpense, error: expenseError } = await supabase
          .from('expenses')
          .insert({
            group_id: expenseData.group_id,
            paid_by: expenseData.paid_by,
            amount: expenseData.amount,
            currency: expenseData.currency,
            description: expenseData.description,
            category_id: expenseData.category_id,
            notes: expenseData.notes,
            expense_date: expenseData.expense_date,
            created_by: expenseData.created_by,
          })
          .select('id')
          .single();

        if (expenseError) throw expenseError;

        // Insert splits
        const splitsWithExpenseId = splits.map((s) => ({
          ...s,
          expense_id: newExpense.id,
        }));

        const { error: splitsError } = await supabase
          .from('expense_splits')
          .insert(splitsWithExpenseId);

        if (splitsError) throw splitsError;

        await fetchExpenses();
        return newExpense.id;
      } else {
        // Queue for later sync
        await syncQueue.add('CREATE_EXPENSE', expenseData);
        
        // Optimistic update
        const tempId = `temp_${Date.now()}`;
        const tempExpense: ExpenseListItem = {
          id: tempId,
          description: data.description,
          amount,
          currency: data.currency,
          paid_by: { id: data.paid_by, name: 'You', phone: '', avatar_url: null },
          category: null,
          expense_date: data.expense_date.toISOString().split('T')[0],
          your_share: 0,
          you_paid: data.paid_by === user.id,
          split_count: splits.length,
        };
        
        setExpenses((prev) => [tempExpense, ...prev]);
        return tempId;
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create expense');
      return null;
    }
  }, [groupId, user, isOnline, fetchExpenses]);

  const deleteExpense = useCallback(async (expenseId: string): Promise<boolean> => {
    try {
      // Optimistic update
      setExpenses((prev) => prev.filter((e) => e.id !== expenseId));

      if (isOnline) {
        const { error: deleteError } = await supabase
          .from('expenses')
          .delete()
          .eq('id', expenseId);

        if (deleteError) throw deleteError;
      } else {
        await syncQueue.add('DELETE_EXPENSE', { id: expenseId });
      }
      return true;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete expense');
      await fetchExpenses(); // Rollback
      return false;
    }
  }, [isOnline, fetchExpenses]);

  useEffect(() => {
    fetchExpenses();
  }, [fetchExpenses]);

  return {
    expenses,
    isLoading,
    error,
    createExpense,
    deleteExpense,
    refresh: fetchExpenses,
  };
}

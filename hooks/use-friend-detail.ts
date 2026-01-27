/**
 * Friend Detail Hook
 * 
 * Fetches transactions between the current user and a specific friend.
 * Includes expenses and settlements from all shared groups.
 */

import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/auth-context';
import { useSync } from '@/contexts/sync-context';
import type { FriendTransaction, CurrencyCode, UserSummary } from '@/types';

interface FriendDetail {
  user: UserSummary;
  total_balance: number;
  shared_groups: number;
  primary_currency: CurrencyCode;
}

interface UseFriendDetailResult {
  friend: FriendDetail | null;
  transactions: FriendTransaction[];
  isLoading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
}

export function useFriendDetail(friendId: string): UseFriendDetailResult {
  const { user } = useAuth();
  const { isOnline } = useSync();

  const [friend, setFriend] = useState<FriendDetail | null>(null);
  const [transactions, setTransactions] = useState<FriendTransaction[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchFriendDetail = useCallback(async () => {
    if (!user || !friendId) {
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

      // Fetch friend user info
      const { data: friendUser, error: friendError } = await supabase
        .from('users')
        .select('id, name, phone, avatar_url')
        .eq('id', friendId)
        .single();

      if (friendError || !friendUser) {
        setError('Friend not found');
        setIsLoading(false);
        return;
      }

      // Get balance using RPC function
      const { data: balance } = await supabase.rpc('calculate_balance_between_users', {
        user1_id: user.id,
        user2_id: friendId,
      });

      // Get all groups where both users are members
      const { data: myGroups } = await supabase
        .from('group_members')
        .select('group_id')
        .eq('user_id', user.id);

      const { data: friendGroups } = await supabase
        .from('group_members')
        .select('group_id')
        .eq('user_id', friendId);

      const myGroupIds = new Set(myGroups?.map((g) => g.group_id) || []);
      const sharedGroupIds = friendGroups
        ?.filter((g) => myGroupIds.has(g.group_id))
        .map((g) => g.group_id) || [];

      // Fetch group names for context
      const { data: groups } = await supabase
        .from('groups')
        .select('id, name')
        .in('id', sharedGroupIds);

      const groupNameMap = new Map<string, string>();
      groups?.forEach((g) => {
        groupNameMap.set(g.id, g.name);
      });

      // Fetch all expenses in shared groups where either user paid or is in split
      const { data: expenses } = await supabase
        .from('expenses')
        .select(`
          id,
          description,
          amount,
          currency,
          created_at,
          group_id,
          paid_by,
          expense_splits (
            user_id,
            amount
          )
        `)
        .in('group_id', sharedGroupIds)
        .order('created_at', { ascending: false });

      // Fetch settlements between the two users
      const { data: settlements } = await supabase
        .from('settlements')
        .select('id, amount, currency, created_at, group_id, paid_by, paid_to')
        .or(`and(paid_by.eq.${user.id},paid_to.eq.${friendId}),and(paid_by.eq.${friendId},paid_to.eq.${user.id})`)
        .order('created_at', { ascending: false });

      // Process expenses into transactions
      const expenseTransactions: FriendTransaction[] = [];

      expenses?.forEach((expense) => {
        const splits = expense.expense_splits as { user_id: string; amount: number }[];
        
        // Check if both users are involved in this expense
        const mySplit = splits.find((s) => s.user_id === user.id);
        const friendSplit = splits.find((s) => s.user_id === friendId);

        if (!mySplit && !friendSplit) return; // Neither involved
        if (!mySplit && expense.paid_by !== user.id) return; // I'm not involved
        if (!friendSplit && expense.paid_by !== friendId) return; // Friend not involved

        // Calculate what friend owes me from this expense (or vice versa)
        let impactAmount = 0;

        if (expense.paid_by === user.id && friendSplit) {
          // I paid, friend owes their split to me
          impactAmount = friendSplit.amount;
        } else if (expense.paid_by === friendId && mySplit) {
          // Friend paid, I owe my split to them
          impactAmount = -mySplit.amount;
        }

        if (impactAmount === 0) return; // No impact between us

        expenseTransactions.push({
          id: expense.id,
          type: 'expense',
          description: expense.description,
          amount: impactAmount,
          currency: expense.currency as CurrencyCode,
          date: expense.created_at,
          group_id: expense.group_id,
          group_name: groupNameMap.get(expense.group_id) || null,
        });
      });

      // Process settlements into transactions
      const settlementTransactions: FriendTransaction[] = (settlements || []).map((settlement) => {
        const iPayedThem = settlement.paid_by === user.id;
        return {
          id: settlement.id,
          type: 'settlement' as const,
          description: iPayedThem ? 'You paid' : `${friendUser.name} paid`,
          amount: iPayedThem ? settlement.amount : -settlement.amount,
          currency: settlement.currency as CurrencyCode,
          date: settlement.created_at,
          group_id: settlement.group_id,
          group_name: settlement.group_id ? groupNameMap.get(settlement.group_id) || null : null,
        };
      });

      // Combine and sort by date (newest first)
      const allTransactions = [...expenseTransactions, ...settlementTransactions].sort(
        (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
      );

      setFriend({
        user: friendUser as UserSummary,
        total_balance: Number(balance) || 0,
        shared_groups: sharedGroupIds.length,
        primary_currency: 'INR',
      });
      setTransactions(allTransactions);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to fetch friend details';
      setError(message);
      console.error('[useFriendDetail] Error:', err);
    } finally {
      setIsLoading(false);
    }
  }, [user, friendId, isOnline]);

  useEffect(() => {
    fetchFriendDetail();
  }, [fetchFriendDetail]);

  return {
    friend,
    transactions,
    isLoading,
    error,
    refresh: fetchFriendDetail,
  };
}

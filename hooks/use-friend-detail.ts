/**
 * Friend Detail Hook
 *
 * Fetches transactions between the current user and a specific friend.
 * Uses settlement phases: only shows transactions since the most recent settlement.
 * Older phases are loaded on demand via "View old transactions".
 */

import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/auth-context';
import { useSync } from '@/contexts/sync-context';
import { cache } from '@/lib/storage';
import type { FriendTransaction, CurrencyCode, UserSummary } from '@/types';

const BATCH_SIZE = 50;

export interface FriendDetail {
  user: UserSummary;
  total_balance: number;
  shared_groups: number;
  primary_currency: CurrencyCode;
}

/** Aggregated balance per shared group */
export interface GroupBalance {
  group_id: string;
  group_name: string;
  /** Positive = friend owes you in this group, Negative = you owe friend */
  balance: number;
  currency: CurrencyCode;
  transaction_count: number;
}

/** A phase of transactions (between two settlement points) */
export type TransactionPhase = FriendTransaction[];

interface UseFriendDetailResult {
  friend: FriendDetail | null;
  groupBalances: GroupBalance[];
  /** Current phase - transactions since most recent settlement. Empty if fully settled. */
  currentPhase: FriendTransaction[];
  /** Older phases, each loaded on demand. olderPhases[0] = first "View old" block, etc. */
  olderPhases: TransactionPhase[];
  /** True when balance=0 and we have transaction history (show settled state) */
  isFullySettled: boolean;
  /** True if there are older phases (loaded or available to load) */
  hasOlderPhases: boolean;
  /** True if there are more older phases to fetch */
  hasMoreOlder: boolean;
  /** Load the next older phase (fetch on demand) */
  loadOlderPhase: () => Promise<void>;
  /** Loading state for loadOlderPhase */
  isLoadingOlder: boolean;
  isLoading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
}

function mapRpcToTransaction(
  row: {
    id: string;
    type: string;
    description: string;
    amount: number;
    currency: string;
    created_at: string;
    group_id: string | null;
    group_name: string | null;
    notes: string | null;
    paid_by: string;
  },
  userId: string,
  friendName: string
): FriendTransaction {
  const isSettlement = row.type === 'settlement';
  const description =
    isSettlement && row.description === 'They paid' ? `${friendName} paid` : row.description;

  return {
    id: row.id,
    type: row.type as 'expense' | 'settlement',
    description,
    amount: Number(row.amount),
    currency: row.currency as CurrencyCode,
    date: row.created_at,
    group_id: row.group_id,
    group_name: row.group_name,
    notes: row.notes ?? null,
  };
}

export function useFriendDetail(friendId: string): UseFriendDetailResult {
  const { user } = useAuth();
  const { isOnline } = useSync();

  const [friend, setFriend] = useState<FriendDetail | null>(null);
  const [groupBalances, setGroupBalances] = useState<GroupBalance[]>([]);
  const [currentPhase, setCurrentPhase] = useState<FriendTransaction[]>([]);
  const [olderPhases, setOlderPhases] = useState<TransactionPhase[]>([]);
  const [settlementCursor, setSettlementCursor] = useState<{
    created_at: string;
    id: string;
  } | null>(null);
  const [settlementTxForNextPhase, setSettlementTxForNextPhase] = useState<FriendTransaction | null>(
    null
  );
  const [hasMoreOlder, setHasMoreOlder] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingOlder, setIsLoadingOlder] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchTransactionBatch = useCallback(
    async (cursor: { created_at: string; id: string } | null) => {
      if (!user || !friendId) return [];

      const { data, error: rpcError } = await supabase.rpc('get_friend_transactions', {
        p_user1_id: user.id,
        p_user2_id: friendId,
        p_limit: BATCH_SIZE,
        p_cursor_created_at: cursor?.created_at ?? null,
        p_cursor_id: cursor?.id ?? null,
      });

      if (rpcError) {
        console.error('[useFriendDetail] get_friend_transactions error:', rpcError);
        return [];
      }

      return data || [];
    },
    [user, friendId]
  );

  const fetchFriendDetail = useCallback(async () => {
    if (!user || !friendId) {
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setError(null);
    setCurrentPhase([]);
    setOlderPhases([]);
    setSettlementCursor(null);
    setSettlementTxForNextPhase(null);
    setHasMoreOlder(false);

    try {
      if (!isOnline) {
        const cached = await cache.getFriendDetail<{
          friend: FriendDetail;
          groupBalances: GroupBalance[];
          transactions: FriendTransaction[];
        }>(friendId);
        if (cached) {
          setFriend(cached.friend);
          setGroupBalances(cached.groupBalances);
          // Offline: show all transactions as current phase (no phase logic)
          setCurrentPhase(cached.transactions);
        }
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

      const friendName = friendUser.name || 'Friend';

      // Get balance
      const { data: balance } = await supabase.rpc('calculate_balance_between_users', {
        user1_id: user.id,
        user2_id: friendId,
      });

      const currentBalance = Number(balance) || 0;

      // Fetch groups for group balances
      const { data: myGroups } = await supabase
        .from('group_members')
        .select('group_id')
        .eq('user_id', user.id);

      const { data: friendGroups } = await supabase
        .from('group_members')
        .select('group_id')
        .eq('user_id', friendId);

      const myGroupIds = new Set(myGroups?.map((g) => g.group_id) || []);
      const potentialSharedGroupIds =
        friendGroups?.filter((g) => myGroupIds.has(g.group_id)).map((g) => g.group_id) || [];

      const { data: allGroups } = await supabase
        .from('groups')
        .select('id, name, currency, type')
        .in('id', potentialSharedGroupIds)
        .is('deleted_at', null);

      const allSharedGroupIds = allGroups?.map((g) => g.id) || [];
      const regularGroups = allGroups?.filter((g) => g.type === 'group') || [];

      const groupMap = new Map<string, { name: string; currency: string; type: string }>();
      allGroups?.forEach((g) => {
        groupMap.set(g.id, { name: g.name, currency: g.currency, type: g.type || 'group' });
      });

      // Fetch expenses and settlements for group balance (unchanged)
      const { data: expenses } = await supabase
        .from('expenses')
        .select(
          `
          id, description, amount, currency, created_at, group_id, paid_by,
          expense_splits (user_id, amount)
        `
        )
        .in('group_id', allSharedGroupIds)
        .order('created_at', { ascending: false });

      const { data: settlements } = await supabase
        .from('settlements')
        .select('id, amount, currency, created_at, group_id, paid_by, paid_to, notes')
        .or(
          `and(paid_by.eq.${user.id},paid_to.eq.${friendId}),and(paid_by.eq.${friendId},paid_to.eq.${user.id})`
        )
        .order('created_at', { ascending: false });

      // Compute group balances
      const groupBalanceMap = new Map<string, { balance: number; count: number }>();
      allSharedGroupIds.forEach((gid) => groupBalanceMap.set(gid, { balance: 0, count: 0 }));

      expenses?.forEach((expense) => {
        const splits = expense.expense_splits as { user_id: string; amount: number }[];
        const mySplit = splits.find((s) => s.user_id === user.id);
        const friendSplit = splits.find((s) => s.user_id === friendId);
        if (!mySplit && !friendSplit) return;
        if (!mySplit && expense.paid_by !== user.id) return;
        if (!friendSplit && expense.paid_by !== friendId) return;

        let impactAmount = 0;
        if (expense.paid_by === user.id && friendSplit) impactAmount = friendSplit.amount;
        else if (expense.paid_by === friendId && mySplit) impactAmount = -mySplit.amount;
        if (impactAmount === 0) return;

        const gd = groupBalanceMap.get(expense.group_id);
        if (gd) {
          gd.balance += impactAmount;
          gd.count += 1;
        }
      });

      (settlements || []).forEach((s) => {
        const iPayedThem = s.paid_by === user.id;
        if (s.group_id) {
          const gd = groupBalanceMap.get(s.group_id);
          if (gd) {
            gd.balance += iPayedThem ? s.amount : -s.amount;
            gd.count += 1;
          }
        }
      });

      const groupBalancesArray: GroupBalance[] = [];
      for (const [groupId, data] of groupBalanceMap.entries()) {
        const gi = groupMap.get(groupId);
        if (gi && data.count > 0 && gi.type === 'group') {
          groupBalancesArray.push({
            group_id: groupId,
            group_name: gi.name,
            balance: data.balance,
            currency: (gi.currency || 'INR') as CurrencyCode,
            transaction_count: data.count,
          });
        }
      }
      groupBalancesArray.sort((a, b) => Math.abs(b.balance) - Math.abs(a.balance));

      const friendData: FriendDetail = {
        user: friendUser as UserSummary,
        total_balance: currentBalance,
        shared_groups: regularGroups.length,
        primary_currency: 'INR',
      };

      setFriend(friendData);
      setGroupBalances(groupBalancesArray);

      // Walk newest → oldest. The first settlement we encounter is the phase boundary.
      // Everything before it (newer) = current phase. It + everything older = older phases.
      let cursor: { created_at: string; id: string } | null = null;
      const currentPhaseTxs: FriendTransaction[] = [];
      let foundBoundary = false;
      let batchHasMore = true;

      while (batchHasMore) {
        const rows = await fetchTransactionBatch(cursor);
        batchHasMore = rows.length === BATCH_SIZE;

        for (const row of rows) {
          if (row.type === 'settlement') {
            const tx = mapRpcToTransaction(row, user.id, friendName);
            setSettlementCursor({ created_at: row.created_at, id: row.id });
            setSettlementTxForNextPhase(tx);
            setCurrentPhase([...currentPhaseTxs]);
            setHasMoreOlder(true);
            foundBoundary = true;
            break;
          }
          currentPhaseTxs.push(mapRpcToTransaction(row, user.id, friendName));
        }

        if (foundBoundary) break;

        if (rows.length > 0) {
          const last = rows[rows.length - 1];
          cursor = { created_at: last.created_at, id: last.id };
        } else {
          break;
        }
      }

      if (!foundBoundary) {
        setCurrentPhase(currentPhaseTxs);
        setHasMoreOlder(false);
      }

      await cache.setFriendDetail(friendId, {
        friend: friendData,
        groupBalances: groupBalancesArray,
        transactions: currentPhaseTxs, // Cache current phase for offline
      });
    } catch (err) {
      const cached = await cache.getFriendDetail<{
        friend: FriendDetail;
        groupBalances: GroupBalance[];
        transactions: FriendTransaction[];
      }>(friendId);

      if (cached) {
        setFriend(cached.friend);
        setGroupBalances(cached.groupBalances);
        setCurrentPhase(cached.transactions);
        setError(null);
      } else {
        setError(err instanceof Error ? err.message : 'Failed to fetch friend details');
        console.error('[useFriendDetail] Error:', err);
      }
    } finally {
      setIsLoading(false);
    }
  }, [user, friendId, isOnline, fetchTransactionBatch]);

  const loadOlderPhase = useCallback(async () => {
    if (!user || !friendId || isLoadingOlder) return;

    const cursor = settlementCursor;
    const firstTx = settlementTxForNextPhase;
    if (!cursor && !firstTx) return; // Need at least one to load older

    setIsLoadingOlder(true);

    try {
      const friendName = friend?.user.name || 'Friend';
      const rows = await fetchTransactionBatch(cursor);

      const phaseTxs: FriendTransaction[] = [];

      // Prepend the settlement that is the boundary/header of this older phase
      if (firstTx) {
        phaseTxs.push(firstTx);
      }

      // Walk older transactions until we hit the next settlement (next boundary)
      let nextBoundary: { tx: FriendTransaction; created_at: string; id: string } | null = null;

      for (const row of rows) {
        if (row.type === 'settlement') {
          const tx = mapRpcToTransaction(row, user.id, friendName);
          nextBoundary = { tx, created_at: row.created_at, id: row.id };
          break;
        }
        phaseTxs.push(mapRpcToTransaction(row, user.id, friendName));
      }

      setOlderPhases((prev) => [...prev, phaseTxs]);

      if (nextBoundary) {
        setSettlementCursor({ created_at: nextBoundary.created_at, id: nextBoundary.id });
        setSettlementTxForNextPhase(nextBoundary.tx);
        setHasMoreOlder(true);
      } else {
        setSettlementCursor(rows.length > 0 ? { created_at: rows[rows.length - 1].created_at, id: rows[rows.length - 1].id } : null);
        setSettlementTxForNextPhase(null);
        setHasMoreOlder(rows.length === BATCH_SIZE);
      }
    } catch (err) {
      console.error('[useFriendDetail] loadOlderPhase error:', err);
    } finally {
      setIsLoadingOlder(false);
    }
  }, [
    user,
    friendId,
    friend,
    settlementCursor,
    settlementTxForNextPhase,
    olderPhases.length,
    fetchTransactionBatch,
    isLoadingOlder,
  ]);

  useEffect(() => {
    fetchFriendDetail();
  }, [fetchFriendDetail]);

  const balance = friend?.total_balance ?? 0;
  const isFullySettled = balance === 0 && (currentPhase.length > 0 || olderPhases.length > 0);

  return {
    friend,
    groupBalances,
    currentPhase,
    olderPhases,
    isFullySettled,
    hasOlderPhases: hasMoreOlder || olderPhases.length > 0,
    hasMoreOlder,
    loadOlderPhase,
    isLoadingOlder,
    isLoading,
    error,
    refresh: fetchFriendDetail,
  };
}

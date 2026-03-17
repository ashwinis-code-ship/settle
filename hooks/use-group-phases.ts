/**
 * Group Phases Hook
 *
 * Layers phase-based splitting on top of useExpenses.
 * Checkpoints are explicit phase boundaries inserted by any group member.
 * Phase boundary logic:
 *   - Current phase  : all expenses whose created_at > latest checkpoint's created_at
 *   - Older phases   : expenses between two consecutive checkpoint timestamps
 *   - All checkpoints are loaded upfront (lightweight). Older phases are revealed
 *     one at a time via loadOlderPhase() — pure UI state, no extra network calls.
 */

import { useCallback, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { useAuth } from '@/contexts/auth-context';
import { queryKeys } from '@/lib/query-client';
import { supabase } from '@/lib/supabase';
import type { GroupCheckpoint, GroupMemberBalance } from '@/types';

import { useExpenses, type ExpenseGroupListItemWithStatus, type ExpenseListItemWithStatus, type GroupTabExpenseItem } from './use-expenses';

// ─── Public types ────────────────────────────────────────────────────────────

export interface OlderPhase {
  checkpoint: GroupCheckpoint;
  expenses: GroupTabExpenseItem[];
}

/** Discriminated union for the flat FlatList data array in the group detail screen */
export type ActivityListItem =
  | { kind: 'expense'; data: ExpenseListItemWithStatus }
  | { kind: 'group'; data: ExpenseGroupListItemWithStatus }
  | { kind: 'checkpoint'; data: GroupCheckpoint }
  | { kind: 'view_older' }
  /** Shown when current phase is empty but archived phases exist */
  | { kind: 'all_archived'; showViewOlder: boolean }
  /** Sentinel at the end of the list when more server pages are available */
  | { kind: 'load_more_expenses'; isFetching: boolean };

export interface UseGroupPhasesResult {
  /** Flat list ready for FlatList — expenses, checkpoint dividers, view-older button */
  activityData: ActivityListItem[];
  /** Phase-aware per-member balances — feed directly into BalanceSpectrumBar */
  currentPhaseBalances: GroupMemberBalance[];
  /** Sum of total_paid in the current phase — for the Contributions section header */
  currentPhaseTotalSpend: number;
  /** Whether there are checkpoints (i.e. the group has at least one phase boundary) */
  hasCheckpoints: boolean;
  /** True when current phase has no expenses — archiving again would be pointless */
  isCurrentPhaseEmpty: boolean;
  isLoading: boolean;
  /** True while a next page of expenses is being fetched */
  isFetchingMoreExpenses: boolean;
  /** Whether there are more expense pages to load from the server */
  hasMoreExpenses: boolean;
  /** Load the next page of 50 expenses from the server */
  loadMoreExpenses: () => void;
  /** Reveal the next older phase in the activity list (pure UI state) */
  loadOlderPhase: () => void;
  /** Insert a new checkpoint (marks current phase as done) */
  addCheckpoint: () => Promise<boolean>;
  /** Delete an existing checkpoint (undoes a "mark as done") */
  removeCheckpoint: (checkpointId: string) => Promise<boolean>;
  refresh: () => Promise<void>;
  // Pass-through mutations from useExpenses
  createExpense: ReturnType<typeof useExpenses>['createExpense'];
  deleteExpense: ReturnType<typeof useExpenses>['deleteExpense'];
  error: string | null;
}

// ─── Fetchers ─────────────────────────────────────────────────────────────────

async function fetchCheckpoints(groupId: string): Promise<GroupCheckpoint[]> {
  const { data, error } = await supabase
    .from('group_checkpoints')
    .select('id, group_id, created_by, created_at, creator:created_by(name)')
    .eq('group_id', groupId)
    .order('created_at', { ascending: false });

  if (error) throw error;

  return (data || []).map((row: {
    id: string;
    group_id: string;
    created_by: string;
    created_at: string;
    creator: { name: string } | null;
  }): GroupCheckpoint => ({
    id: row.id,
    group_id: row.group_id,
    created_by: row.created_by,
    creator_name: row.creator?.name || 'Someone',
    created_at: row.created_at,
  }));
}

async function fetchPhaseBalances(
  groupId: string,
  afterTs: string | null
): Promise<GroupMemberBalance[]> {
  const { data, error } = await supabase.rpc('get_group_phase_balances', {
    p_group_id: groupId,
    p_after_ts: afterTs,
  });

  if (error) throw error;

  return (data || []).map(
    (row: {
      user_id: string;
      user_name: string;
      avatar_url: string | null;
      total_paid: number;
      total_owed: number;
      net_balance: number;
    }): GroupMemberBalance => ({
      user: {
        id: row.user_id,
        name: row.user_name,
        phone: '',
        avatar_url: row.avatar_url,
      },
      total_paid: Number(row.total_paid),
      total_owed: Number(row.total_owed),
      total_settled_paid: 0,
      total_settled_received: 0,
      net_balance: Number(row.net_balance),
    })
  );
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useGroupPhases(groupId: string | undefined): UseGroupPhasesResult {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  // How many older phases the user has chosen to reveal (UI state only)
  const [loadedOlderCount, setLoadedOlderCount] = useState(0);

  // ── Expenses (flat list, includes pending items) ──────────────────────────
      const {
        expenses,
        isLoading: expensesLoading,
        isFetchingMore: isFetchingMoreExpenses,
        hasMoreExpenses,
        loadMoreExpenses,
        refresh: refreshExpenses,
        createExpense,
        deleteExpense,
        error: expensesError,
      } = useExpenses(groupId);

  // ── Checkpoints ───────────────────────────────────────────────────────────
  const {
    data: checkpoints = [],
    isLoading: checkpointsLoading,
    refetch: refetchCheckpoints,
  } = useQuery({
    queryKey: queryKeys.checkpoints(groupId || ''),
    queryFn: () => fetchCheckpoints(groupId!),
    enabled: !!groupId && !!user,
    staleTime: 30 * 1000,
  });

  // ── Phase-aware balances ──────────────────────────────────────────────────
  // checkpoints is sorted newest-first, so [0] is the latest
  const latestCheckpointTs = checkpoints[0]?.created_at ?? null;

  const {
    data: currentPhaseBalances = [],
    refetch: refetchBalances,
  } = useQuery({
    queryKey: queryKeys.phaseBalances(groupId || '', latestCheckpointTs),
    queryFn: () => fetchPhaseBalances(groupId!, latestCheckpointTs),
    enabled: !!groupId && !!user,
    staleTime: 30 * 1000,
  });

  // ── Phase splitting ───────────────────────────────────────────────────────
  // expenses is now GroupTabExpenseItem[] (expense | group with itemType)
  const { currentPhaseExpenses, allOlderPhases } = useMemo(() => {
    if (checkpoints.length === 0) {
      return { currentPhaseExpenses: expenses, allOlderPhases: [] };
    }

    const latestTs = new Date(checkpoints[0].created_at).getTime();

    const currentPhase = expenses.filter(
      (e) => new Date(e.created_at).getTime() > latestTs
    );

    const older: OlderPhase[] = checkpoints.map((checkpoint, i) => {
      const checkpointTs = new Date(checkpoint.created_at).getTime();
      const prevCheckpointTs = checkpoints[i + 1]
        ? new Date(checkpoints[i + 1].created_at).getTime()
        : 0;

      return {
        checkpoint,
        expenses: expenses.filter((e) => {
          const eTs = new Date(e.created_at).getTime();
          return eTs <= checkpointTs && eTs > prevCheckpointTs;
        }),
      };
    });

    return { currentPhaseExpenses: currentPhase, allOlderPhases: older };
  }, [expenses, checkpoints]);

  const visibleOlderPhases = useMemo(
    () => allOlderPhases.slice(0, loadedOlderCount),
    [allOlderPhases, loadedOlderCount]
  );

  const hasMoreOlderPhases = loadedOlderCount < allOlderPhases.length;

  const loadOlderPhase = useCallback(() => {
    setLoadedOlderCount((prev) => Math.min(prev + 1, allOlderPhases.length));
  }, [allOlderPhases.length]);

  // ── Flat activity list for FlatList ───────────────────────────────────────
  const activityData = useMemo((): ActivityListItem[] => {
    const items: ActivityListItem[] = currentPhaseExpenses.map((e) =>
      e.itemType === 'group'
        ? { kind: 'group' as const, data: e }
        : { kind: 'expense' as const, data: e }
    );

    // Empty current phase: show the "All archived" card instead of a blank list.
    // The card embeds a "View older expenses" link only before the user has opened
    // any older phase — after that the regular view_older row at the bottom takes over.
    if (currentPhaseExpenses.length === 0 && checkpoints.length > 0) {
      items.push({
        kind: 'all_archived',
        showViewOlder: hasMoreOlderPhases && visibleOlderPhases.length === 0,
      });
    }

    // Revealed older phases: checkpoint divider then its expenses (or groups)
    for (const phase of visibleOlderPhases) {
      items.push({ kind: 'checkpoint', data: phase.checkpoint });
      for (const e of phase.expenses) {
        items.push(e.itemType === 'group' ? { kind: 'group' as const, data: e } : { kind: 'expense' as const, data: e });
      }
    }

    // "View older expenses" standalone row — shown whenever more phases remain,
    // UNLESS the all_archived card is already showing the inline link (i.e. the
    // current phase is empty and no older phases have been revealed yet).
    // In that case the card itself is the entry point — adding a second row duplicates it.
    const allArchivedCardOwnsFirstTap =
      currentPhaseExpenses.length === 0 &&
      checkpoints.length > 0 &&
      visibleOlderPhases.length === 0 &&
      hasMoreOlderPhases;

    if (hasMoreOlderPhases && !allArchivedCardOwnsFirstTap) {
      items.push({ kind: 'view_older' });
    }

    // At the very bottom: if the server has more expense pages, show a load-more row
    // so the user can fetch the next 50.
    if (hasMoreExpenses) {
      items.push({ kind: 'load_more_expenses', isFetching: isFetchingMoreExpenses });
    }

    return items;
  }, [currentPhaseExpenses, visibleOlderPhases, hasMoreOlderPhases, checkpoints.length, hasMoreExpenses, isFetchingMoreExpenses]);

  // ── Derived totals ────────────────────────────────────────────────────────
  const currentPhaseTotalSpend = useMemo(
    () => currentPhaseBalances.reduce((sum, b) => sum + b.total_paid, 0),
    [currentPhaseBalances]
  );

  // ── Mutations ─────────────────────────────────────────────────────────────
  const invalidateAll = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: queryKeys.checkpoints(groupId || '') });
    // Phase balances depend on the latest checkpoint timestamp — invalidate the current key
    queryClient.invalidateQueries({
      queryKey: queryKeys.phaseBalances(groupId || '', latestCheckpointTs),
    });
    queryClient.invalidateQueries({ queryKey: queryKeys.group(groupId || '') });
  }, [queryClient, groupId, latestCheckpointTs]);

  const addCheckpointMutation = useMutation({
    mutationFn: async () => {
      if (!groupId || !user) throw new Error('No group or user');
      const { error } = await supabase
        .from('group_checkpoints')
        .insert({ group_id: groupId, created_by: user.id });
      if (error) throw error;
    },
    onSuccess: () => {
      invalidateAll();
      setLoadedOlderCount(0); // collapse revealed older phases on new checkpoint
    },
  });

  const removeCheckpointMutation = useMutation({
    mutationFn: async (checkpointId: string) => {
      const { error } = await supabase
        .from('group_checkpoints')
        .delete()
        .eq('id', checkpointId);
      if (error) throw error;
    },
    onSuccess: invalidateAll,
  });

  const addCheckpoint = async (): Promise<boolean> => {
    try {
      await addCheckpointMutation.mutateAsync();
      return true;
    } catch {
      return false;
    }
  };

  const removeCheckpoint = async (checkpointId: string): Promise<boolean> => {
    try {
      await removeCheckpointMutation.mutateAsync(checkpointId);
      return true;
    } catch {
      return false;
    }
  };

  const refresh = useCallback(async () => {
    await Promise.all([refreshExpenses(), refetchCheckpoints(), refetchBalances()]);
  }, [refreshExpenses, refetchCheckpoints, refetchBalances]);

  return {
    activityData,
    currentPhaseBalances,
    currentPhaseTotalSpend,
    hasCheckpoints: checkpoints.length > 0,
    isCurrentPhaseEmpty: currentPhaseExpenses.length === 0,
    isFetchingMoreExpenses,
    hasMoreExpenses,
    loadMoreExpenses,
    isLoading: expensesLoading || checkpointsLoading,
    loadOlderPhase,
    addCheckpoint,
    removeCheckpoint,
    refresh,
    createExpense,
    deleteExpense,
    error: expensesError,
  };
}

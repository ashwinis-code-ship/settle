/**
 * Settlements Hook
 * 
 * Manages settlements (debt payments) in a group or between users.
 * Uses TanStack Query for caching and deduplication.
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { syncQueue } from '@/lib/sync-queue';
import { pendingSettlements, generatePendingId, type PendingSettlement } from '@/lib/pending-items';
import { useAuth } from '@/contexts/auth-context';
import { useSync } from '@/contexts/sync-context';
import { queryKeys } from '@/lib/query-client';
import type { Settlement, SettlementFormData, UserSummary, CurrencyCode } from '@/types';
import { useState, useEffect, useMemo } from 'react';

// Extended settlement with pending status
export interface SettlementWithStatus extends Settlement {
  isPending?: boolean;
  canDelete?: boolean;
}

interface UseSettlementsResult {
  settlements: SettlementWithStatus[];
  isLoading: boolean;
  error: string | null;
  createSettlement: (data: SettlementFormData & { paid_by?: string }) => Promise<string | null>;
  updateSettlement: (settlementId: string, data: { amount: number; notes?: string | null }) => Promise<boolean>;
  deleteSettlement: (settlementId: string) => Promise<boolean>;
  refresh: () => Promise<void>;
}

interface UseSettlementsOptions {
  groupId?: string;
  friendId?: string;
}

async function fetchSettlements(
  userId: string,
  options: UseSettlementsOptions
): Promise<Settlement[]> {
  const { groupId, friendId } = options;

  let query = supabase
    .from('settlements')
    .select(`
      *,
      paid_by_user:paid_by (id, name, phone, avatar_url),
      paid_to_user:paid_to (id, name, phone, avatar_url)
    `)
    .order('created_at', { ascending: false });

  // Filter by group if provided
  if (groupId) {
    query = query.eq('group_id', groupId);
  }

  // Filter by friend (either paid_by or paid_to)
  if (friendId) {
    query = query.or(`paid_by.eq.${friendId},paid_to.eq.${friendId}`);
    query = query.or(`paid_by.eq.${userId},paid_to.eq.${userId}`);
  }

  // If no specific filters, get all settlements involving current user
  if (!groupId && !friendId) {
    query = query.or(`paid_by.eq.${userId},paid_to.eq.${userId}`);
  }

  const { data, error: fetchError } = await query;

  if (fetchError) throw fetchError;

  return (data || []).map((s) => ({
    ...s,
    amount: Number(s.amount),
    currency: s.currency as CurrencyCode,
    paid_by_user: s.paid_by_user as UserSummary,
    paid_to_user: s.paid_to_user as UserSummary,
  }));
}

export function useSettlements(options: UseSettlementsOptions = {}): UseSettlementsResult {
  const { groupId, friendId } = options;
  const { user } = useAuth();
  const { isOnline, canEditItem, refreshPendingItems } = useSync();
  const queryClient = useQueryClient();
  const [mutationError, setMutationError] = useState<string | null>(null);
  const [localPendingSettlements, setLocalPendingSettlements] = useState<PendingSettlement[]>([]);

  // Load pending settlements
  useEffect(() => {
    const loadPending = async () => {
      let pending: PendingSettlement[];
      if (groupId) {
        pending = await pendingSettlements.getByGroup(groupId);
      } else if (friendId && user) {
        pending = await pendingSettlements.getByUsers(user.id, friendId);
      } else {
        pending = await pendingSettlements.getAll();
      }
      setLocalPendingSettlements(pending);
    };
    loadPending();
  }, [groupId, friendId, user]);

  // Query for fetching settlements from server
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: queryKeys.settlements({ groupId, friendId }),
    queryFn: () => fetchSettlements(user!.id, options),
    enabled: !!user && isOnline,
    staleTime: 2 * 60 * 1000, // 2 minutes
  });

  // Combine server settlements with pending settlements
  const settlements = useMemo((): SettlementWithStatus[] => {
    const serverSettlements: SettlementWithStatus[] = (data ?? []).map((s) => ({
      ...s,
      isPending: false,
      canDelete: canEditItem(s.id),
    }));

    // Convert pending settlements to full settlements
    const pendingItems: SettlementWithStatus[] = localPendingSettlements.map((p) => ({
      id: p.id,
      group_id: p.group_id,
      paid_by: p.paid_by,
      paid_to: p.paid_to,
      amount: p.amount,
      currency: p.currency,
      notes: p.notes,
      created_at: p.created_at,
      paid_by_user: { id: p.paid_by, name: p.paid_by_name, phone: '', avatar_url: null },
      paid_to_user: { id: p.paid_to, name: p.paid_to_name, phone: '', avatar_url: null },
      isPending: true,
      canDelete: true, // Pending items are always deletable
    }));

    // Combine and sort by date (pending first, then by created_at)
    return [...pendingItems, ...serverSettlements].sort((a, b) => {
      if (a.isPending && !b.isPending) return -1;
      if (!a.isPending && b.isPending) return 1;
      return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
    });
  }, [data, localPendingSettlements, canEditItem]);

  // Helper to invalidate related queries
  const invalidateQueries = () => {
    queryClient.invalidateQueries({ queryKey: queryKeys.settlements({ groupId, friendId }) });
    if (groupId) {
      queryClient.invalidateQueries({ queryKey: queryKeys.group(groupId) });
    }
    queryClient.invalidateQueries({ queryKey: queryKeys.groups });
    queryClient.invalidateQueries({ queryKey: queryKeys.friends });
    queryClient.invalidateQueries({ queryKey: queryKeys.recentActivity });
    if (friendId) {
      queryClient.invalidateQueries({ queryKey: queryKeys.friendDetail(friendId) });
    }
  };

  // Create settlement mutation
  const createSettlementMutation = useMutation({
    mutationFn: async (formData: SettlementFormData & { paid_by?: string }): Promise<string> => {
      if (!user) throw new Error('No user');

      const amount = parseFloat(formData.amount);
      if (isNaN(amount) || amount <= 0) {
        throw new Error('Invalid amount');
      }

      const paidBy = formData.paid_by || user.id;

      const settlementData = {
        paid_by: paidBy,
        paid_to: formData.paid_to,
        amount,
        currency: formData.currency,
        group_id: formData.group_id,
        notes: formData.notes || null,
      };

      // Block offline - screens should prevent this, but guard here too
      if (!isOnline) {
        throw new Error('Settling up requires an internet connection');
      }

      console.log('[useSettlements] Creating settlement:', settlementData);
      const { data: newSettlement, error: createError } = await supabase
        .from('settlements')
        .insert(settlementData)
        .select('id')
        .single();

      console.log('[useSettlements] Result:', { data: newSettlement, error: createError });

      if (createError) throw createError;

      return newSettlement.id;
    },
    onSuccess: invalidateQueries,
    onError: (err) => {
      setMutationError(err instanceof Error ? err.message : 'Failed to create settlement');
    },
  });

  // Update settlement mutation
  const updateSettlementMutation = useMutation({
    mutationFn: async ({
      settlementId,
      amount,
      notes,
    }: {
      settlementId: string;
      amount: number;
      notes?: string | null;
    }) => {
      if (!isOnline) {
        throw new Error('Updating settlements requires an internet connection');
      }
      if (amount <= 0 || isNaN(amount)) {
        throw new Error('Invalid amount');
      }

      const { error: updateError } = await supabase
        .from('settlements')
        .update({ amount, notes: notes ?? null })
        .eq('id', settlementId);

      if (updateError) throw updateError;
    },
    onSuccess: invalidateQueries,
    onError: (err) => {
      setMutationError(err instanceof Error ? err.message : 'Failed to update settlement');
    },
  });

  // Delete settlement mutation
  const deleteSettlementMutation = useMutation({
    mutationFn: async (settlementId: string) => {
      const isPending = settlementId.startsWith('pending_');

      if (isPending) {
        // Delete pending settlement locally
        const pending = await pendingSettlements.get(settlementId);
        if (pending) {
          // Remove from sync queue
          await syncQueue.remove(pending.syncActionId);
          // Remove from pending storage
          await pendingSettlements.remove(settlementId);
          setLocalPendingSettlements((prev) => prev.filter((s) => s.id !== settlementId));
          await refreshPendingItems();
        }
      } else if (isOnline) {
        const { error: deleteError } = await supabase
          .from('settlements')
          .delete()
          .eq('id', settlementId);

        if (deleteError) throw deleteError;
      } else {
        // Can't delete synced items while offline
        throw new Error('Cannot delete synced items while offline');
      }
    },
    onSuccess: invalidateQueries,
    onError: (err) => {
      setMutationError(err instanceof Error ? err.message : 'Failed to delete settlement');
    },
  });

  const createSettlement = async (formData: SettlementFormData & { paid_by?: string }): Promise<string | null> => {
    setMutationError(null);
    try {
      return await createSettlementMutation.mutateAsync(formData);
    } catch {
      return null;
    }
  };

  const updateSettlement = async (
    settlementId: string,
    data: { amount: number; notes?: string | null }
  ): Promise<boolean> => {
    setMutationError(null);
    try {
      await updateSettlementMutation.mutateAsync({
        settlementId,
        amount: data.amount,
        notes: data.notes,
      });
      return true;
    } catch {
      return false;
    }
  };

  const deleteSettlement = async (settlementId: string): Promise<boolean> => {
    setMutationError(null);
    try {
      await deleteSettlementMutation.mutateAsync(settlementId);
      return true;
    } catch {
      return false;
    }
  };

  const refresh = async () => {
    await refetch();
  };

  return {
    settlements,
    isLoading: isLoading && localPendingSettlements.length === 0,
    error: error ? (error instanceof Error ? error.message : 'Failed to fetch settlements') : mutationError,
    createSettlement,
    updateSettlement,
    deleteSettlement,
    refresh,
  };
}

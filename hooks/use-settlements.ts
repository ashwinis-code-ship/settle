/**
 * Settlements Hook
 * 
 * Manages settlements (debt payments) in a group or between users.
 * Uses TanStack Query for caching and deduplication.
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { syncQueue } from '@/lib/sync-queue';
import { useAuth } from '@/contexts/auth-context';
import { useSync } from '@/contexts/sync-context';
import { queryKeys } from '@/lib/query-client';
import type { Settlement, SettlementFormData, UserSummary, CurrencyCode } from '@/types';
import { useState } from 'react';

interface UseSettlementsResult {
  settlements: Settlement[];
  isLoading: boolean;
  error: string | null;
  createSettlement: (data: SettlementFormData & { paid_by?: string }) => Promise<string | null>;
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
  const { isOnline } = useSync();
  const queryClient = useQueryClient();
  const [mutationError, setMutationError] = useState<string | null>(null);

  // Query for fetching settlements
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: queryKeys.settlements({ groupId, friendId }),
    queryFn: () => fetchSettlements(user!.id, options),
    enabled: !!user && isOnline,
    staleTime: 2 * 60 * 1000, // 2 minutes
  });

  // Helper to invalidate related queries
  const invalidateQueries = () => {
    queryClient.invalidateQueries({ queryKey: queryKeys.settlements({ groupId, friendId }) });
    if (groupId) {
      queryClient.invalidateQueries({ queryKey: queryKeys.group(groupId) });
    }
    queryClient.invalidateQueries({ queryKey: queryKeys.groups });
    queryClient.invalidateQueries({ queryKey: queryKeys.friends });
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

      if (isOnline) {
        console.log('[useSettlements] Creating settlement:', settlementData);
        const { data: newSettlement, error: createError } = await supabase
          .from('settlements')
          .insert(settlementData)
          .select('id')
          .single();

        console.log('[useSettlements] Result:', { data: newSettlement, error: createError });

        if (createError) throw createError;

        return newSettlement.id;
      } else {
        await syncQueue.add('CREATE_SETTLEMENT', settlementData);
        return `temp_${Date.now()}`;
      }
    },
    onSuccess: invalidateQueries,
    onError: (err) => {
      setMutationError(err instanceof Error ? err.message : 'Failed to create settlement');
    },
  });

  // Delete settlement mutation
  const deleteSettlementMutation = useMutation({
    mutationFn: async (settlementId: string) => {
      if (isOnline) {
        const { error: deleteError } = await supabase
          .from('settlements')
          .delete()
          .eq('id', settlementId);

        if (deleteError) throw deleteError;
      } else {
        await syncQueue.add('DELETE_SETTLEMENT', { id: settlementId });
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
    settlements: data ?? [],
    isLoading,
    error: error ? (error instanceof Error ? error.message : 'Failed to fetch settlements') : mutationError,
    createSettlement,
    deleteSettlement,
    refresh,
  };
}

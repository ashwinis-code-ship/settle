/**
 * Settlements Hook
 * 
 * Manages settlements (debt payments) in a group or between users.
 */

import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { syncQueue } from '@/lib/sync-queue';
import { useAuth } from '@/contexts/auth-context';
import { useSync } from '@/contexts/sync-context';
import type { Settlement, SettlementFormData, UserSummary, CurrencyCode } from '@/types';

interface UseSettlementsResult {
  settlements: Settlement[];
  isLoading: boolean;
  error: string | null;
  createSettlement: (data: SettlementFormData) => Promise<string | null>;
  deleteSettlement: (settlementId: string) => Promise<boolean>;
  refresh: () => Promise<void>;
}

interface UseSettlementsOptions {
  groupId?: string;
  friendId?: string;
}

export function useSettlements(options: UseSettlementsOptions = {}): UseSettlementsResult {
  const { groupId, friendId } = options;
  const { user } = useAuth();
  const { isOnline } = useSync();
  
  const [settlements, setSettlements] = useState<Settlement[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchSettlements = useCallback(async () => {
    if (!user) {
      setSettlements([]);
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
        // Also filter to only include settlements involving current user
        query = query.or(`paid_by.eq.${user.id},paid_to.eq.${user.id}`);
      }

      // If no specific filters, get all settlements involving current user
      if (!groupId && !friendId) {
        query = query.or(`paid_by.eq.${user.id},paid_to.eq.${user.id}`);
      }

      const { data, error: fetchError } = await query;

      if (fetchError) throw fetchError;

      const settlementsList: Settlement[] = (data || []).map((s) => ({
        ...s,
        amount: Number(s.amount),
        currency: s.currency as CurrencyCode,
        paid_by_user: s.paid_by_user as UserSummary,
        paid_to_user: s.paid_to_user as UserSummary,
      }));

      setSettlements(settlementsList);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to fetch settlements';
      setError(message);
      console.error('[useSettlements] Error:', err);
    } finally {
      setIsLoading(false);
    }
  }, [user, isOnline, groupId, friendId]);

  const createSettlement = useCallback(async (data: SettlementFormData): Promise<string | null> => {
    if (!user) return null;

    const amount = parseFloat(data.amount);
    if (isNaN(amount) || amount <= 0) {
      setError('Invalid amount');
      return null;
    }

    const settlementData = {
      paid_by: user.id,
      paid_to: data.paid_to,
      amount,
      currency: data.currency,
      group_id: data.group_id,
      notes: data.notes || null,
    };

    try {
      if (isOnline) {
        const { data: newSettlement, error: createError } = await supabase
          .from('settlements')
          .insert(settlementData)
          .select('id')
          .single();

        if (createError) throw createError;

        await fetchSettlements();
        return newSettlement.id;
      } else {
        // Queue for later sync
        await syncQueue.add('CREATE_SETTLEMENT', settlementData);
        
        // Optimistic update
        const tempId = `temp_${Date.now()}`;
        const tempSettlement: Settlement = {
          id: tempId,
          ...settlementData,
          created_at: new Date().toISOString(),
          paid_by_user: { id: user.id, name: 'You', phone: '', avatar_url: null },
          paid_to_user: { id: data.paid_to, name: 'Friend', phone: '', avatar_url: null },
        };
        
        setSettlements((prev) => [tempSettlement, ...prev]);
        return tempId;
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create settlement');
      return null;
    }
  }, [user, isOnline, fetchSettlements]);

  const deleteSettlement = useCallback(async (settlementId: string): Promise<boolean> => {
    try {
      // Optimistic update
      setSettlements((prev) => prev.filter((s) => s.id !== settlementId));

      if (isOnline) {
        const { error: deleteError } = await supabase
          .from('settlements')
          .delete()
          .eq('id', settlementId);

        if (deleteError) throw deleteError;
      } else {
        await syncQueue.add('DELETE_SETTLEMENT', { id: settlementId });
      }
      return true;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete settlement');
      await fetchSettlements(); // Rollback
      return false;
    }
  }, [isOnline, fetchSettlements]);

  useEffect(() => {
    fetchSettlements();
  }, [fetchSettlements]);

  return {
    settlements,
    isLoading,
    error,
    createSettlement,
    deleteSettlement,
    refresh: fetchSettlements,
  };
}

/**
 * Sync Manager
 * 
 * Handles synchronization between local storage and Supabase.
 * Processes the sync queue when online and handles conflicts.
 */

import { supabase } from './supabase';
import { syncQueue, type SyncAction, type SyncActionType } from './sync-queue';
import { cache, storage, STORAGE_KEYS } from './storage';
import { pendingExpenses, pendingSettlements } from './pending-items';

// ============================================
// TYPES
// ============================================

export interface SyncResult {
  success: boolean;
  synced: number;
  failed: number;
  errors: string[];
}

// Maximum retry attempts for a single action
const MAX_RETRIES = 3;

// ============================================
// ACTION PROCESSORS
// ============================================

type ActionProcessor = (payload: unknown) => Promise<void>;

const processors: Record<SyncActionType, ActionProcessor> = {
  // Group actions
  CREATE_GROUP: async (payload) => {
    const { name, description, currency, created_by } = payload as {
      name: string;
      description?: string;
      currency: string;
      created_by: string;
    };
    const { error } = await supabase.from('groups').insert({
      name,
      description: description ?? null,
      currency,
      created_by,
    });
    if (error) throw error;
  },

  UPDATE_GROUP: async (payload) => {
    const { id, ...updates } = payload as { id: string; [key: string]: unknown };
    const { error } = await supabase.from('groups').update(updates).eq('id', id);
    if (error) throw error;
  },

  // Soft delete: use RPC function to bypass RLS
  DELETE_GROUP: async (payload) => {
    const { id } = payload as { id: string };
    const { error } = await supabase.rpc('soft_delete_group', { p_group_id: id });
    if (error) throw error;
  },

  // Restore soft-deleted group: use RPC function to bypass RLS
  RESTORE_GROUP: async (payload) => {
    const { id } = payload as { id: string };
    const { error } = await supabase.rpc('restore_group', { p_group_id: id });
    if (error) throw error;
  },

  // Group member actions
  ADD_GROUP_MEMBER: async (payload) => {
    const { group_id, user_id, role } = payload as {
      group_id: string;
      user_id: string;
      role?: string;
    };
    const { error } = await supabase.from('group_members').insert({
      group_id,
      user_id,
      role: role ?? 'member',
    });
    if (error) throw error;
  },

  REMOVE_GROUP_MEMBER: async (payload) => {
    const { group_id, user_id } = payload as { group_id: string; user_id: string };
    const { error } = await supabase
      .from('group_members')
      .delete()
      .eq('group_id', group_id)
      .eq('user_id', user_id);
    if (error) throw error;
  },

  // Expense actions
  CREATE_EXPENSE: async (payload) => {
    const { splits, ...expense } = payload as {
      splits: { user_id: string; amount: number }[];
      [key: string]: unknown;
    };

    // Insert expense
    const { data: expenseData, error: expenseError } = await supabase
      .from('expenses')
      .insert(expense)
      .select('id')
      .single();

    if (expenseError) throw expenseError;

    // Insert splits
    const splitsWithExpenseId = splits.map((split) => ({
      ...split,
      expense_id: expenseData.id,
    }));

    const { error: splitsError } = await supabase
      .from('expense_splits')
      .insert(splitsWithExpenseId);

    if (splitsError) throw splitsError;
  },

  UPDATE_EXPENSE: async (payload) => {
    const { id, splits, ...updates } = payload as {
      id: string;
      splits?: { user_id: string; amount: number }[];
      [key: string]: unknown;
    };

    // Update expense
    const { error: expenseError } = await supabase
      .from('expenses')
      .update(updates)
      .eq('id', id);

    if (expenseError) throw expenseError;

    // Update splits if provided
    if (splits) {
      // Delete old splits
      await supabase.from('expense_splits').delete().eq('expense_id', id);

      // Insert new splits
      const splitsWithExpenseId = splits.map((split) => ({
        ...split,
        expense_id: id,
      }));

      const { error: splitsError } = await supabase
        .from('expense_splits')
        .insert(splitsWithExpenseId);

      if (splitsError) throw splitsError;
    }
  },

  DELETE_EXPENSE: async (payload) => {
    const { id } = payload as { id: string };
    const { error } = await supabase.from('expenses').delete().eq('id', id);
    if (error) throw error;
  },

  // Settlement actions
  CREATE_SETTLEMENT: async (payload) => {
    const { error } = await supabase.from('settlements').insert(payload);
    if (error) throw error;
  },

  DELETE_SETTLEMENT: async (payload) => {
    const { id } = payload as { id: string };
    const { error } = await supabase.from('settlements').delete().eq('id', id);
    if (error) throw error;
  },

  // User actions
  UPDATE_USER: async (payload) => {
    const { id, ...updates } = payload as { id: string; [key: string]: unknown };
    const { error } = await supabase.from('users').update(updates).eq('id', id);
    if (error) throw error;
  },
};

// ============================================
// SYNC MANAGER
// ============================================

export const syncManager = {
  /**
   * Process all pending actions in the queue
   */
  async processQueue(): Promise<SyncResult> {
    const result: SyncResult = {
      success: true,
      synced: 0,
      failed: 0,
      errors: [],
    };

    const actions = await syncQueue.getAll();
    console.log(`[SyncManager] Processing ${actions.length} pending actions`);

    for (const action of actions) {
      try {
        const processor = processors[action.type];
        if (!processor) {
          throw new Error(`Unknown action type: ${action.type}`);
        }

        await processor(action.payload);
        await syncQueue.remove(action.id);
        
        // Remove from pending items after successful sync
        if (action.type === 'CREATE_EXPENSE') {
          await pendingExpenses.removeBySyncActionId(action.id);
        } else if (action.type === 'CREATE_SETTLEMENT') {
          await pendingSettlements.removeBySyncActionId(action.id);
        }
        
        result.synced++;
        console.log(`[SyncManager] Synced action: ${action.type} (${action.id})`);
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        result.failed++;
        result.errors.push(`${action.type}: ${errorMessage}`);

        // Update retry count
        const newRetryCount = action.retryCount + 1;
        if (newRetryCount >= MAX_RETRIES) {
          // Remove failed action after max retries
          console.error(`[SyncManager] Action failed after ${MAX_RETRIES} retries:`, action);
          await syncQueue.remove(action.id);
        } else {
          await syncQueue.update(action.id, {
            retryCount: newRetryCount,
            lastError: errorMessage,
          });
        }
      }
    }

    result.success = result.failed === 0;
    console.log(`[SyncManager] Queue processed: ${result.synced} synced, ${result.failed} failed`);

    return result;
  },

  /**
   * Fetch latest data from server and update cache
   */
  async pullFromServer(userId: string): Promise<void> {
    console.log('[SyncManager] Pulling data from server...');

    try {
      // Fetch user profile
      const { data: user } = await supabase
        .from('users')
        .select('*')
        .eq('id', userId)
        .single();

      if (user) {
        await cache.setUser(user);
      }

      // Fetch groups user is member of
      const { data: groupMembers } = await supabase
        .from('group_members')
        .select('group_id')
        .eq('user_id', userId);

      if (groupMembers && groupMembers.length > 0) {
        const groupIds = groupMembers.map((gm) => gm.group_id);

        const { data: groups } = await supabase
          .from('groups')
          .select('*')
          .in('id', groupIds);

        if (groups) {
          await cache.setGroups(groups);
        }
      }

      // Fetch categories (rarely change)
      const { data: categories } = await supabase
        .from('categories')
        .select('*')
        .order('sort_order');

      if (categories) {
        await cache.setCategories(categories);
      }

      // Update last sync time
      await cache.setLastSync(new Date().toISOString());

      console.log('[SyncManager] Pull complete');
    } catch (error) {
      console.error('[SyncManager] Pull failed:', error);
      throw error;
    }
  },

  /**
   * Full sync: process queue then pull latest data
   */
  async fullSync(userId: string): Promise<SyncResult> {
    // First, process any pending actions
    const queueResult = await this.processQueue();

    // Then pull latest data
    try {
      await this.pullFromServer(userId);
    } catch (error) {
      queueResult.errors.push(
        `Pull failed: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
      queueResult.success = false;
    }

    return queueResult;
  },

  /**
   * Clear all local data (for logout)
   */
  async clearLocalData(): Promise<void> {
    await syncQueue.clear();
    await storage.clearAll();
    console.log('[SyncManager] Local data cleared');
  },
};

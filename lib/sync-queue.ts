/**
 * Sync Queue for Offline Mutations
 * 
 * Queues actions when offline and processes them when back online.
 * Each action is stored with a unique ID and timestamp.
 */

import { storage, STORAGE_KEYS } from './storage';

// ============================================
// TYPES
// ============================================

export type SyncActionType =
  | 'CREATE_GROUP'
  | 'UPDATE_GROUP'
  | 'DELETE_GROUP'
  | 'ADD_GROUP_MEMBER'
  | 'REMOVE_GROUP_MEMBER'
  | 'CREATE_EXPENSE'
  | 'UPDATE_EXPENSE'
  | 'DELETE_EXPENSE'
  | 'CREATE_SETTLEMENT'
  | 'DELETE_SETTLEMENT'
  | 'UPDATE_USER';

export interface SyncAction {
  id: string;
  type: SyncActionType;
  payload: unknown;
  createdAt: string;
  retryCount: number;
  lastError?: string;
}

export type SyncStatus = 'idle' | 'syncing' | 'error';

// ============================================
// HELPERS
// ============================================

function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
}

// ============================================
// SYNC QUEUE OPERATIONS
// ============================================

export const syncQueue = {
  /**
   * Get all pending actions
   */
  async getAll(): Promise<SyncAction[]> {
    const actions = await storage.get<SyncAction[]>(STORAGE_KEYS.SYNC_QUEUE);
    return actions ?? [];
  },

  /**
   * Add an action to the queue
   */
  async add(type: SyncActionType, payload: unknown): Promise<SyncAction> {
    const action: SyncAction = {
      id: generateId(),
      type,
      payload,
      createdAt: new Date().toISOString(),
      retryCount: 0,
    };

    const actions = await this.getAll();
    actions.push(action);
    await storage.set(STORAGE_KEYS.SYNC_QUEUE, actions);

    console.log(`[SyncQueue] Added action: ${type}`, action.id);
    return action;
  },

  /**
   * Remove an action from the queue (after successful sync)
   */
  async remove(actionId: string): Promise<void> {
    const actions = await this.getAll();
    const filtered = actions.filter((a) => a.id !== actionId);
    await storage.set(STORAGE_KEYS.SYNC_QUEUE, filtered);
    console.log(`[SyncQueue] Removed action: ${actionId}`);
  },

  /**
   * Update an action (e.g., increment retry count)
   */
  async update(actionId: string, updates: Partial<SyncAction>): Promise<void> {
    const actions = await this.getAll();
    const index = actions.findIndex((a) => a.id === actionId);
    if (index !== -1) {
      actions[index] = { ...actions[index], ...updates };
      await storage.set(STORAGE_KEYS.SYNC_QUEUE, actions);
    }
  },

  /**
   * Clear all actions (after full sync or logout)
   */
  async clear(): Promise<void> {
    await storage.set(STORAGE_KEYS.SYNC_QUEUE, []);
    console.log('[SyncQueue] Cleared all actions');
  },

  /**
   * Get count of pending actions
   */
  async count(): Promise<number> {
    const actions = await this.getAll();
    return actions.length;
  },

  /**
   * Check if there are pending actions
   */
  async hasPending(): Promise<boolean> {
    const count = await this.count();
    return count > 0;
  },
};

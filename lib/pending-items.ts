/**
 * Pending Items Manager
 * 
 * Manages items created offline that haven't been synced yet.
 * These items are editable/deletable while offline.
 */

import { storage, STORAGE_KEYS } from './storage';
import type { CurrencyCode } from '@/types';

// ============================================
// TYPES
// ============================================

export interface PendingExpense {
  id: string; // Local temp ID (temp_timestamp)
  syncActionId: string; // Reference to sync queue action
  group_id: string;
  paid_by: string;
  paid_by_name: string;
  amount: number;
  currency: CurrencyCode;
  description: string;
  category_id: string | null;
  category_icon?: string;
  notes: string | null;
  expense_date: string;
  created_by: string;
  created_at: string;
  splits: { user_id: string; amount: number }[];
}

export interface PendingSettlement {
  id: string; // Local temp ID
  syncActionId: string; // Reference to sync queue action
  group_id: string | null;
  paid_by: string;
  paid_by_name: string;
  paid_to: string;
  paid_to_name: string;
  amount: number;
  currency: CurrencyCode;
  notes: string | null;
  created_at: string;
}

// ============================================
// PENDING EXPENSES
// ============================================

export const pendingExpenses = {
  async getAll(): Promise<PendingExpense[]> {
    const items = await storage.get<PendingExpense[]>(STORAGE_KEYS.PENDING_EXPENSES);
    return items ?? [];
  },

  async getByGroup(groupId: string): Promise<PendingExpense[]> {
    const items = await this.getAll();
    return items.filter((item) => item.group_id === groupId);
  },

  async add(expense: PendingExpense): Promise<void> {
    const items = await this.getAll();
    items.push(expense);
    await storage.set(STORAGE_KEYS.PENDING_EXPENSES, items);
    console.log('[PendingItems] Added expense:', expense.id);
  },

  async update(id: string, updates: Partial<PendingExpense>): Promise<boolean> {
    const items = await this.getAll();
    const index = items.findIndex((item) => item.id === id);
    if (index === -1) return false;
    
    items[index] = { ...items[index], ...updates };
    await storage.set(STORAGE_KEYS.PENDING_EXPENSES, items);
    console.log('[PendingItems] Updated expense:', id);
    return true;
  },

  async remove(id: string): Promise<boolean> {
    const items = await this.getAll();
    const filtered = items.filter((item) => item.id !== id);
    if (filtered.length === items.length) return false;
    
    await storage.set(STORAGE_KEYS.PENDING_EXPENSES, filtered);
    console.log('[PendingItems] Removed expense:', id);
    return true;
  },

  async removeBySyncActionId(syncActionId: string): Promise<boolean> {
    const items = await this.getAll();
    const filtered = items.filter((item) => item.syncActionId !== syncActionId);
    if (filtered.length === items.length) return false;
    
    await storage.set(STORAGE_KEYS.PENDING_EXPENSES, filtered);
    console.log('[PendingItems] Removed expense by syncActionId:', syncActionId);
    return true;
  },

  async get(id: string): Promise<PendingExpense | null> {
    const items = await this.getAll();
    return items.find((item) => item.id === id) ?? null;
  },

  async clear(): Promise<void> {
    await storage.set(STORAGE_KEYS.PENDING_EXPENSES, []);
    console.log('[PendingItems] Cleared all pending expenses');
  },
};

// ============================================
// PENDING SETTLEMENTS
// ============================================

export const pendingSettlements = {
  async getAll(): Promise<PendingSettlement[]> {
    const items = await storage.get<PendingSettlement[]>(STORAGE_KEYS.PENDING_SETTLEMENTS);
    return items ?? [];
  },

  async getByGroup(groupId: string | null): Promise<PendingSettlement[]> {
    const items = await this.getAll();
    return items.filter((item) => item.group_id === groupId);
  },

  async getByUsers(userId1: string, userId2: string): Promise<PendingSettlement[]> {
    const items = await this.getAll();
    return items.filter(
      (item) =>
        (item.paid_by === userId1 && item.paid_to === userId2) ||
        (item.paid_by === userId2 && item.paid_to === userId1)
    );
  },

  async add(settlement: PendingSettlement): Promise<void> {
    const items = await this.getAll();
    items.push(settlement);
    await storage.set(STORAGE_KEYS.PENDING_SETTLEMENTS, items);
    console.log('[PendingItems] Added settlement:', settlement.id);
  },

  async remove(id: string): Promise<boolean> {
    const items = await this.getAll();
    const filtered = items.filter((item) => item.id !== id);
    if (filtered.length === items.length) return false;
    
    await storage.set(STORAGE_KEYS.PENDING_SETTLEMENTS, filtered);
    console.log('[PendingItems] Removed settlement:', id);
    return true;
  },

  async removeBySyncActionId(syncActionId: string): Promise<boolean> {
    const items = await this.getAll();
    const filtered = items.filter((item) => item.syncActionId !== syncActionId);
    if (filtered.length === items.length) return false;
    
    await storage.set(STORAGE_KEYS.PENDING_SETTLEMENTS, filtered);
    console.log('[PendingItems] Removed settlement by syncActionId:', syncActionId);
    return true;
  },

  async get(id: string): Promise<PendingSettlement | null> {
    const items = await this.getAll();
    return items.find((item) => item.id === id) ?? null;
  },

  async clear(): Promise<void> {
    await storage.set(STORAGE_KEYS.PENDING_SETTLEMENTS, []);
    console.log('[PendingItems] Cleared all pending settlements');
  },
};

// ============================================
// HELPERS
// ============================================

/**
 * Check if an ID is a pending (offline-created) item
 */
export function isPendingId(id: string): boolean {
  return id.startsWith('pending_');
}

/**
 * Generate a pending ID
 */
export function generatePendingId(): string {
  return `pending_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
}

/**
 * Sync Context
 * 
 * Provides sync state and network status to the entire app.
 * Automatically syncs when coming back online.
 */

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from 'react';
import { useNetworkStatus } from '@/hooks/use-network-status';
import { syncManager, type SyncResult } from '@/lib/sync-manager';
import { syncQueue } from '@/lib/sync-queue';
import { pendingExpenses, pendingSettlements, type PendingExpense, type PendingSettlement } from '@/lib/pending-items';
import { useAuth } from './auth-context';
import { queryClient } from '@/lib/query-client';

// ============================================
// TYPES
// ============================================

export type SyncStatus = 'idle' | 'syncing' | 'success' | 'error';

interface SyncContextType {
  // Network state
  isOnline: boolean;
  
  // Sync state
  syncStatus: SyncStatus;
  pendingCount: number;
  lastSyncResult: SyncResult | null;
  lastSyncTime: Date | null;
  
  // Pending items (for display)
  pendingExpensesList: PendingExpense[];
  pendingSettlementsList: PendingSettlement[];
  
  // Actions
  sync: () => Promise<SyncResult | null>;
  refreshNetworkStatus: () => Promise<void>;
  refreshPendingItems: () => Promise<void>;
  
  // Helpers
  isPendingItem: (id: string) => boolean;
  canEditItem: (id: string) => boolean;
}

const SyncContext = createContext<SyncContextType | undefined>(undefined);

// ============================================
// PROVIDER
// ============================================

export function SyncProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const { isOnline, refresh: refreshNetworkStatus } = useNetworkStatus();
  
  const [syncStatus, setSyncStatus] = useState<SyncStatus>('idle');
  const [pendingCount, setPendingCount] = useState(0);
  const [lastSyncResult, setLastSyncResult] = useState<SyncResult | null>(null);
  const [lastSyncTime, setLastSyncTime] = useState<Date | null>(null);
  const [wasOffline, setWasOffline] = useState(false);
  const [pendingExpensesList, setPendingExpensesList] = useState<PendingExpense[]>([]);
  const [pendingSettlementsList, setPendingSettlementsList] = useState<PendingSettlement[]>([]);

  // Refresh pending items from storage
  const refreshPendingItems = useCallback(async () => {
    const [expenses, settlements] = await Promise.all([
      pendingExpenses.getAll(),
      pendingSettlements.getAll(),
    ]);
    setPendingExpensesList(expenses);
    setPendingSettlementsList(settlements);
    setPendingCount(expenses.length + settlements.length);
  }, []);

  // Update pending count
  const updatePendingCount = useCallback(async () => {
    const count = await syncQueue.count();
    setPendingCount(count);
    await refreshPendingItems();
  }, [refreshPendingItems]);

  // Check if an ID is a pending (offline-created) item
  const isPendingItem = useCallback((id: string): boolean => {
    return id.startsWith('pending_');
  }, []);

  // Check if an item can be edited (online, or pending item when offline)
  const canEditItem = useCallback((id: string): boolean => {
    if (isOnline) return true; // Can edit everything when online
    return isPendingItem(id); // Offline: can only edit pending items
  }, [isOnline, isPendingItem]);

  // Sync function
  const sync = useCallback(async (): Promise<SyncResult | null> => {
    if (!user || !isOnline) {
      console.log('[SyncContext] Cannot sync: no user or offline');
      return null;
    }

    setSyncStatus('syncing');
    try {
      const result = await syncManager.fullSync(user.id);
      setLastSyncResult(result);
      setLastSyncTime(new Date());
      setSyncStatus(result.success ? 'success' : 'error');
      await updatePendingCount();
      
      // Invalidate all queries to get fresh data after sync
      if (result.synced > 0) {
        queryClient.invalidateQueries();
      }
      
      return result;
    } catch (error) {
      console.error('[SyncContext] Sync failed:', error);
      setSyncStatus('error');
      return null;
    }
  }, [user, isOnline, updatePendingCount]);

  // Update pending count on mount and when user changes
  useEffect(() => {
    updatePendingCount();
  }, [updatePendingCount, user]);

  // Track offline -> online transitions
  useEffect(() => {
    if (!isOnline) {
      setWasOffline(true);
    }
  }, [isOnline]);

  // Auto-sync when coming back online
  useEffect(() => {
    if (isOnline && wasOffline && user) {
      console.log('[SyncContext] Back online, triggering sync...');
      setWasOffline(false);
      sync();
    }
  }, [isOnline, wasOffline, user, sync]);

  // Initial sync on login
  useEffect(() => {
    if (user && isOnline && syncStatus === 'idle') {
      sync();
    }
  }, [user, isOnline, syncStatus, sync]);

  return (
    <SyncContext.Provider
      value={{
        isOnline,
        syncStatus,
        pendingCount,
        lastSyncResult,
        lastSyncTime,
        pendingExpensesList,
        pendingSettlementsList,
        sync,
        refreshNetworkStatus,
        refreshPendingItems,
        isPendingItem,
        canEditItem,
      }}
    >
      {children}
    </SyncContext.Provider>
  );
}

// ============================================
// HOOK
// ============================================

export function useSync() {
  const context = useContext(SyncContext);
  if (context === undefined) {
    throw new Error('useSync must be used within a SyncProvider');
  }
  return context;
}

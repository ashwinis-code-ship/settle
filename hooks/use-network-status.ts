/**
 * Network Status Hook
 * 
 * Monitors network connectivity and provides online/offline state.
 * Uses expo-network for accurate detection across platforms.
 */

import { useEffect, useState, useCallback } from 'react';
import { AppState, type AppStateStatus } from 'react-native';

// Simple online detection using fetch
async function checkOnline(): Promise<boolean> {
  try {
    // Try to reach Supabase (or any reliable endpoint)
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000);
    
    const response = await fetch('https://www.google.com/generate_204', {
      method: 'HEAD',
      signal: controller.signal,
    });
    
    clearTimeout(timeoutId);
    return response.ok;
  } catch {
    return false;
  }
}

export interface NetworkStatus {
  isOnline: boolean;
  isChecking: boolean;
  lastChecked: Date | null;
  refresh: () => Promise<void>;
}

export function useNetworkStatus(): NetworkStatus {
  const [isOnline, setIsOnline] = useState(true); // Assume online initially
  const [isChecking, setIsChecking] = useState(false);
  const [lastChecked, setLastChecked] = useState<Date | null>(null);

  const refresh = useCallback(async () => {
    setIsChecking(true);
    try {
      const online = await checkOnline();
      setIsOnline(online);
      setLastChecked(new Date());
    } catch {
      setIsOnline(false);
    } finally {
      setIsChecking(false);
    }
  }, []);

  // Check on mount
  useEffect(() => {
    refresh();
  }, [refresh]);

  // Check when app comes to foreground
  useEffect(() => {
    const handleAppStateChange = (nextAppState: AppStateStatus) => {
      if (nextAppState === 'active') {
        refresh();
      }
    };

    const subscription = AppState.addEventListener('change', handleAppStateChange);
    return () => subscription.remove();
  }, [refresh]);

  // Periodic check every 30 seconds when online
  useEffect(() => {
    if (!isOnline) return;

    const interval = setInterval(refresh, 30000);
    return () => clearInterval(interval);
  }, [isOnline, refresh]);

  return {
    isOnline,
    isChecking,
    lastChecked,
    refresh,
  };
}

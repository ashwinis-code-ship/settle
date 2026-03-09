/**
 * TanStack Query Client
 * 
 * Centralized query client for caching and state management.
 * Import queryClient to invalidate queries after mutations.
 */

import { QueryClient } from '@tanstack/react-query';

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30 * 1000, // 30 seconds - responsive to realtime updates
      gcTime: 10 * 60 * 1000, // 10 minutes (formerly cacheTime)
      retry: 1,
      refetchOnWindowFocus: true, // Refetch when app comes to foreground
      refetchOnReconnect: true, // Refetch when network reconnects
    },
  },
});

// Query keys for consistent cache management
export const queryKeys = {
  friends: ['friends'] as const,
  groups: ['groups'] as const,
  group: (id: string) => ['group', id] as const,
  expenses: (groupId: string) => ['expenses', 'v2', groupId] as const,
  settlements: (params?: { groupId?: string; friendId?: string }) => 
    ['settlements', params] as const,
  friendDetail: (id: string) => ['friendDetail', id] as const,
  recentActivity: ['recentActivity'] as const,
};

/**
 * Recent Activity Hook
 * 
 * Fetches recent expenses and settlements across all user's groups.
 * Uses TanStack Query for caching.
 */

import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/auth-context';
import { useSync } from '@/contexts/sync-context';
import type { CurrencyCode, UserSummary } from '@/types';

export interface ActivityItem {
  id: string;
  type: 'expense' | 'settlement';
  description: string;
  amount: number;
  currency: CurrencyCode;
  /** Display date (expense_date for expenses, created_at for settlements) */
  date: string;
  /** Timestamp for sorting (created_at for both) */
  created_at: string;
  group_id: string | null;
  group_name: string | null;
  paid_by: UserSummary;
  /** For expenses: your share amount. For settlements: null */
  your_share?: number;
  /** For settlements: who received the payment */
  paid_to?: UserSummary;
  /** Category icon for expenses */
  category_icon?: string;
}

async function fetchRecentActivity(userId: string): Promise<ActivityItem[]> {
  // Get user's groups
  const { data: memberData } = await supabase
    .from('group_members')
    .select('group_id')
    .eq('user_id', userId);

  if (!memberData || memberData.length === 0) {
    return [];
  }

  const groupIds = memberData.map(m => m.group_id);

  // Fetch group names
  const { data: groupsData } = await supabase
    .from('groups')
    .select('id, name')
    .in('id', groupIds)
    .is('deleted_at', null);

  const groupMap = new Map<string, string>();
  groupsData?.forEach(g => groupMap.set(g.id, g.name));

  // Fetch recent expenses (last 10)
  const { data: expensesData } = await supabase
    .from('expenses')
    .select(`
      id,
      description,
      amount,
      currency,
      expense_date,
      created_at,
      group_id,
      paid_by,
      paid_by_user:paid_by (id, name, phone, avatar_url),
      category:category_id (icon)
    `)
    .in('group_id', groupIds)
    .order('created_at', { ascending: false })
    .limit(10);

  // Get user's splits for these expenses
  const expenseIds = expensesData?.map(e => e.id) || [];
  const { data: splitsData } = await supabase
    .from('expense_splits')
    .select('expense_id, amount')
    .in('expense_id', expenseIds)
    .eq('user_id', userId);

  const splitMap = new Map<string, number>();
  splitsData?.forEach(s => splitMap.set(s.expense_id, Number(s.amount)));

  // Fetch recent settlements (last 10)
  const { data: settlementsData } = await supabase
    .from('settlements')
    .select(`
      id,
      amount,
      currency,
      created_at,
      group_id,
      notes,
      paid_by,
      paid_to,
      paid_by_user:paid_by (id, name, phone, avatar_url),
      paid_to_user:paid_to (id, name, phone, avatar_url)
    `)
    .or(`paid_by.eq.${userId},paid_to.eq.${userId}`)
    .order('created_at', { ascending: false })
    .limit(10);

  // Transform expenses to activity items
  const expenseActivities: ActivityItem[] = (expensesData || []).map(e => ({
    id: e.id,
    type: 'expense' as const,
    description: e.description,
    amount: Number(e.amount),
    currency: e.currency as CurrencyCode,
    date: e.expense_date,
    created_at: e.created_at,
    group_id: e.group_id,
    group_name: groupMap.get(e.group_id) || null,
    paid_by: e.paid_by_user as unknown as UserSummary,
    your_share: e.paid_by === userId ? 0 : (splitMap.get(e.id) || 0),
    category_icon: (e.category as any)?.icon || undefined,
  }));

  // Transform settlements to activity items
  const settlementActivities: ActivityItem[] = (settlementsData || []).map(s => ({
    id: s.id,
    type: 'settlement' as const,
    description: s.notes || 'Settlement',
    amount: Number(s.amount),
    currency: s.currency as CurrencyCode,
    date: s.created_at,
    created_at: s.created_at,
    group_id: s.group_id,
    group_name: s.group_id ? (groupMap.get(s.group_id) || null) : null,
    paid_by: s.paid_by_user as unknown as UserSummary,
    paid_to: s.paid_to_user as unknown as UserSummary,
  }));

  // Combine and sort by created_at (most recent first)
  const allActivities = [...expenseActivities, ...settlementActivities];
  allActivities.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

  // Return top 10
  return allActivities.slice(0, 10);
}

interface UseRecentActivityResult {
  activities: ActivityItem[];
  isLoading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
}

export function useRecentActivity(): UseRecentActivityResult {
  const { user } = useAuth();
  const { isOnline } = useSync();

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['recentActivity'],
    queryFn: () => fetchRecentActivity(user!.id),
    enabled: !!user && isOnline,
    staleTime: 2 * 60 * 1000, // 2 minutes
  });

  return {
    activities: data ?? [],
    isLoading,
    error: error ? (error instanceof Error ? error.message : 'Failed to fetch activity') : null,
    refresh: async () => { await refetch(); },
  };
}

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
import { cache } from '@/lib/storage';
import type { CurrencyCode, UserSummary } from '@/types';

export interface ActivityItem {
  id: string;
  type: 'expense' | 'settlement' | 'expense_group';
  description: string;
  amount: number;
  currency: CurrencyCode;
  /** Display date (expense_date for expenses, created_at for settlements/groups) */
  date: string;
  /** Timestamp for sorting (created_at for both) */
  created_at: string;
  group_id: string | null;
  group_name: string | null;
  paid_by: UserSummary;
  /** For expenses/expense_group: your share amount. For settlements: null */
  your_share?: number;
  /** For settlements: who received the payment */
  paid_to?: UserSummary;
  /** Category icon for expenses / expense_group */
  category_icon?: string;
  /** Number of parts (expense_group only) */
  line_count?: number;
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

  // Grouped-by-default: all expenses are expense_groups (no standalone fetch)

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

  // Fetch recent expense_groups (grouped-by-default: all expenses appear here, 1 line = single expense)
  const { data: expenseGroupsData } = await supabase
    .from('expense_groups')
    .select(`
      id,
      description,
      created_at,
      group_id,
      paid_by,
      paid_by_user:paid_by (id, name, phone, avatar_url),
      category:category_id (icon)
    `)
    .in('group_id', groupIds)
    .order('created_at', { ascending: false })
    .limit(20);

  const egIds = expenseGroupsData?.map(eg => eg.id) || [];
  let expenseGroupActivities: ActivityItem[] = [];

  if (egIds.length > 0) {
    const { data: childExpenses } = await supabase
      .from('expenses')
      .select('id, amount, currency, expense_group_id')
      .in('expense_group_id', egIds);

    const childByGroup = new Map<string, { id: string; amount: number; currency: string }[]>();
    childExpenses?.forEach(ce => {
      const list = childByGroup.get(ce.expense_group_id) || [];
      list.push({ id: ce.id, amount: Number(ce.amount), currency: ce.currency });
      childByGroup.set(ce.expense_group_id, list);
    });

    const allChildIds = childExpenses?.map(ce => ce.id) || [];
    const { data: egSplits } = await supabase
      .from('expense_splits')
      .select('expense_id, amount')
      .in('expense_id', allChildIds)
      .eq('user_id', userId);

    const egSplitMap = new Map<string, number>();
    egSplits?.forEach(s => egSplitMap.set(s.expense_id, Number(s.amount)));

    expenseGroupActivities = (expenseGroupsData || []).map(eg => {
      const children = childByGroup.get(eg.id) || [];
      const total = children.reduce((sum, c) => sum + c.amount, 0);
      const your_share = children.reduce((sum, c) => sum + (egSplitMap.get(c.id) || 0), 0);
      const currency = children[0]?.currency ?? 'INR';

      return {
        id: eg.id,
        type: 'expense_group' as const,
        description: eg.description,
        amount: total,
        currency: currency as CurrencyCode,
        date: eg.created_at,
        created_at: eg.created_at,
        group_id: eg.group_id,
        group_name: groupMap.get(eg.group_id) || null,
        paid_by: eg.paid_by_user as unknown as UserSummary,
        your_share: eg.paid_by === userId ? 0 : your_share,
        category_icon: (eg.category as { icon?: string })?.icon || undefined,
        line_count: children.length,
      };
    });
  }

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
  const allActivities = [...expenseGroupActivities, ...settlementActivities];
  allActivities.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

  // Return top 10
  const result = allActivities.slice(0, 10);

  // Cache the result for offline access
  await cache.setRecentActivity(result);

  return result;
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
    queryFn: async () => {
      // Return cached data when offline
      if (!isOnline) {
        return cache.getRecentActivity<ActivityItem>();
      }
      
      // Online: try to fetch, but catch network errors gracefully
      try {
        return await fetchRecentActivity(user!.id);
      } catch (err) {
        // If network error and we have cache, return cache instead
        const cached = await cache.getRecentActivity<ActivityItem>();
        if (cached && cached.length > 0) {
          console.log('[useRecentActivity] Network error, using cached data');
          return cached;
        }
        throw err; // Re-throw if no cache available
      }
    },
    enabled: !!user, // Allow query to run offline (will use cache)
    staleTime: 2 * 60 * 1000, // 2 minutes
    refetchOnMount: isOnline ? 'always' : false, // Only refetch when online
  });

  return {
    activities: data ?? [],
    isLoading,
    error: error ? (error instanceof Error ? error.message : 'Failed to fetch activity') : null,
    refresh: async () => { await refetch(); },
  };
}

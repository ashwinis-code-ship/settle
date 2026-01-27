/**
 * Group Detail Screen
 * 
 * Shows group information, member balances, and expenses list.
 */

import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { MotiView } from 'moti';
import { useCallback, useMemo } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { colors } from '@/constants/colors';
import { useAuth } from '@/contexts/auth-context';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useExpenses } from '@/hooks/use-expenses';
import { useGroup } from '@/hooks/use-group';
import { useSettlements } from '@/hooks/use-settlements';
import type { ExpenseListItem, Settlement } from '@/types';

// Union type for activity items (expense or settlement)
type ActivityItem = 
  | { type: 'expense'; data: ExpenseListItem }
  | { type: 'settlement'; data: Settlement };

// Utility functions
const getInitials = (name: string) => {
  return name
    .split(' ')
    .map(n => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);
};

const formatCurrency = (amount: number, currency: string = 'INR') => {
  const symbols: Record<string, string> = {
    INR: '₹',
    USD: '$',
    EUR: '€',
    GBP: '£',
  };
  const symbol = symbols[currency] || currency;
  return `${symbol}${Math.abs(amount).toFixed(2)}`;
};

const formatDate = (dateStr: string) => {
  const date = new Date(dateStr);
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);

  if (date.toDateString() === today.toDateString()) {
    return 'Today';
  } else if (date.toDateString() === yesterday.toDateString()) {
    return 'Yesterday';
  } else {
    return date.toLocaleDateString('en-IN', {
      day: 'numeric',
      month: 'short',
      year: date.getFullYear() !== today.getFullYear() ? 'numeric' : undefined,
    });
  }
};

export default function GroupDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const colorScheme = useColorScheme() ?? 'light';
  const isDark = colorScheme === 'dark';
  const { user } = useAuth();

  const { group, isLoading: isLoadingGroup, refresh: refreshGroup } = useGroup(id);
  const { expenses, isLoading: isLoadingExpenses, refresh: refreshExpenses } = useExpenses(id);
  const { settlements, isLoading: isLoadingSettlements, refresh: refreshSettlements } = useSettlements({ groupId: id });

  // Theme colors
  const textColor = isDark ? colors.text.dark.primary : colors.text.light.primary;
  const secondaryTextColor = isDark ? colors.text.dark.secondary : colors.text.light.secondary;
  const backgroundColor = isDark ? colors.background.dark : colors.background.light;
  const cardBg = isDark ? colors.gray[800] : colors.white;

  const isLoading = isLoadingGroup || isLoadingExpenses || isLoadingSettlements;

  // Combine expenses and settlements into a single activity list
  const activityList = useMemo((): ActivityItem[] => {
    const expenseItems: ActivityItem[] = expenses.map((e) => ({ type: 'expense' as const, data: e }));
    const settlementItems: ActivityItem[] = settlements.map((s) => ({ type: 'settlement' as const, data: s }));
    
    // Combine and sort by date (newest first)
    return [...expenseItems, ...settlementItems].sort((a, b) => {
      const dateA = a.type === 'expense' ? a.data.expense_date : a.data.created_at;
      const dateB = b.type === 'expense' ? b.data.expense_date : b.data.created_at;
      return new Date(dateB).getTime() - new Date(dateA).getTime();
    });
  }, [expenses, settlements]);

  const handleBack = () => {
    router.back();
  };

  const handleRefresh = useCallback(async () => {
    await Promise.all([refreshGroup(), refreshExpenses(), refreshSettlements()]);
  }, [refreshGroup, refreshExpenses, refreshSettlements]);

  const handleAddExpense = () => {
    // TODO: Navigate to add expense screen
    router.push(`/add-expense?groupId=${id}`);
  };

  const handleSettings = () => {
    router.push(`/group/${id}/settings`);
  };

  // Sort balances - show current user first, then by net balance
  const sortedBalances = useMemo(() => {
    if (!group?.balances) return [];
    return [...group.balances].sort((a, b) => {
      if (a.user.id === user?.id) return -1;
      if (b.user.id === user?.id) return 1;
      return b.net_balance - a.net_balance;
    });
  }, [group?.balances, user?.id]);

  const renderHeader = () => (
    <>
      {/* Group Info Card */}
      <MotiView
        from={{ opacity: 0, translateY: 20 }}
        animate={{ opacity: 1, translateY: 0 }}
        transition={{ type: 'timing', duration: 400, delay: 100 }}
        style={[styles.groupInfoCard, { backgroundColor: cardBg }]}
      >
        <View style={[styles.groupIcon, { backgroundColor: colors.primary[500] }]}>
          <Ionicons name="people" size={32} color={colors.white} />
        </View>
        <View style={styles.groupDetails}>
          <Text style={[styles.groupName, { color: textColor }]} numberOfLines={1}>
            {group?.name || 'Loading...'}
          </Text>
          <Text style={[styles.memberCount, { color: secondaryTextColor }]}>
            {group?.members.length || 0} members
          </Text>
        </View>
      </MotiView>

      {/* Contributions - Stacked Bar */}
      <MotiView
        from={{ opacity: 0, translateY: 20 }}
        animate={{ opacity: 1, translateY: 0 }}
        transition={{ type: 'timing', duration: 400, delay: 200 }}
        style={styles.section}
      >
        <View style={styles.contributionHeaderRow}>
          <Text style={[styles.sectionTitle, { color: textColor, marginBottom: 0 }]}>Contributions</Text>
          <Text style={[styles.totalSpendingValue, { color: textColor }]}>
            {formatCurrency(sortedBalances.reduce((sum, b) => sum + b.total_paid, 0))}
          </Text>
        </View>
        <View style={[styles.stackedBarCard, { backgroundColor: cardBg }]}>
          {sortedBalances.length === 0 || sortedBalances.reduce((sum, b) => sum + b.total_paid, 0) === 0 ? (
            <Text style={[styles.emptyText, { color: secondaryTextColor }]}>
              No expenses yet
            </Text>
          ) : (
            (() => {
              const totalPaid = sortedBalances.reduce((sum, b) => sum + b.total_paid, 0);
              const contributionColors = [
                colors.primary[500],
                colors.success,
                '#9333EA',
                '#F97316',
                '#06B6D4',
                '#EC4899',
                '#14B8A6',
                colors.warning,
              ];
              
              // Sort by contribution (highest first) and filter out zero contributors
              const contributors = sortedBalances
                .map((b, i) => ({
                  ...b,
                  percentage: (b.total_paid / totalPaid) * 100,
                  color: contributionColors[i % contributionColors.length],
                }))
                .sort((a, b) => b.total_paid - a.total_paid);
              
              return (
                <>
                  {/* Stacked Bar */}
                  <View style={styles.stackedBarContainer}>
                    {contributors.map((contributor, index) => {
                      const isFirst = index === 0;
                      const isLast = index === contributors.length - 1;
                      const showInitials = contributor.percentage >= 12; // Only show initials if segment is wide enough
                      
                      if (contributor.percentage === 0) return null;
                      
                      return (
                        <View
                          key={contributor.user.id}
                          style={[
                            styles.stackedBarSegment,
                            {
                              width: `${contributor.percentage}%`,
                              backgroundColor: contributor.color,
                              borderTopLeftRadius: isFirst ? 8 : 0,
                              borderBottomLeftRadius: isFirst ? 8 : 0,
                              borderTopRightRadius: isLast ? 8 : 0,
                              borderBottomRightRadius: isLast ? 8 : 0,
                            },
                          ]}
                        >
                          {showInitials && (
                            <Text style={styles.stackedBarInitials}>
                              {contributor.user.id === user?.id ? 'You' : getInitials(contributor.user.name)}
                            </Text>
                          )}
                        </View>
                      );
                    })}
                  </View>
                  
                  {/* Legend */}
                  <View style={styles.stackedBarLegend}>
                    {contributors.map((contributor) => (
                      <View key={contributor.user.id} style={styles.legendItem}>
                        <View style={[styles.legendDot, { backgroundColor: contributor.color }]} />
                        <Text style={[styles.legendText, { color: secondaryTextColor }]} numberOfLines={1}>
                          {contributor.user.id === user?.id ? 'You' : contributor.user.name.split(' ')[0]}
                        </Text>
                        <Text style={[styles.legendAmount, { color: textColor }]}>
                          {formatCurrency(contributor.total_paid)}
                        </Text>
                      </View>
                    ))}
                  </View>
                </>
              );
            })()
          )}
        </View>
      </MotiView>

      {/* Expenses Header */}
      <MotiView
        from={{ opacity: 0, translateY: 20 }}
        animate={{ opacity: 1, translateY: 0 }}
        transition={{ type: 'timing', duration: 400, delay: 300 }}
        style={styles.expensesHeader}
      >
        <Text style={[styles.sectionTitle, { color: textColor }]}>Activity</Text>
        <Pressable
          onPress={handleAddExpense}
          style={({ pressed }) => [
            styles.addExpenseButton,
            { backgroundColor: colors.primary[500], opacity: pressed ? 0.8 : 1 },
          ]}
        >
          <Ionicons name="add" size={18} color={colors.white} />
          <Text style={styles.addExpenseText}>Add</Text>
        </Pressable>
      </MotiView>
    </>
  );

  const handleExpensePress = (expenseId: string) => {
    router.push(`/expense/${expenseId}`);
  };

  const renderSettlementItem = (settlement: Settlement, index: number) => {
    const isYouPayer = settlement.paid_by === user?.id;
    const payerName = isYouPayer ? 'You' : settlement.paid_by_user?.name || 'Someone';
    const receiverName = settlement.paid_to === user?.id ? 'you' : settlement.paid_to_user?.name || 'someone';

    return (
      <MotiView
        key={settlement.id}
        from={{ opacity: 0, translateX: -20 }}
        animate={{ opacity: 1, translateX: 0 }}
        transition={{ type: 'timing', duration: 300, delay: Math.min(index * 50, 300) }}
      >
        <View style={[styles.expenseItem, { backgroundColor: cardBg }]}>
          {/* Settlement Icon */}
          <View style={[styles.expenseIcon, { backgroundColor: colors.success + '20' }]}>
            <Ionicons name="swap-horizontal" size={20} color={colors.success} />
          </View>

          {/* Settlement Details */}
          <View style={styles.expenseDetails}>
            <Text style={[styles.expenseDescription, { color: textColor }]} numberOfLines={1}>
              {payerName} paid {receiverName}
            </Text>
            <Text style={[styles.expenseMeta, { color: secondaryTextColor }]}>
              Settlement • {formatDate(settlement.created_at)}
            </Text>
          </View>

          {/* Amount */}
          <View style={styles.expenseAmountContainer}>
            <Text style={[styles.expenseAmount, { color: colors.success }]}>
              {formatCurrency(settlement.amount, settlement.currency)}
            </Text>
            <Text style={[styles.expenseShare, { color: colors.success }]}>
              {isYouPayer ? 'you paid' : 'you received'}
            </Text>
          </View>
        </View>
      </MotiView>
    );
  };

  const renderActivityItem = ({ item, index }: { item: ActivityItem; index: number }) => {
    if (item.type === 'settlement') {
      return renderSettlementItem(item.data, index);
    }

    const expense = item.data;
    const isYou = expense.you_paid;

    return (
      <MotiView
        from={{ opacity: 0, translateX: -20 }}
        animate={{ opacity: 1, translateX: 0 }}
        transition={{ type: 'timing', duration: 300, delay: Math.min(index * 50, 300) }}
      >
        <Pressable
          onPress={() => handleExpensePress(expense.id)}
          style={({ pressed }) => [
            styles.expenseItem,
            { backgroundColor: cardBg, opacity: pressed ? 0.8 : 1 },
          ]}
        >
          {/* Category Icon */}
          <View style={[styles.expenseIcon, { backgroundColor: expense.category?.color ? expense.category.color + '20' : colors.primary[100] }]}>
            {expense.category ? (
              <Text style={styles.expenseIconEmoji}>{expense.category.icon}</Text>
            ) : (
              <Ionicons name="receipt-outline" size={20} color={colors.primary[600]} />
            )}
          </View>

          {/* Expense Details */}
          <View style={styles.expenseDetails}>
            <Text style={[styles.expenseDescription, { color: textColor }]} numberOfLines={1}>
              {expense.description}
            </Text>
            <Text style={[styles.expenseMeta, { color: secondaryTextColor }]}>
              {isYou ? 'You paid' : `${expense.paid_by.name} paid`} • {formatDate(expense.expense_date)}
            </Text>
          </View>

          {/* Amount */}
          <View style={styles.expenseAmountContainer}>
            <Text style={[styles.expenseAmount, { color: textColor }]}>
              {formatCurrency(expense.amount, expense.currency)}
            </Text>
            {expense.your_share > 0 && (
              <Text style={[styles.expenseShare, { color: colors.error }]}>
                you owe {formatCurrency(expense.your_share, expense.currency)}
              </Text>
            )}
            {isYou && expense.split_count > 1 && (
              <Text style={[styles.expenseShare, { color: colors.success }]}>
                you lent {formatCurrency(expense.amount - (expense.amount / expense.split_count), expense.currency)}
              </Text>
            )}
          </View>
        </Pressable>
      </MotiView>
    );
  };

  const renderEmptyActivity = () => (
    <View style={styles.emptyExpenses}>
      <Ionicons name="receipt-outline" size={64} color={colors.gray[300]} />
      <Text style={[styles.emptyTitle, { color: textColor }]}>No activity yet</Text>
      <Text style={[styles.emptySubtitle, { color: secondaryTextColor }]}>
        Add your first expense to start tracking
      </Text>
      <Pressable
        onPress={handleAddExpense}
        style={({ pressed }) => [
          styles.emptyButton,
          { backgroundColor: colors.primary[500], opacity: pressed ? 0.8 : 1 },
        ]}
      >
        <Ionicons name="add" size={20} color={colors.white} />
        <Text style={styles.emptyButtonText}>Add Expense</Text>
      </Pressable>
    </View>
  );

  if (isLoading && !group) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor }]} edges={['top']}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary[500]} />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor }]} edges={['top']}>
      {/* Header */}
      <MotiView
        from={{ opacity: 0, translateY: -20 }}
        animate={{ opacity: 1, translateY: 0 }}
        transition={{ type: 'timing', duration: 400 }}
        style={[styles.header, { borderBottomColor: isDark ? colors.gray[700] : colors.gray[200] }]}
      >
        <Pressable onPress={handleBack} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color={textColor} />
        </Pressable>
        <Text style={[styles.headerTitle, { color: textColor }]} numberOfLines={1}>
          {group?.name || 'Group'}
        </Text>
        <Pressable onPress={handleSettings} style={styles.settingsButton}>
          <Ionicons name="settings-outline" size={22} color={textColor} />
        </Pressable>
      </MotiView>

      {/* Content */}
      <FlatList
        data={activityList}
        renderItem={renderActivityItem}
        keyExtractor={item => item.type === 'expense' ? `expense-${item.data.id}` : `settlement-${item.data.id}`}
        ListHeaderComponent={renderHeader}
        ListEmptyComponent={renderEmptyActivity}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={isLoading}
            onRefresh={handleRefresh}
            tintColor={colors.primary[500]}
            colors={[colors.primary[500]]}
          />
        }
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  backButton: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    flex: 1,
    fontSize: 18,
    fontWeight: '600',
    textAlign: 'center',
    marginHorizontal: 8,
  },
  settingsButton: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  listContent: {
    padding: 16,
    paddingBottom: 100,
  },
  groupInfoCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderRadius: 16,
    marginBottom: 20,
  },
  groupIcon: {
    width: 60,
    height: 60,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  groupDetails: {
    flex: 1,
    marginLeft: 16,
  },
  groupName: {
    fontSize: 20,
    fontWeight: '700',
    marginBottom: 4,
  },
  memberCount: {
    fontSize: 14,
  },
  section: {
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 12,
  },
  balancesCard: {
    borderRadius: 16,
    padding: 4,
  },
  balanceItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 12,
  },
  balanceItemBorder: {
    borderBottomWidth: 1,
  },
  balanceUser: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  balanceAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  balanceAvatarText: {
    color: colors.white,
    fontSize: 12,
    fontWeight: '600',
  },
  balanceName: {
    fontSize: 15,
    fontWeight: '500',
    marginLeft: 12,
  },
  balanceAmount: {
    alignItems: 'flex-end',
  },
  balanceValue: {
    fontSize: 13,
    fontWeight: '500',
  },
  expensesHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  addExpenseButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 20,
    gap: 4,
  },
  addExpenseText: {
    color: colors.white,
    fontSize: 14,
    fontWeight: '600',
  },
  expenseItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    borderRadius: 14,
    marginBottom: 10,
  },
  expenseIcon: {
    width: 44,
    height: 44,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  expenseIconEmoji: {
    fontSize: 20,
  },
  expenseDetails: {
    flex: 1,
    marginLeft: 12,
  },
  expenseDescription: {
    fontSize: 15,
    fontWeight: '500',
    marginBottom: 3,
  },
  expenseMeta: {
    fontSize: 12,
  },
  expenseAmountContainer: {
    alignItems: 'flex-end',
  },
  expenseAmount: {
    fontSize: 15,
    fontWeight: '600',
  },
  expenseShare: {
    fontSize: 11,
    marginTop: 2,
  },
  emptyExpenses: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginTop: 16,
  },
  emptySubtitle: {
    fontSize: 14,
    marginTop: 8,
    textAlign: 'center',
  },
  emptyButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 25,
    marginTop: 24,
    gap: 8,
  },
  emptyButtonText: {
    color: colors.white,
    fontSize: 16,
    fontWeight: '600',
  },
  emptyText: {
    fontSize: 14,
    textAlign: 'center',
    padding: 16,
  },
  // Stacked Bar Contribution styles
  contributionHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  totalSpendingValue: {
    fontSize: 16,
    fontWeight: '700',
  },
  stackedBarCard: {
    borderRadius: 16,
    padding: 16,
  },
  stackedBarContainer: {
    flexDirection: 'row',
    height: 40,
    borderRadius: 8,
    overflow: 'hidden',
  },
  stackedBarSegment: {
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
  },
  stackedBarInitials: {
    color: colors.white,
    fontSize: 12,
    fontWeight: '700',
  },
  stackedBarLegend: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginTop: 12,
    gap: 8,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 12,
    gap: 6,
  },
  legendDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  legendText: {
    fontSize: 12,
    maxWidth: 60,
  },
  legendAmount: {
    fontSize: 12,
    fontWeight: '600',
  },
});

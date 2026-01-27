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
import type { ExpenseListItem } from '@/types';

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

  // Theme colors
  const textColor = isDark ? colors.text.dark.primary : colors.text.light.primary;
  const secondaryTextColor = isDark ? colors.text.dark.secondary : colors.text.light.secondary;
  const backgroundColor = isDark ? colors.background.dark : colors.background.light;
  const cardBg = isDark ? colors.gray[800] : colors.white;

  const isLoading = isLoadingGroup || isLoadingExpenses;

  const handleBack = () => {
    router.back();
  };

  const handleRefresh = useCallback(async () => {
    await Promise.all([refreshGroup(), refreshExpenses()]);
  }, [refreshGroup, refreshExpenses]);

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

      {/* Member Balances */}
      <MotiView
        from={{ opacity: 0, translateY: 20 }}
        animate={{ opacity: 1, translateY: 0 }}
        transition={{ type: 'timing', duration: 400, delay: 200 }}
        style={styles.section}
      >
        <Text style={[styles.sectionTitle, { color: textColor }]}>Balances</Text>
        <View style={[styles.balancesCard, { backgroundColor: cardBg }]}>
          {sortedBalances.length === 0 ? (
            <Text style={[styles.emptyText, { color: secondaryTextColor }]}>
              No expenses yet
            </Text>
          ) : (
            sortedBalances.map((balance, index) => (
              <View
                key={balance.user.id}
                style={[
                  styles.balanceItem,
                  index < sortedBalances.length - 1 && styles.balanceItemBorder,
                  { borderBottomColor: isDark ? colors.gray[700] : colors.gray[200] },
                ]}
              >
                <View style={styles.balanceUser}>
                  <View
                    style={[
                      styles.balanceAvatar,
                      { backgroundColor: balance.user.id === user?.id ? colors.primary[500] : colors.gray[400] }
                    ]}
                  >
                    <Text style={styles.balanceAvatarText}>
                      {getInitials(balance.user.name)}
                    </Text>
                  </View>
                  <Text style={[styles.balanceName, { color: textColor }]}>
                    {balance.user.id === user?.id ? 'You' : balance.user.name}
                  </Text>
                </View>
                <View style={styles.balanceAmount}>
                  <Text
                    style={[
                      styles.balanceValue,
                      {
                        color: balance.net_balance > 0
                          ? colors.success
                          : balance.net_balance < 0
                            ? colors.error
                            : secondaryTextColor,
                      },
                    ]}
                  >
                    {balance.net_balance > 0
                      ? `gets back ${formatCurrency(balance.net_balance)}`
                      : balance.net_balance < 0
                        ? `owes ${formatCurrency(balance.net_balance)}`
                        : 'settled up'}
                  </Text>
                </View>
              </View>
            ))
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
        <Text style={[styles.sectionTitle, { color: textColor }]}>Expenses</Text>
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

  const renderExpenseItem = ({ item, index }: { item: ExpenseListItem; index: number }) => {
    const isYou = item.you_paid;

    return (
      <MotiView
        from={{ opacity: 0, translateX: -20 }}
        animate={{ opacity: 1, translateX: 0 }}
        transition={{ type: 'timing', duration: 300, delay: Math.min(index * 50, 300) }}
      >
        <Pressable
          onPress={() => handleExpensePress(item.id)}
          style={({ pressed }) => [
            styles.expenseItem,
            { backgroundColor: cardBg, opacity: pressed ? 0.8 : 1 },
          ]}
        >
          {/* Category Icon */}
          <View style={[styles.expenseIcon, { backgroundColor: item.category?.color ? item.category.color + '20' : colors.primary[100] }]}>
            {item.category ? (
              <Text style={styles.expenseIconEmoji}>{item.category.icon}</Text>
            ) : (
              <Ionicons name="receipt-outline" size={20} color={colors.primary[600]} />
            )}
          </View>

          {/* Expense Details */}
          <View style={styles.expenseDetails}>
            <Text style={[styles.expenseDescription, { color: textColor }]} numberOfLines={1}>
              {item.description}
            </Text>
            <Text style={[styles.expenseMeta, { color: secondaryTextColor }]}>
              {isYou ? 'You paid' : `${item.paid_by.name} paid`} • {formatDate(item.expense_date)}
            </Text>
          </View>

          {/* Amount */}
          <View style={styles.expenseAmountContainer}>
            <Text style={[styles.expenseAmount, { color: textColor }]}>
              {formatCurrency(item.amount, item.currency)}
            </Text>
            {item.your_share > 0 && (
              <Text style={[styles.expenseShare, { color: colors.error }]}>
                you owe {formatCurrency(item.your_share, item.currency)}
              </Text>
            )}
            {isYou && item.split_count > 1 && (
              <Text style={[styles.expenseShare, { color: colors.success }]}>
                you lent {formatCurrency(item.amount - (item.amount / item.split_count), item.currency)}
              </Text>
            )}
          </View>
        </Pressable>
      </MotiView>
    );
  };

  const renderEmptyExpenses = () => (
    <View style={styles.emptyExpenses}>
      <Ionicons name="receipt-outline" size={64} color={colors.gray[300]} />
      <Text style={[styles.emptyTitle, { color: textColor }]}>No expenses yet</Text>
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
        data={expenses}
        renderItem={renderExpenseItem}
        keyExtractor={item => item.id}
        ListHeaderComponent={renderHeader}
        ListEmptyComponent={renderEmptyExpenses}
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
});

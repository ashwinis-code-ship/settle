/**
 * Group Detail Screen
 *
 * Shows group information, member contributions, and expenses list.
 */

import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { router, useLocalSearchParams } from 'expo-router';
import { MotiView } from 'moti';
import { useCallback, useMemo } from 'react';
import {
    Alert,
    FlatList,
    Pressable,
    RefreshControl,
    StyleSheet,
    Text,
    View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ContributionBar } from '@/components/ui/contribution-bar';
import { EmptyState } from '@/components/ui/empty-state';
import { PendingBadge } from '@/components/ui/offline-banner';
import { Skeleton, SkeletonActivityList } from '@/components/ui/skeleton';
import { colors } from '@/constants/colors';
import { useAuth } from '@/contexts/auth-context';
import { useSync } from '@/contexts/sync-context';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useExpenses, type ExpenseListItemWithStatus } from '@/hooks/use-expenses';
import { useGroup } from '@/hooks/use-group';
import { hapticLight, hapticWarning } from '@/lib/haptics';

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
  const { isOnline } = useSync();

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
    if (!isOnline) {
      hapticWarning();
      Alert.alert(
        'No Connection',
        'Adding expenses requires an internet connection.',
        [{ text: 'OK' }]
      );
      return;
    }
    hapticLight();
    router.push(`/add-expense?groupId=${id}`);
  };

  const handleSettings = () => {
    hapticLight();
    router.push(`/group/${id}/settings`);
  };

  // Sort balances — current user first, then by net balance descending
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
        from={{ opacity: 0, translateY: 20, scale: 0.95 }}
        animate={{ opacity: 1, translateY: 0, scale: 1 }}
        transition={{ type: 'spring', damping: 18, stiffness: 120, delay: 100 }}
        style={[styles.groupInfoCard, { backgroundColor: cardBg }]}
      >
        {group?.image_url ? (
          <Image
            source={{ uri: group.image_url }}
            style={styles.groupIcon}
            contentFit="cover"
            transition={200}
          />
        ) : (
          <View style={[styles.groupIcon, { backgroundColor: colors.primary[500], alignItems: 'center', justifyContent: 'center' }]}>
            <Ionicons name="people" size={32} color={colors.white} />
          </View>
        )}
        <View style={styles.groupDetails}>
          <Text style={[styles.groupName, { color: textColor }]} numberOfLines={1}>
            {group?.name || 'Loading...'}
          </Text>
          <Text style={[styles.memberCount, { color: secondaryTextColor }]}>
            {group?.members.length || 0} members
          </Text>
        </View>
      </MotiView>

      {/* Contributions — Stacked Bar */}
      <MotiView
        from={{ opacity: 0, translateY: 20 }}
        animate={{ opacity: 1, translateY: 0 }}
        transition={{ type: 'spring', damping: 18, stiffness: 120, delay: 180 }}
        style={styles.section}
      >
        <View style={styles.contributionHeaderRow}>
          <Text style={[styles.sectionTitle, { color: textColor, marginBottom: 0 }]}>Contributions</Text>
          <Text style={[styles.totalSpendingValue, { color: textColor }]}>
            {formatCurrency(sortedBalances.reduce((sum, b) => sum + b.total_paid, 0))}
          </Text>
        </View>
        <ContributionBar
          balances={sortedBalances}
          currentUserId={user?.id ?? ''}
          isDark={isDark}
        />
      </MotiView>

      {/* Activity Header */}
      <MotiView
        from={{ opacity: 0, translateY: 20 }}
        animate={{ opacity: 1, translateY: 0 }}
        transition={{ type: 'spring', damping: 18, stiffness: 120, delay: 260 }}
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
    hapticLight();
    router.push(`/expense/${expenseId}`);
  };

  const renderExpenseItem = ({ item: expense, index }: { item: ExpenseListItemWithStatus; index: number }) => {
    const isYou = expense.you_paid;

    return (
      <MotiView
        from={{ opacity: 0, translateX: -20, scale: 0.95 }}
        animate={{ opacity: 1, translateX: 0, scale: 1 }}
        transition={{ type: 'spring', damping: 18, stiffness: 120, delay: Math.min(index * 50, 300) }}
      >
        <Pressable
          onPress={() => handleExpensePress(expense.id)}
          style={({ pressed }) => [
            styles.expenseItem,
            {
              backgroundColor: cardBg,
              opacity: pressed ? 0.9 : 1,
              transform: [{ scale: pressed ? 0.98 : 1 }],
            },
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
            <View style={styles.expenseDescriptionRow}>
              <Text style={[styles.expenseDescription, { color: textColor }]} numberOfLines={1}>
                {expense.description}
              </Text>
              {expense.isPending && <PendingBadge compact />}
            </View>
            <Text style={[styles.expenseMeta, { color: secondaryTextColor }]}>
              {isYou ? 'You paid' : `${expense.paid_by.name} paid`} • {formatDate(expense.expense_date)}
            </Text>
          </View>

          {/* Amount — mutually exclusive: lent (you paid) vs owe (someone else paid).
              your_share = 0 for the payer, so we derive the lent amount from the split
              count: total minus the payer's own equal share = what everyone else owes. */}
          <View style={styles.expenseAmountContainer}>
            <Text style={[styles.expenseAmount, { color: textColor }]}>
              {formatCurrency(expense.amount, expense.currency)}
            </Text>
            {isYou && expense.split_count > 1 ? (
              <Text style={[styles.expenseShare, { color: colors.success }]}>
                you lent {formatCurrency(expense.amount - (expense.amount / expense.split_count), expense.currency)}
              </Text>
            ) : expense.your_share > 0 ? (
              <Text style={[styles.expenseShare, { color: colors.error }]}>
                you owe {formatCurrency(expense.your_share, expense.currency)}
              </Text>
            ) : null}
          </View>
        </Pressable>
      </MotiView>
    );
  };

  const renderEmptyActivity = () => (
    <View style={styles.emptyExpenses}>
      <EmptyState
        icon="receipt-outline"
        title="No activity yet"
        description="Add your first expense to start tracking spending with this group"
        actionLabel="Add Expense"
        onAction={handleAddExpense}
      />
    </View>
  );

  if (isLoading && !group) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor }]} edges={['top']}>
        <View style={styles.loadingContainer}>
          {/* Header skeleton */}
          <View style={[styles.header, { borderBottomColor: isDark ? colors.gray[700] : colors.gray[200] }]}>
            <View style={{ width: 40 }} />
            <Skeleton width={120} height={20} borderRadius={6} />
            <View style={{ width: 40 }} />
          </View>

          {/* Group info skeleton */}
          <View style={[styles.groupInfoCard, { backgroundColor: cardBg, marginHorizontal: 16, marginTop: 16 }]}>
            <Skeleton width={64} height={64} circle />
            <View style={{ marginLeft: 16, flex: 1 }}>
              <Skeleton width="60%" height={18} borderRadius={4} />
              <View style={{ height: 8 }} />
              <Skeleton width="40%" height={14} borderRadius={4} />
            </View>
          </View>

          {/* Activity skeleton */}
          <View style={{ padding: 16 }}>
            <Skeleton width={100} height={16} borderRadius={4} />
            <View style={{ height: 16 }} />
            <SkeletonActivityList count={4} />
          </View>
        </View>
      </SafeAreaView>
    );
  }

  // Show offline empty state when no cached data available
  if (!isOnline && !isLoading && !group) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor }]} edges={['top']}>
        <View style={[styles.header, { borderBottomColor: isDark ? colors.gray[700] : colors.gray[200] }]}>
          <Pressable onPress={handleBack} style={styles.backButton}>
            <Ionicons name="arrow-back" size={24} color={textColor} />
          </Pressable>
          <Text style={[styles.headerTitle, { color: textColor }]}>Group</Text>
          <View style={{ width: 40 }} />
        </View>
        <View style={styles.emptyExpenses}>
          <EmptyState
            icon="cloud-offline-outline"
            title="No cached data"
            description="Connect to the internet to view this group's details"
          />
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
        transition={{ type: 'spring', damping: 18, stiffness: 100 }}
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
  expenseDescriptionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  expenseDescription: {
    fontSize: 15,
    fontWeight: '500',
    marginBottom: 3,
    flex: 1,
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
});

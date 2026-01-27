/**
 * Friend Detail Screen
 * 
 * Shows all transactions (expenses and settlements) with a specific friend.
 * Groups by shared group first, then shows individual transaction history.
 */

import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { MotiView } from 'moti';
import { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { colors } from '@/constants/colors';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useFriendDetail, type GroupBalance } from '@/hooks/use-friend-detail';
import { CURRENCIES } from '@/types/database';
import type { FriendTransaction } from '@/types';

export default function FriendDetailScreen() {
  const params = useLocalSearchParams<{ id: string; name?: string }>();
  const colorScheme = useColorScheme() ?? 'light';
  const isDark = colorScheme === 'dark';
  const { friend, groupBalances, transactions, isLoading, error, refresh } = useFriendDetail(params.id);
  const [refreshing, setRefreshing] = useState(false);

  const textColor = isDark ? colors.text.dark.primary : colors.text.light.primary;
  const secondaryTextColor = isDark ? colors.text.dark.secondary : colors.text.light.secondary;
  const backgroundColor = isDark ? colors.background.dark : colors.background.light;
  const cardBg = isDark ? colors.gray[800] : colors.white;

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await refresh();
    setRefreshing(false);
  }, [refresh]);

  const handleBack = () => {
    router.back();
  };

  const handleAddExpense = () => {
    router.push({
      pathname: '/add-expense',
      params: { friendId: params.id, friendName: friend?.user.name || params.name },
    });
  };

  const handleSettleUp = () => {
    router.push({
      pathname: '/settle-up',
      params: { 
        friendId: params.id, 
        friendName: friend?.user.name || params.name,
        balance: friend?.total_balance?.toString(),
        currency: friend?.primary_currency,
      },
    });
  };

  const handleGroupPress = (groupId: string) => {
    router.push(`/group/${groupId}`);
  };

  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map((n) => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  const formatBalance = (balance: number, currency: string = 'INR') => {
    const currencyInfo = CURRENCIES[currency as keyof typeof CURRENCIES] || CURRENCIES.INR;
    const absBalance = Math.abs(balance).toFixed(2);
    return `${currencyInfo.symbol}${absBalance}`;
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffDays = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24));

    if (diffDays === 0) return 'Today';
    if (diffDays === 1) return 'Yesterday';
    if (diffDays < 7) return `${diffDays} days ago`;
    
    return date.toLocaleDateString('en-IN', {
      day: 'numeric',
      month: 'short',
      year: date.getFullYear() !== now.getFullYear() ? 'numeric' : undefined,
    });
  };

  const getBalanceColor = (balance: number) => {
    if (balance > 0) return colors.success;
    if (balance < 0) return colors.error;
    return secondaryTextColor;
  };

  const getBalanceText = (balance: number, friendName: string) => {
    if (balance > 0) return `${friendName} owes you`;
    if (balance < 0) return `You owe ${friendName}`;
    return 'All settled up';
  };

  const renderGroupCard = (groupBalance: GroupBalance, index: number) => {
    const isPositive = groupBalance.balance > 0;
    const balanceColor = getBalanceColor(groupBalance.balance);

    return (
      <MotiView
        key={groupBalance.group_id}
        from={{ opacity: 0, translateX: -20 }}
        animate={{ opacity: 1, translateX: 0 }}
        transition={{ type: 'timing', duration: 300, delay: index * 80 }}
      >
        <Pressable
          onPress={() => handleGroupPress(groupBalance.group_id)}
          style={({ pressed }) => [
            styles.groupCard,
            { backgroundColor: cardBg, opacity: pressed ? 0.8 : 1 },
          ]}
        >
          {/* Group Icon */}
          <View style={[styles.groupIcon, { backgroundColor: colors.primary[100] }]}>
            <Ionicons name="people" size={20} color={colors.primary[500]} />
          </View>

          {/* Group Info */}
          <View style={styles.groupInfo}>
            <Text style={[styles.groupName, { color: textColor }]} numberOfLines={1}>
              {groupBalance.group_name}
            </Text>
            <Text style={[styles.groupMeta, { color: secondaryTextColor }]}>
              {groupBalance.transaction_count} transaction{groupBalance.transaction_count !== 1 ? 's' : ''}
            </Text>
          </View>

          {/* Balance */}
          <View style={styles.groupBalanceContainer}>
            {groupBalance.balance !== 0 ? (
              <>
                <Text style={[styles.groupBalanceLabel, { color: balanceColor }]}>
                  {isPositive ? 'owes you' : 'you owe'}
                </Text>
                <Text style={[styles.groupBalanceAmount, { color: balanceColor }]}>
                  {formatBalance(groupBalance.balance, groupBalance.currency)}
                </Text>
              </>
            ) : (
              <View style={[styles.settledBadgeSmall, { backgroundColor: colors.success + '20' }]}>
                <Ionicons name="checkmark-circle" size={14} color={colors.success} />
                <Text style={[styles.settledTextSmall, { color: colors.success }]}>Settled</Text>
              </View>
            )}
          </View>

          <Ionicons name="chevron-forward" size={20} color={secondaryTextColor} />
        </Pressable>
      </MotiView>
    );
  };

  const renderTransactionItem = (item: FriendTransaction, index: number) => {
    const isPositive = item.amount > 0;
    const amountColor = isPositive ? colors.success : colors.error;
    const isSettlement = item.type === 'settlement';

    return (
      <MotiView
        key={item.id}
        from={{ opacity: 0, translateX: -20 }}
        animate={{ opacity: 1, translateX: 0 }}
        transition={{ type: 'timing', duration: 300, delay: index * 40 }}
      >
        <View style={[styles.transactionItem, { backgroundColor: cardBg }]}>
          {/* Icon */}
          <View
            style={[
              styles.transactionIcon,
              {
                backgroundColor: isSettlement
                  ? colors.primary[100]
                  : isPositive
                  ? colors.success + '20'
                  : colors.error + '20',
              },
            ]}
          >
            <Ionicons
              name={isSettlement ? 'swap-horizontal' : 'receipt-outline'}
              size={18}
              color={isSettlement ? colors.primary[500] : amountColor}
            />
          </View>

          {/* Details */}
          <View style={styles.transactionDetails}>
            <Text style={[styles.transactionDescription, { color: textColor }]} numberOfLines={1}>
              {item.description}
            </Text>
            <View style={styles.transactionMeta}>
              <Text style={[styles.transactionDate, { color: secondaryTextColor }]}>
                {formatDate(item.date)}
              </Text>
              {item.group_name && (
                <>
                  <Text style={[styles.transactionDot, { color: secondaryTextColor }]}>•</Text>
                  <Text style={[styles.transactionGroup, { color: secondaryTextColor }]} numberOfLines={1}>
                    {item.group_name}
                  </Text>
                </>
              )}
            </View>
          </View>

          {/* Amount */}
          <View style={styles.transactionAmountContainer}>
            <Text style={[styles.transactionAmountLabel, { color: amountColor }]}>
              {isPositive ? 'you get' : 'you owe'}
            </Text>
            <Text style={[styles.transactionAmount, { color: amountColor }]}>
              {formatBalance(item.amount, item.currency)}
            </Text>
          </View>
        </View>
      </MotiView>
    );
  };

  if (isLoading && !friend) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor }]} edges={['top']}>
        <View style={styles.header}>
          <Pressable onPress={handleBack} style={styles.backButton}>
            <Ionicons name="arrow-back" size={24} color={textColor} />
          </Pressable>
          <Text style={[styles.headerTitle, { color: textColor }]}>{params.name || 'Friend'}</Text>
          <View style={styles.backButton} />
        </View>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary[500]} />
        </View>
      </SafeAreaView>
    );
  }

  if (error) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor }]} edges={['top']}>
        <View style={styles.header}>
          <Pressable onPress={handleBack} style={styles.backButton}>
            <Ionicons name="arrow-back" size={24} color={textColor} />
          </Pressable>
          <Text style={[styles.headerTitle, { color: textColor }]}>Error</Text>
          <View style={styles.backButton} />
        </View>
        <View style={styles.errorContainer}>
          <Ionicons name="alert-circle" size={48} color={colors.error} />
          <Text style={[styles.errorText, { color: textColor }]}>{error}</Text>
          <Pressable
            onPress={refresh}
            style={[styles.retryButton, { backgroundColor: colors.primary[500] }]}
          >
            <Text style={styles.retryButtonText}>Retry</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  const friendName = friend?.user.name || params.name || 'Friend';
  const balance = friend?.total_balance || 0;
  const balanceColor = getBalanceColor(balance);

  return (
    <SafeAreaView style={[styles.container, { backgroundColor }]} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <Pressable onPress={handleBack} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color={textColor} />
        </Pressable>
        <Text style={[styles.headerTitle, { color: textColor }]} numberOfLines={1}>
          {friendName}
        </Text>
        <View style={styles.backButton} />
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={colors.primary[500]}
          />
        }
        showsVerticalScrollIndicator={false}
      >
        {/* Friend Info Card */}
        <MotiView
          from={{ opacity: 0, translateY: 20 }}
          animate={{ opacity: 1, translateY: 0 }}
          transition={{ type: 'timing', duration: 400 }}
          style={[styles.friendCard, { backgroundColor: cardBg }]}
        >
          <View style={[styles.avatar, { backgroundColor: colors.primary[500] }]}>
            <Text style={styles.avatarText}>{getInitials(friendName)}</Text>
          </View>
          <Text style={[styles.friendName, { color: textColor }]}>{friendName}</Text>
          
          {/* Balance Display */}
          <View style={styles.balanceSection}>
            <Text style={[styles.balanceLabel, { color: balanceColor }]}>
              {getBalanceText(balance, friendName.split(' ')[0])}
            </Text>
            {balance !== 0 && (
              <Text style={[styles.balanceAmount, { color: balanceColor }]}>
                {formatBalance(balance, friend?.primary_currency)}
              </Text>
            )}
            {balance === 0 && (
              <View style={styles.settledBadge}>
                <Ionicons name="checkmark-circle" size={20} color={colors.success} />
              </View>
            )}
          </View>

          {/* Action Buttons */}
          <View style={styles.actionButtons}>
            <Pressable
              onPress={handleAddExpense}
              style={[styles.actionButton, { backgroundColor: colors.primary[500] }]}
            >
              <Ionicons name="add" size={20} color={colors.white} />
              <Text style={styles.actionButtonText}>Add Expense</Text>
            </Pressable>
            {balance !== 0 && (
              <Pressable
                onPress={handleSettleUp}
                style={[styles.actionButton, styles.settleButton, { borderColor: colors.primary[500] }]}
              >
                <Ionicons name="wallet-outline" size={20} color={colors.primary[500]} />
                <Text style={[styles.actionButtonText, { color: colors.primary[500] }]}>Settle Up</Text>
              </Pressable>
            )}
          </View>
        </MotiView>

        {/* Shared Groups Section */}
        {groupBalances.length > 0 && (
          <MotiView
            from={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ type: 'timing', duration: 300, delay: 150 }}
          >
            <View style={styles.sectionHeader}>
              <Text style={[styles.sectionTitle, { color: textColor }]}>
                Shared Groups
              </Text>
              <Text style={[styles.sectionSubtitle, { color: secondaryTextColor }]}>
                {groupBalances.length} group{groupBalances.length !== 1 ? 's' : ''}
              </Text>
            </View>
            <View style={styles.groupsList}>
              {groupBalances.map((gb, index) => renderGroupCard(gb, index))}
            </View>
          </MotiView>
        )}

        {/* Transaction History Section */}
        {transactions.length > 0 && (
          <MotiView
            from={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ type: 'timing', duration: 300, delay: 250 }}
          >
            <View style={styles.sectionHeader}>
              <Text style={[styles.sectionTitle, { color: textColor }]}>
                All Transactions
              </Text>
              <Text style={[styles.sectionSubtitle, { color: secondaryTextColor }]}>
                {transactions.length} item{transactions.length !== 1 ? 's' : ''}
              </Text>
            </View>
            <View style={styles.transactionsList}>
              {transactions.map((tx, index) => renderTransactionItem(tx, index))}
            </View>
          </MotiView>
        )}

        {/* Empty State */}
        {transactions.length === 0 && groupBalances.length === 0 && !isLoading && (
          <MotiView
            from={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ type: 'timing', duration: 400, delay: 200 }}
            style={[styles.emptyState, { backgroundColor: cardBg }]}
          >
            <Ionicons name="document-text-outline" size={48} color={colors.gray[400]} />
            <Text style={[styles.emptyTitle, { color: textColor }]}>No transactions yet</Text>
            <Text style={[styles.emptyText, { color: secondaryTextColor }]}>
              Add an expense to start tracking your shared expenses
            </Text>
          </MotiView>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  backButton: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    flex: 1,
    textAlign: 'center',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 40,
  },
  friendCard: {
    alignItems: 'center',
    padding: 24,
    borderRadius: 20,
    marginBottom: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  avatar: {
    width: 72,
    height: 72,
    borderRadius: 36,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  avatarText: {
    color: colors.white,
    fontSize: 26,
    fontWeight: '700',
  },
  friendName: {
    fontSize: 22,
    fontWeight: '700',
    marginBottom: 12,
  },
  balanceSection: {
    alignItems: 'center',
    marginBottom: 20,
  },
  balanceLabel: {
    fontSize: 14,
    fontWeight: '500',
    marginBottom: 4,
  },
  balanceAmount: {
    fontSize: 28,
    fontWeight: '700',
  },
  settledBadge: {
    marginTop: 4,
  },
  actionButtons: {
    flexDirection: 'row',
    gap: 12,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 12,
    gap: 6,
  },
  settleButton: {
    backgroundColor: 'transparent',
    borderWidth: 2,
  },
  actionButtonText: {
    color: colors.white,
    fontSize: 14,
    fontWeight: '600',
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
  },
  sectionSubtitle: {
    fontSize: 13,
  },
  groupsList: {
    gap: 10,
    marginBottom: 24,
  },
  groupCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    borderRadius: 14,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.03,
    shadowRadius: 4,
    elevation: 1,
  },
  groupIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  groupInfo: {
    flex: 1,
    marginLeft: 12,
  },
  groupName: {
    fontSize: 15,
    fontWeight: '600',
  },
  groupMeta: {
    fontSize: 12,
    marginTop: 2,
  },
  groupBalanceContainer: {
    alignItems: 'flex-end',
    marginRight: 8,
  },
  groupBalanceLabel: {
    fontSize: 10,
    fontWeight: '500',
    textTransform: 'uppercase',
  },
  groupBalanceAmount: {
    fontSize: 14,
    fontWeight: '700',
    marginTop: 2,
  },
  settledBadgeSmall: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
    gap: 4,
  },
  settledTextSmall: {
    fontSize: 11,
    fontWeight: '600',
  },
  transactionsList: {
    gap: 8,
  },
  transactionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.02,
    shadowRadius: 3,
    elevation: 1,
  },
  transactionIcon: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  transactionDetails: {
    flex: 1,
    marginLeft: 10,
  },
  transactionDescription: {
    fontSize: 14,
    fontWeight: '500',
  },
  transactionMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 2,
  },
  transactionDate: {
    fontSize: 11,
  },
  transactionDot: {
    marginHorizontal: 5,
    fontSize: 11,
  },
  transactionGroup: {
    fontSize: 11,
    maxWidth: 80,
  },
  transactionAmountContainer: {
    alignItems: 'flex-end',
  },
  transactionAmountLabel: {
    fontSize: 9,
    fontWeight: '500',
    textTransform: 'uppercase',
  },
  transactionAmount: {
    fontSize: 14,
    fontWeight: '700',
    marginTop: 1,
  },
  emptyState: {
    alignItems: 'center',
    padding: 32,
    borderRadius: 20,
    marginTop: 20,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginTop: 16,
    marginBottom: 8,
  },
  emptyText: {
    fontSize: 14,
    textAlign: 'center',
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  errorContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  errorText: {
    fontSize: 16,
    textAlign: 'center',
    marginTop: 16,
    marginBottom: 24,
  },
  retryButton: {
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
  },
  retryButtonText: {
    color: colors.white,
    fontSize: 16,
    fontWeight: '600',
  },
});

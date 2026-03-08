/**
 * Friend Detail Screen
 * 
 * Shows all transactions (expenses and settlements) with a specific friend.
 * Groups by shared group first, then shows individual transaction history.
 */

import { Ionicons } from '@expo/vector-icons';
import BottomSheet from '@gorhom/bottom-sheet';
import { Image } from 'expo-image';
import { EditSettlementSheet } from '@/components/edit-settlement-sheet';
import { router, useLocalSearchParams } from 'expo-router';
import { MotiView } from 'moti';
import { useCallback, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaView } from 'react-native-safe-area-context';

import { EmptyState } from '@/components/ui/empty-state';
import { Skeleton, SkeletonActivityList, SkeletonCard } from '@/components/ui/skeleton';
import { colors } from '@/constants/colors';
import { useSync } from '@/contexts/sync-context';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useFriendDetail, type GroupBalance } from '@/hooks/use-friend-detail';
import { useSettlements } from '@/hooks/use-settlements';
import { hapticLight, hapticSuccess, hapticWarning } from '@/lib/haptics';
import type { FriendTransaction } from '@/types';
import { CURRENCIES } from '@/types/database';

export default function FriendDetailScreen() {
  const params = useLocalSearchParams<{ id: string; name?: string }>();
  const colorScheme = useColorScheme() ?? 'light';
  const isDark = colorScheme === 'dark';
  const { isOnline } = useSync();
  const {
    friend,
    groupBalances,
    currentPhase,
    olderPhases,
    isFullySettled,
    hasOlderPhases,
    hasMoreOlder,
    loadOlderPhase,
    isLoadingOlder,
    isLoading,
    error,
    refresh,
  } = useFriendDetail(params.id);
  const { updateSettlement } = useSettlements({ friendId: params.id });
  const [refreshing, setRefreshing] = useState(false);
  const [editingSettlement, setEditingSettlement] = useState<FriendTransaction | null>(null);
  const [editAmount, setEditAmount] = useState('');
  const [editNotes, setEditNotes] = useState('');
  const [isUpdating, setIsUpdating] = useState(false);
  const editSheetRef = useRef<BottomSheet>(null);

  const textColor = isDark ? colors.text.dark.primary : colors.text.light.primary;
  const secondaryTextColor = isDark ? colors.text.dark.secondary : colors.text.light.secondary;
  const backgroundColor = isDark ? colors.background.dark : colors.background.light;
  const cardBg = isDark ? colors.gray[800] : colors.white;
  const settlementLineColor = isDark ? colors.gray[600] : colors.gray[300];
  const settlementTextColor = textColor; // Neutral solid color, no green/red

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await refresh();
    setRefreshing(false);
  }, [refresh]);

  const handleBack = () => {
    router.back();
  };

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
    router.push({
      pathname: '/add-expense',
      params: { friendId: params.id, friendName: friend?.user.name || params.name },
    });
  };

  const handleSettleUp = () => {
    if (!isOnline) {
      hapticWarning();
      Alert.alert(
        'No Connection',
        'Settling up requires an internet connection.',
        [{ text: 'OK' }]
      );
      return;
    }
    hapticLight();
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
    hapticLight();
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

  const formatSettlementDate = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
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
        from={{ opacity: 0, translateX: -20, scale: 0.95 }}
        animate={{ opacity: 1, translateX: 0, scale: 1 }}
        transition={{ type: 'spring', damping: 18, stiffness: 120, delay: Math.min(index * 70, 350) }}
      >
        <Pressable
          onPress={() => handleGroupPress(groupBalance.group_id)}
          style={({ pressed }) => [
            styles.groupCard,
            { 
              backgroundColor: cardBg, 
              opacity: pressed ? 0.9 : 1,
              transform: [{ scale: pressed ? 0.98 : 1 }],
            },
          ]}
        >
          {/* Group Icon */}
          {groupBalance.image_url ? (
            <Image
              source={{ uri: groupBalance.image_url }}
              style={styles.groupIcon}
              contentFit="cover"
              transition={200}
            />
          ) : (
            <View style={[styles.groupIcon, { backgroundColor: colors.primary[100], alignItems: 'center', justifyContent: 'center' }]}>
              <Ionicons name="people" size={20} color={colors.primary[500]} />
            </View>
          )}

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

  const handleTransactionPress = (item: FriendTransaction) => {
    if (item.type === 'expense') {
      hapticLight();
      router.push(`/expense/${item.id}`);
    }
  };

  const handleSettlementPress = (item: FriendTransaction) => {
    if (item.type !== 'settlement') return;
    if (!isOnline) {
      hapticWarning();
      Alert.alert(
        'No Connection',
        'Editing settlements requires an internet connection.',
        [{ text: 'OK' }]
      );
      return;
    }
    hapticLight();
    setEditingSettlement(item);
    setEditAmount(Math.abs(item.amount).toFixed(2));
    setEditNotes(item.notes || '');
    editSheetRef.current?.expand();
  };

  const handleCloseEditSheet = useCallback(() => {
    editSheetRef.current?.close();
    setEditingSettlement(null);
    setEditAmount('');
    setEditNotes('');
  }, []);

  const handleUpdateSettlement = async () => {
    if (!editingSettlement) return;
    const amountNum = parseFloat(editAmount);
    if (isNaN(amountNum) || amountNum <= 0) {
      hapticWarning();
      return;
    }
    setIsUpdating(true);
    const success = await updateSettlement(editingSettlement.id, {
      amount: amountNum,
      notes: editNotes.trim() || null,
    });
    setIsUpdating(false);
    if (success) {
      hapticSuccess();
      handleCloseEditSheet();
      refresh();
    } else {
      hapticWarning();
      Alert.alert('Error', 'Failed to update settlement. Please try again.');
    }
  };

  const renderTransactionItem = (item: FriendTransaction, index: number) => {
    const isPositive = item.amount > 0;
    const isSettlement = item.type === 'settlement';
    const friendName = friend?.user.name || params.name || 'Friend';

    // Settlement: thin line with neutral text, tappable to edit
    if (isSettlement) {
      const dateStr = formatSettlementDate(item.date);
      const settlementText =
        item.amount > 0
          ? `${friendName} paid you ${formatBalance(item.amount, item.currency)} on ${dateStr}`
          : `you paid ${friendName} ${formatBalance(Math.abs(item.amount), item.currency)} on ${dateStr}`;

      return (
        <MotiView
          key={item.id}
          from={{ opacity: 0, translateX: -20 }}
          animate={{ opacity: 1, translateX: 0 }}
          transition={{ type: 'spring', damping: 18, stiffness: 120, delay: Math.min(index * 50, 300) }}
        >
          <Pressable
            onPress={() => handleSettlementPress(item)}
            style={({ pressed }) => [
              styles.settlementContainer,
              { opacity: pressed ? 0.7 : 1 },
            ]}
          >
            <View style={[styles.settlementLine, { backgroundColor: settlementLineColor }]} />
            <Text style={[styles.settlementText, { color: settlementTextColor }]} numberOfLines={1}>
              {settlementText}
            </Text>
            <View style={[styles.settlementLine, { backgroundColor: settlementLineColor }]} />
          </Pressable>
        </MotiView>
      );
    }

    // Expense: card layout with colors
    const amountColor = isPositive ? colors.success : colors.error;
    const amountLabel = isPositive ? 'you get' : 'you owe';

    const content = (
      <View style={[styles.transactionItem, { backgroundColor: cardBg }]}>
        {/* Icon */}
        <View
          style={[
            styles.transactionIcon,
            {
              backgroundColor: item.category_color
                ? item.category_color + '20'
                : isPositive ? colors.success + '20' : colors.error + '20',
            },
          ]}
        >
          {item.category_icon ? (
            <Text style={styles.transactionIconEmoji}>{item.category_icon}</Text>
          ) : (
            <Ionicons
              name="receipt-outline"
              size={18}
              color={isPositive ? colors.success : colors.error}
            />
          )}
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
            {amountLabel}
          </Text>
          <Text style={[styles.transactionAmount, { color: amountColor }]}>
            {formatBalance(item.amount, item.currency)}
          </Text>
        </View>

        <Ionicons name="chevron-forward" size={16} color={secondaryTextColor} style={{ marginLeft: 4 }} />
      </View>
    );

    return (
      <MotiView
        key={item.id}
        from={{ opacity: 0, translateX: -20, scale: 0.95 }}
        animate={{ opacity: 1, translateX: 0, scale: 1 }}
        transition={{ type: 'spring', damping: 18, stiffness: 120, delay: Math.min(index * 50, 300) }}
      >
        <Pressable
          onPress={() => handleTransactionPress(item)}
          style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1 })}
        >
          {content}
        </Pressable>
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
          {/* Friend info skeleton */}
          <View style={[styles.friendCard, { backgroundColor: cardBg }]}>
            <Skeleton width={72} height={72} circle />
            <View style={{ alignItems: 'center', marginTop: 16 }}>
              <Skeleton width={120} height={20} borderRadius={6} />
              <View style={{ height: 8 }} />
              <Skeleton width={80} height={14} borderRadius={4} />
            </View>
            <View style={{ flexDirection: 'row', gap: 12, marginTop: 20 }}>
              <Skeleton width={120} height={40} borderRadius={20} />
              <Skeleton width={100} height={40} borderRadius={20} />
            </View>
          </View>
          
          {/* Groups skeleton */}
          <View style={{ padding: 16 }}>
            <Skeleton width={120} height={16} borderRadius={4} />
            <View style={{ height: 16 }} />
            <SkeletonCard />
          </View>
          
          {/* Transactions skeleton */}
          <View style={{ padding: 16, paddingTop: 0 }}>
            <Skeleton width={140} height={16} borderRadius={4} />
            <View style={{ height: 16 }} />
            <SkeletonActivityList count={3} />
          </View>
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

  // Show offline empty state when no cached data available
  if (!isOnline && !isLoading && !friend) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor }]} edges={['top']}>
        <View style={styles.header}>
          <Pressable onPress={handleBack} style={styles.backButton}>
            <Ionicons name="arrow-back" size={24} color={textColor} />
          </Pressable>
          <Text style={[styles.headerTitle, { color: textColor }]}>{params.name || 'Friend'}</Text>
          <View style={styles.backButton} />
        </View>
        <View style={styles.errorContainer}>
          <EmptyState
            icon="cloud-offline-outline"
            title="No cached data"
            description="Connect to the internet to view this friend's details"
          />
        </View>
      </SafeAreaView>
    );
  }

  const friendName = friend?.user.name || params.name || 'Friend';
  const balance = friend?.total_balance || 0;
  const balanceColor = getBalanceColor(balance);

  const currencySymbol = CURRENCIES[friend?.primary_currency || 'INR']?.symbol || '₹';

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
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
          from={{ opacity: 0, translateY: 20, scale: 0.95 }}
          animate={{ opacity: 1, translateY: 0, scale: 1 }}
          transition={{ type: 'spring', damping: 18, stiffness: 120 }}
          style={[styles.friendCard, { backgroundColor: cardBg }]}
        >
          <View style={[styles.avatar, { backgroundColor: colors.primary[500] }]}>
            {friend?.user.avatar_url ? (
              <Image
                source={{ uri: friend.user.avatar_url }}
                style={styles.avatarImage}
                contentFit="cover"
                transition={200}
              />
            ) : (
              <Text style={styles.avatarText}>{getInitials(friendName)}</Text>
            )}
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
            from={{ opacity: 0, translateY: 10 }}
            animate={{ opacity: 1, translateY: 0 }}
            transition={{ type: 'spring', damping: 18, stiffness: 120, delay: 100 }}
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
        {(currentPhase.length > 0 || isFullySettled || hasOlderPhases) && (
          <MotiView
            from={{ opacity: 0, translateY: 10 }}
            animate={{ opacity: 1, translateY: 0 }}
            transition={{ type: 'spring', damping: 18, stiffness: 120, delay: 180 }}
          >
            <View style={styles.sectionHeader}>
              <Text style={[styles.sectionTitle, { color: textColor }]}>
                All Transactions
              </Text>
              <Text style={[styles.sectionSubtitle, { color: secondaryTextColor }]}>
                {isFullySettled && hasOlderPhases && olderPhases.length === 0
                  ? 'View history'
                  : `${currentPhase.length + olderPhases.flat().length} item${(currentPhase.length + olderPhases.flat().length) !== 1 ? 's' : ''}`}
              </Text>
            </View>

            {/* Current phase transactions */}
            {!isFullySettled && (
              <View style={styles.transactionsList}>
                {currentPhase.map((tx, index) => renderTransactionItem(tx, index))}
              </View>
            )}

            {/* Fully settled state */}
            {isFullySettled && (
              <View style={[styles.settledState, { backgroundColor: cardBg }]}>
                <View style={[styles.settledStateIcon, { backgroundColor: colors.success + '20' }]}>
                  <Ionicons name="checkmark-circle" size={48} color={colors.success} />
                </View>
                <Text style={[styles.settledStateTitle, { color: textColor }]}>
                  All settled up!
                </Text>
                <Text style={[styles.settledStateText, { color: secondaryTextColor }]}>
                  You and {friendName.split(' ')[0]} are all square. No one owes anyone.
                </Text>
              </View>
            )}

            {/* View old transactions */}
            {hasOlderPhases && (
              <View style={styles.viewOlderContainer}>
                {olderPhases.length === 0 ? (
                  <Pressable
                    onPress={loadOlderPhase}
                    disabled={isLoadingOlder}
                    style={({ pressed }) => [
                      styles.viewOlderButton,
                      { opacity: pressed ? 0.7 : 1 },
                    ]}
                  >
                    {isLoadingOlder ? (
                      <ActivityIndicator size="small" color={colors.primary[500]} />
                    ) : (
                      <Text style={[styles.viewOlderText, { color: colors.primary[500] }]}>
                        View old transactions
                      </Text>
                    )}
                  </Pressable>
                ) : (
                  <>
                    {olderPhases.map((phase, phaseIdx) => (
                      <View
                        key={`phase-${phaseIdx}`}
                        style={[styles.transactionsList, styles.olderPhaseList]}
                      >
                        {phase.map((tx, index) =>
                          renderTransactionItem(tx, currentPhase.length + phaseIdx * 100 + index)
                        )}
                      </View>
                    ))}
                    {hasMoreOlder && (
                      <Pressable
                        onPress={loadOlderPhase}
                        disabled={isLoadingOlder}
                        style={({ pressed }) => [
                          styles.viewOlderButton,
                          { opacity: pressed ? 0.7 : 1 },
                        ]}
                      >
                        {isLoadingOlder ? (
                          <ActivityIndicator size="small" color={colors.primary[500]} />
                        ) : (
                          <Text style={[styles.viewOlderText, { color: colors.primary[500] }]}>
                            View older
                          </Text>
                        )}
                      </Pressable>
                    )}
                  </>
                )}
              </View>
            )}
          </MotiView>
        )}

        {/* Empty State */}
        {currentPhase.length === 0 && !isFullySettled && !hasOlderPhases && groupBalances.length === 0 && !isLoading && (
          <View style={[styles.emptyState, { backgroundColor: cardBg }]}>
            <EmptyState
              icon="wallet-outline"
              title="No transactions yet"
              description="Add an expense to start tracking your shared expenses with this friend"
              actionLabel="Add Expense"
              onAction={handleAddExpense}
              compact
            />
          </View>
        )}
      </ScrollView>

        <EditSettlementSheet
          ref={editSheetRef}
          amount={editAmount}
          notes={editNotes}
          onAmountChange={setEditAmount}
          onNotesChange={setEditNotes}
          onCancel={handleCloseEditSheet}
          onUpdate={handleUpdateSettlement}
          isUpdating={isUpdating}
          currencySymbol={currencySymbol}
        />
      </SafeAreaView>
    </GestureHandlerRootView>
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
    overflow: 'hidden',
  },
  avatarImage: {
    width: 72,
    height: 72,
    borderRadius: 36,
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
  settledState: {
    alignItems: 'center',
    padding: 32,
    borderRadius: 16,
    marginBottom: 16,
  },
  settledStateIcon: {
    width: 80,
    height: 80,
    borderRadius: 40,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  settledStateTitle: {
    fontSize: 20,
    fontWeight: '700',
    marginBottom: 8,
  },
  settledStateText: {
    fontSize: 15,
    textAlign: 'center',
    marginBottom: 20,
  },
  viewOlderContainer: {
    marginTop: 16,
    alignItems: 'center',
  },
  olderPhaseList: {
    alignSelf: 'stretch',
  },
  viewOlderButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 6,
    paddingHorizontal: 12,
  },
  viewOlderText: {
    fontSize: 13,
    fontWeight: '500',
  },
  settlementContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    gap: 12,
  },
  settlementLine: {
    flex: 1,
    height: 1,
  },
  settlementText: {
    fontSize: 13,
    fontWeight: '500',
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
  transactionIconEmoji: {
    fontSize: 18,
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

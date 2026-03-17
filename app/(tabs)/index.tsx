/**
 * Home Screen
 * 
 * Main dashboard showing user summary and quick actions.
 */

import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { router } from 'expo-router';
import { FlashList } from '@shopify/flash-list';
import { MotiView } from 'moti';
import { useCallback, useMemo, useState } from 'react';
import { Alert, Pressable, RefreshControl, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

import { Avatar } from '@/components/ui/avatar';
import { EmptyState } from '@/components/ui/empty-state';
import { Skeleton, SkeletonActivityList } from '@/components/ui/skeleton';
import { colors } from '@/constants/colors';
import { useAuth } from '@/contexts/auth-context';
import { useSync } from '@/contexts/sync-context';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useFriends } from '@/hooks/use-friends';
import { useRecentActivity, type ActivityItem } from '@/hooks/use-recent-activity';
import { useUser } from '@/hooks/use-user';
import { hapticLight, hapticWarning } from '@/lib/haptics';
import { formatCurrency } from '@/lib/utils';

/**
 * HomeHeader — stable module-level component so FlashList never remounts it.
 *
 * Defined outside HomeScreen so its reference is constant across renders.
 * This prevents FlashList from unmounting/remounting the header when reactive
 * state (e.g. isLoadingFriends) changes inside HomeScreen, which would
 * otherwise cause all entry MotiView animations to replay.
 */
function HomeHeader() {
  const colorScheme = useColorScheme() ?? 'light';
  const isDark = colorScheme === 'dark';
  const { user: authUser } = useAuth();
  const { user } = useUser();
  const { isOnline } = useSync();
  const { friends, isLoading: isLoadingFriends } = useFriends();

  const textColor = isDark ? colors.text.dark.primary : colors.text.light.primary;
  const secondaryTextColor = isDark ? colors.text.dark.secondary : colors.text.light.secondary;
  const cardBg = isDark ? colors.gray[800] : colors.white;

  const balanceSummary = useMemo(() => {
    if (!friends || friends.length === 0) {
      return { totalOwed: 0, totalOwing: 0, netBalance: 0 };
    }
    let totalOwed = 0;
    let totalOwing = 0;
    friends.forEach(friend => {
      if (friend.total_balance > 0) totalOwed += friend.total_balance;
      else if (friend.total_balance < 0) totalOwing += Math.abs(friend.total_balance);
    });
    return { totalOwed, totalOwing, netBalance: totalOwed - totalOwing };
  }, [friends]);

  const userName = user?.name || authUser?.user_metadata?.name || 'User';

  const handleAddExpense = useCallback(() => {
    if (!isOnline) {
      hapticWarning();
      Alert.alert('No Connection', 'Adding expenses requires an internet connection.', [{ text: 'OK' }]);
      return;
    }
    hapticLight();
    router.push('/add-expense');
  }, [isOnline]);

  const handleCreateGroup = useCallback(() => {
    hapticLight();
    router.push('/create-group');
  }, []);

  const handleSettleUp = useCallback(() => {
    if (!isOnline) {
      hapticWarning();
      Alert.alert('No Connection', 'Settling up requires an internet connection.', [{ text: 'OK' }]);
      return;
    }
    hapticLight();
    router.push('/settle-up');
  }, [isOnline]);

  return (
    <>
      {/* Header */}
      <MotiView
        from={{ opacity: 0, translateY: -20 }}
        animate={{ opacity: 1, translateY: 0 }}
        transition={{ type: 'spring', damping: 18, stiffness: 100 }}
        style={styles.header}
      >
        <View style={styles.headerLeft}>
          <Text style={[styles.greeting, { color: secondaryTextColor }]}>
            Welcome back,
          </Text>
          <Text style={[styles.name, { color: textColor }]}>
            {userName} 👋
          </Text>
        </View>
        <Pressable
          onPress={() => router.push('/(tabs)/profile')}
          style={({ pressed }) => [
            styles.avatarButton,
            { opacity: pressed ? 0.7 : 1 },
          ]}
        >
          <Avatar user={{ name: userName, avatar_url: user?.avatar_url ?? null }} size={44} />
        </Pressable>
      </MotiView>

      {/* Balance Summary Card */}
      <MotiView
        from={{ opacity: 0, translateY: 20, scale: 0.95 }}
        animate={{ opacity: 1, translateY: 0, scale: 1 }}
        transition={{ type: 'spring', damping: 18, stiffness: 100, delay: 150 }}
        style={[
          styles.balanceCard,
          {
            backgroundColor: balanceSummary.netBalance >= 0
              ? colors.success
              : colors.error,
          },
        ]}
      >
        <Text style={styles.balanceLabel}>
          {balanceSummary.netBalance >= 0 ? 'You are owed' : 'You owe'}
        </Text>
        {isLoadingFriends ? (
          <>
            <Skeleton width={130} height={38} borderRadius={8} style={{ marginVertical: 4, opacity: 0.35 }} />
            <View style={{ flexDirection: 'row', gap: 16, marginTop: 10 }}>
              <Skeleton width={95} height={18} borderRadius={6} style={{ opacity: 0.3 }} />
              <Skeleton width={95} height={18} borderRadius={6} style={{ opacity: 0.3 }} />
            </View>
          </>
        ) : (
          <>
            <Text style={styles.balanceValue}>
              {formatCurrency(Math.abs(balanceSummary.netBalance))}
            </Text>
            <View style={styles.balanceRow}>
              <View style={styles.balanceItem}>
                <Ionicons name="arrow-up-circle" size={20} color={colors.white} />
                <View>
                  <Text style={styles.balanceItemLabel}>You get back</Text>
                  <Text style={styles.balanceItemValue}>
                    {formatCurrency(balanceSummary.totalOwed)}
                  </Text>
                </View>
              </View>
              <View style={styles.balanceDivider} />
              <View style={styles.balanceItem}>
                <Ionicons name="arrow-down-circle" size={20} color={colors.white} />
                <View>
                  <Text style={styles.balanceItemLabel}>You owe</Text>
                  <Text style={styles.balanceItemValue}>
                    {formatCurrency(balanceSummary.totalOwing)}
                  </Text>
                </View>
              </View>
            </View>
          </>
        )}
      </MotiView>

      {/* Quick Actions */}
      <MotiView
        from={{ opacity: 0, translateY: 20 }}
        animate={{ opacity: 1, translateY: 0 }}
        transition={{ type: 'spring', damping: 18, stiffness: 120, delay: 300 }}
      >
        <Text style={[styles.sectionTitle, { color: textColor }]}>Quick Actions</Text>
        <View style={styles.actionsRow}>
          <Pressable
            onPress={handleAddExpense}
            style={({ pressed }) => [
              styles.actionCard,
              {
                backgroundColor: cardBg,
                opacity: pressed ? 0.9 : 1,
                transform: [{ scale: pressed ? 0.95 : 1 }],
              },
            ]}
          >
            <View style={[styles.actionIcon, { backgroundColor: colors.primary[100] }]}>
              <Ionicons name="add" size={28} color={colors.primary[500]} />
            </View>
            <Text style={[styles.actionLabel, { color: textColor }]}>Add Expense</Text>
          </Pressable>
          <Pressable
            onPress={handleCreateGroup}
            style={({ pressed }) => [
              styles.actionCard,
              {
                backgroundColor: cardBg,
                opacity: pressed ? 0.9 : 1,
                transform: [{ scale: pressed ? 0.95 : 1 }],
              },
            ]}
          >
            <View style={[styles.actionIcon, { backgroundColor: colors.primary[100] }]}>
              <Ionicons name="people" size={28} color={colors.primary[500]} />
            </View>
            <Text style={[styles.actionLabel, { color: textColor }]}>Create Group</Text>
          </Pressable>
          <Pressable
            onPress={handleSettleUp}
            style={({ pressed }) => [
              styles.actionCard,
              {
                backgroundColor: cardBg,
                opacity: pressed ? 0.9 : 1,
                transform: [{ scale: pressed ? 0.95 : 1 }],
              },
            ]}
          >
            <View style={[styles.actionIcon, { backgroundColor: colors.warning + '20' }]}>
              <Ionicons name="wallet-outline" size={28} color={colors.warning} />
            </View>
            <Text style={[styles.actionLabel, { color: textColor }]}>Settle Up</Text>
          </Pressable>
        </View>
      </MotiView>

      {/* Recent Activity title */}
      <MotiView
        from={{ opacity: 0, translateY: 20 }}
        animate={{ opacity: 1, translateY: 0 }}
        transition={{ type: 'spring', damping: 18, stiffness: 100, delay: 350 }}
      >
        <Text style={[styles.sectionTitle, { color: textColor }]}>Recent Activity</Text>
      </MotiView>
    </>
  );
}

export default function HomeScreen() {
  const colorScheme = useColorScheme() ?? 'light';
  const isDark = colorScheme === 'dark';
  const insets = useSafeAreaInsets();
  const { user } = useUser();
  const { isOnline } = useSync();
  const { friends, isLoading: isLoadingFriends, refresh: refreshFriends } = useFriends();
  const { activities, isLoading: isLoadingActivity, refresh: refreshActivity } = useRecentActivity();
  const [refreshing, setRefreshing] = useState(false);

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    await Promise.all([refreshFriends(), refreshActivity()]);
    setRefreshing(false);
  }, [refreshFriends, refreshActivity]);

  // Refetch when screen comes into focus (e.g., after adding expense)
  useFocusEffect(
    useCallback(() => {
      if (isOnline) {
        refreshFriends();
        refreshActivity();
      }
    }, [isOnline, refreshFriends, refreshActivity])
  );

  const textColor = isDark ? colors.text.dark.primary : colors.text.light.primary;
  const secondaryTextColor = isDark ? colors.text.dark.secondary : colors.text.light.secondary;
  const backgroundColor = isDark ? colors.background.dark : colors.background.light;
  const cardBg = isDark ? colors.gray[800] : colors.white;

  const handleActivityPress = (item: ActivityItem) => {
    if (item.type === 'expense') {
      hapticLight();
      router.push(`/expense/${item.id}`);
      return;
    }
    if (item.type === 'expense_group') {
      hapticLight();
      router.push(`/expense/group/${item.id}`);
    }
    // Settlements don't have a detail screen yet
  };

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    const now = new Date();
    const diffDays = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24));
    
    if (diffDays === 0) return 'Today';
    if (diffDays === 1) return 'Yesterday';
    if (diffDays < 7) return `${diffDays} days ago`;
    
    return date.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
  };

  const isLoading = isLoadingFriends || isLoadingActivity;
  const hasNoData = (!friends || friends.length === 0) && (!activities || activities.length === 0);

  // Show offline empty state when no cached data available
  if (!isOnline && !isLoading && hasNoData) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor }]} edges={['top']}>
        <View style={styles.offlineEmptyState}>
          <EmptyState
            icon="cloud-offline-outline"
            title="No cached data"
            description="Connect to the internet to load your dashboard"
          />
        </View>
      </SafeAreaView>
    );
  }

  const renderActivityItem = useCallback(({ item, index }: { item: ActivityItem; index: number }) => {
    const isSettlement = item.type === 'settlement';
    const isYouPaid = item.paid_by.id === user?.id;
    const isGrouped = item.type === 'expense_group' && (item.line_count ?? 0) > 1;

    return (
      <MotiView
        from={{ opacity: 0, translateX: -20, scale: 0.95 }}
        animate={{ opacity: 1, translateX: 0, scale: 1 }}
        transition={{
          type: 'spring',
          damping: 18,
          stiffness: 120,
          delay: Math.min(index * 60, 300),
        }}
      >
        <Pressable
          onPress={() => handleActivityPress(item)}
          style={({ pressed }) => [
            styles.activityItem,
            {
              backgroundColor: cardBg,
              opacity: pressed ? 0.9 : 1,
              transform: [{ scale: pressed ? 0.98 : 1 }],
            },
          ]}
        >
          {/* Icon */}
          <View
            style={[
              styles.activityIcon,
              {
                backgroundColor: isSettlement
                  ? colors.primary[100]
                  : colors.gray[100],
              },
            ]}
          >
            {item.category_icon ? (
              <Text style={styles.activityEmoji}>{item.category_icon}</Text>
            ) : (
              <Ionicons
                name={isSettlement ? 'swap-horizontal' : 'receipt-outline'}
                size={18}
                color={isSettlement ? colors.success : colors.gray[600]}
              />
            )}
          </View>

          {/* Details */}
          <View style={styles.activityDetails}>
            <Text style={[styles.activityDescription, { color: textColor }]} numberOfLines={1}>
              {isSettlement
                ? (isYouPaid
                    ? `You paid ${item.paid_to?.name}`
                    : `${item.paid_by.name} paid you`)
                : item.description
              }
            </Text>
            <View style={styles.activityMeta}>
              <Text style={[styles.activityDate, { color: secondaryTextColor }]}>
                {formatDate(item.date)}
              </Text>
              {isGrouped && (
                <>
                  <Text style={[styles.activityDot, { color: secondaryTextColor }]}>•</Text>
                  <Text style={[styles.activityDate, { color: secondaryTextColor }]}>
                    {item.line_count} parts
                  </Text>
                </>
              )}
              {item.group_name && (
                <>
                  <Text style={[styles.activityDot, { color: secondaryTextColor }]}>•</Text>
                  <Text style={[styles.activityGroup, { color: secondaryTextColor }]} numberOfLines={1}>
                    {item.group_name}
                  </Text>
                </>
              )}
            </View>
          </View>

          {/* Amount */}
          <View style={styles.activityAmountContainer}>
            {isSettlement ? (
              <Text style={[styles.activityAmount, { color: colors.success }]}>
                {formatCurrency(item.amount, item.currency)}
              </Text>
            ) : (
              <>
                <Text style={[styles.activityAmount, { color: textColor }]}>
                  {formatCurrency(item.amount, item.currency)}
                </Text>
                {item.your_share !== undefined && item.your_share > 0 && (
                  <Text style={[styles.activityShare, { color: colors.error }]}>
                    you owe {formatCurrency(item.your_share, item.currency)}
                  </Text>
                )}
                {isYouPaid && (
                  <Text style={[styles.activityShare, { color: colors.success }]}>
                    you paid
                  </Text>
                )}
              </>
            )}
          </View>

          {/* Chevron for expenses */}
          {!isSettlement && (
            <Ionicons name="chevron-forward" size={16} color={secondaryTextColor} />
          )}
        </Pressable>
      </MotiView>
    );
  }, [user?.id, cardBg, textColor, secondaryTextColor, handleActivityPress, formatDate]);

  return (
    <SafeAreaView style={[styles.container, { backgroundColor }]} edges={['top']}>
      <FlashList
        data={activities}
        renderItem={renderActivityItem}
        keyExtractor={(item) => item.id}
        ListHeaderComponent={HomeHeader}
        ListEmptyComponent={
          isLoadingActivity ? (
            <SkeletonActivityList count={4} />
          ) : (
            <View style={[styles.emptyState, { backgroundColor: cardBg }]}>
              <EmptyState
                icon="time-outline"
                title="No recent activity"
                description="Your expenses and settlements will appear here"
                compact
              />
            </View>
          )
        }
        contentContainerStyle={[styles.contentContainer, { paddingBottom: insets.bottom + 73 }]}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
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
  offlineEmptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 24,
  },
  contentContainer: {
    paddingHorizontal: 24,
    paddingTop: 20,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 24,
  },
  headerLeft: {
    flex: 1,
  },
  greeting: {
    fontSize: 14,
  },
  name: {
    fontSize: 24,
    fontWeight: '700',
  },
  avatarButton: {
    marginLeft: 16,
  },
  balanceCard: {
    borderRadius: 20,
    padding: 24,
    marginBottom: 24,
  },
  balanceLabel: {
    fontSize: 14,
    color: colors.white,
    opacity: 0.8,
    marginBottom: 4,
  },
  balanceValue: {
    fontSize: 36,
    fontWeight: '700',
    color: colors.white,
    marginBottom: 20,
  },
  balanceRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  balanceItem: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  balanceItemLabel: {
    fontSize: 12,
    color: colors.white,
    opacity: 0.8,
  },
  balanceItemValue: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.white,
  },
  balanceDivider: {
    width: 1,
    height: 40,
    backgroundColor: colors.white,
    opacity: 0.3,
    marginHorizontal: 16,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 16,
  },
  actionsRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 24,
  },
  actionCard: {
    flex: 1,
    alignItems: 'center',
    padding: 16,
    borderRadius: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  actionIcon: {
    width: 56,
    height: 56,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  actionLabel: {
    fontSize: 12,
    fontWeight: '500',
    textAlign: 'center',
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
    borderRadius: 20,
  },
  emptyStateTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginTop: 16,
    marginBottom: 4,
  },
  emptyStateText: {
    fontSize: 14,
    textAlign: 'center',
  },
  activityItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 14,
    marginBottom: 8,
  },
  activityIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  activityEmoji: {
    fontSize: 18,
  },
  activityDetails: {
    flex: 1,
    marginLeft: 12,
  },
  activityDescription: {
    fontSize: 15,
    fontWeight: '500',
    marginBottom: 2,
  },
  activityMeta: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  activityDate: {
    fontSize: 12,
  },
  activityDot: {
    marginHorizontal: 4,
    fontSize: 12,
  },
  activityGroup: {
    fontSize: 12,
    maxWidth: 80,
  },
  activityAmountContainer: {
    alignItems: 'flex-end',
    marginLeft: 8,
  },
  activityAmount: {
    fontSize: 14,
    fontWeight: '600',
  },
  activityShare: {
    fontSize: 11,
    marginTop: 2,
  },
});


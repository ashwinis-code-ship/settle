/**
 * Friends Screen
 * 
 * List of all friends (users shared in groups) with net balance.
 * Shows aggregated balance across all shared groups.
 */

import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { MotiView } from 'moti';
import { useCallback, useState } from 'react';
import {
  FlatList,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { EmptyState } from '@/components/ui/empty-state';
import { colors } from '@/constants/colors';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useFriends } from '@/hooks/use-friends';
import { hapticLight } from '@/lib/haptics';
import { CURRENCIES } from '@/types/database';
import type { Friend } from '@/types';

export default function FriendsScreen() {
  const colorScheme = useColorScheme() ?? 'light';
  const isDark = colorScheme === 'dark';
  const { friends, isLoading, error, refresh } = useFriends();
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

  const handleFriendPress = (friend: Friend) => {
    hapticLight();
    router.push({
      pathname: '/friend/[id]',
      params: { id: friend.user.id, name: friend.user.name },
    });
  };

  const handleAddExpense = (friend: Friend) => {
    hapticLight();
    router.push({
      pathname: '/add-expense',
      params: { friendId: friend.user.id, friendName: friend.user.name },
    });
  };

  const formatBalance = (balance: number, currency: string) => {
    const currencyInfo = CURRENCIES[currency as keyof typeof CURRENCIES] || CURRENCIES.INR;
    const absBalance = Math.abs(balance).toFixed(2);
    return `${currencyInfo.symbol}${absBalance}`;
  };

  const getBalanceColor = (balance: number) => {
    if (balance > 0) return colors.success;
    if (balance < 0) return colors.error;
    return secondaryTextColor;
  };

  const getBalanceText = (balance: number) => {
    if (balance > 0) return 'owes you';
    if (balance < 0) return 'you owe';
    return 'settled up';
  };

  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map((n) => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  // Generate a consistent avatar color based on name
  const getAvatarColor = (name: string) => {
    const avatarColors = [
      colors.primary[500],
      colors.success,
      colors.warning,
      '#9333EA', // purple
      '#EC4899', // pink
      '#06B6D4', // cyan
      '#F97316', // orange
      '#14B8A6', // teal
    ];
    const charSum = name.split('').reduce((sum, char) => sum + char.charCodeAt(0), 0);
    return avatarColors[charSum % avatarColors.length];
  };

  const renderFriendCard = ({ item, index }: { item: Friend; index: number }) => {
    const balance = item.total_balance;
    const balanceColor = getBalanceColor(balance);

    return (
      <MotiView
        from={{ opacity: 0, translateY: 20, scale: 0.95 }}
        animate={{ opacity: 1, translateY: 0, scale: 1 }}
        transition={{ 
          type: 'spring', 
          damping: 18,
          stiffness: 120,
          delay: Math.min(index * 70, 400),
        }}
      >
        <Pressable
          onPress={() => handleFriendPress(item)}
          style={({ pressed }) => [
            styles.friendCard,
            { 
              backgroundColor: cardBg, 
              opacity: pressed ? 0.9 : 1,
              transform: [{ scale: pressed ? 0.98 : 1 }],
            },
          ]}
        >
          {/* Friend Avatar */}
          <View style={[styles.friendAvatar, { backgroundColor: getAvatarColor(item.user.name) }]}>
            <Text style={styles.friendAvatarText}>{getInitials(item.user.name)}</Text>
          </View>

          {/* Friend Info */}
          <View style={styles.friendInfo}>
            <Text style={[styles.friendName, { color: textColor }]} numberOfLines={1}>
              {item.user.name}
            </Text>
            {item.shared_groups > 0 && (
              <Text style={[styles.friendMeta, { color: secondaryTextColor }]}>
                {item.shared_groups} shared group{item.shared_groups !== 1 ? 's' : ''}
              </Text>
            )}
          </View>

          {/* Balance */}
          <View style={styles.balanceContainer}>
            {balance !== 0 ? (
              <>
                <Text style={[styles.balanceLabel, { color: balanceColor }]}>
                  {getBalanceText(balance)}
                </Text>
                <Text style={[styles.balanceAmount, { color: balanceColor }]}>
                  {formatBalance(balance, item.primary_currency)}
                </Text>
              </>
            ) : (
              <View style={[styles.settledBadge, { backgroundColor: colors.gray[100] }]}>
                <Ionicons name="checkmark-circle" size={14} color={colors.success} />
                <Text style={[styles.settledText, { color: colors.success }]}>
                  Settled
                </Text>
              </View>
            )}
          </View>

          {/* Quick Add Button */}
          <Pressable
            onPress={() => handleAddExpense(item)}
            hitSlop={8}
            style={({ pressed }) => [
              styles.addButton,
              { opacity: pressed ? 0.6 : 1 },
            ]}
          >
            <Ionicons name="add-circle" size={28} color={colors.primary[500]} />
          </Pressable>
        </Pressable>
      </MotiView>
    );
  };

  const renderEmptyState = () => (
    <EmptyState
      illustration="🤝"
      isEmoji
      title="No friends yet"
      description="Friends will appear here when you share expenses in a group together"
      actionLabel="Create a Group"
      onAction={() => {
        hapticLight();
        router.push('/create-group');
      }}
    />
  );

  const renderHeader = () => (
    <MotiView
      from={{ opacity: 0, translateY: -20 }}
      animate={{ opacity: 1, translateY: 0 }}
      transition={{ type: 'timing', duration: 400 }}
      style={styles.header}
    >
      <View>
        <Text style={[styles.headerTitle, { color: textColor }]}>Friends</Text>
        <Text style={[styles.headerSubtitle, { color: secondaryTextColor }]}>
          {friends.length > 0
            ? `${friends.length} friend${friends.length !== 1 ? 's' : ''}`
            : 'Your shared expenses'}
        </Text>
      </View>
    </MotiView>
  );

  // Calculate summary
  const totalOwed = friends.reduce(
    (sum, f) => (f.total_balance > 0 ? sum + f.total_balance : sum),
    0
  );
  const totalOwe = friends.reduce(
    (sum, f) => (f.total_balance < 0 ? sum + Math.abs(f.total_balance) : sum),
    0
  );

  const renderSummary = () => {
    if (friends.length === 0) return null;

    return (
      <MotiView
        from={{ opacity: 0, translateY: 10 }}
        animate={{ opacity: 1, translateY: 0 }}
        transition={{ type: 'timing', duration: 400, delay: 100 }}
        style={[styles.summaryCard, { backgroundColor: cardBg }]}
      >
        <View style={styles.summaryItem}>
          <View style={[styles.summaryIcon, { backgroundColor: colors.success + '20' }]}>
            <Ionicons name="arrow-down-circle" size={20} color={colors.success} />
          </View>
          <View>
            <Text style={[styles.summaryLabel, { color: secondaryTextColor }]}>
              You are owed
            </Text>
            <Text style={[styles.summaryAmount, { color: colors.success }]}>
              ₹{totalOwed.toFixed(2)}
            </Text>
          </View>
        </View>
        <View style={[styles.summaryDivider, { backgroundColor: isDark ? colors.gray[700] : colors.gray[200] }]} />
        <View style={styles.summaryItem}>
          <View style={[styles.summaryIcon, { backgroundColor: colors.error + '20' }]}>
            <Ionicons name="arrow-up-circle" size={20} color={colors.error} />
          </View>
          <View>
            <Text style={[styles.summaryLabel, { color: secondaryTextColor }]}>
              You owe
            </Text>
            <Text style={[styles.summaryAmount, { color: colors.error }]}>
              ₹{totalOwe.toFixed(2)}
            </Text>
          </View>
        </View>
      </MotiView>
    );
  };

  if (error) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor }]} edges={['top']}>
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

  return (
    <SafeAreaView style={[styles.container, { backgroundColor }]} edges={['top']}>
      <FlatList
        data={friends}
        renderItem={renderFriendCard}
        keyExtractor={(item) => item.user.id}
        contentContainerStyle={styles.listContent}
        ListHeaderComponent={
          <>
            {renderHeader()}
            {renderSummary()}
          </>
        }
        ListEmptyComponent={!isLoading ? renderEmptyState : null}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={colors.primary[500]}
          />
        }
        showsVerticalScrollIndicator={false}
        ItemSeparatorComponent={() => <View style={styles.separator} />}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  listContent: {
    padding: 16,
    paddingBottom: 100,
  },
  header: {
    marginBottom: 16,
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: '700',
  },
  headerSubtitle: {
    fontSize: 14,
    marginTop: 4,
  },
  summaryCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderRadius: 16,
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  summaryItem: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  summaryIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  summaryLabel: {
    fontSize: 12,
  },
  summaryAmount: {
    fontSize: 16,
    fontWeight: '700',
  },
  summaryDivider: {
    width: 1,
    height: 40,
    marginHorizontal: 12,
  },
  friendCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    borderRadius: 14,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  friendAvatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  friendAvatarText: {
    color: colors.white,
    fontSize: 16,
    fontWeight: '700',
  },
  friendInfo: {
    flex: 1,
    marginLeft: 12,
  },
  friendName: {
    fontSize: 16,
    fontWeight: '600',
  },
  friendMeta: {
    fontSize: 13,
    marginTop: 2,
  },
  balanceContainer: {
    alignItems: 'flex-end',
    marginRight: 8,
  },
  balanceLabel: {
    fontSize: 11,
    fontWeight: '500',
    textTransform: 'lowercase',
  },
  balanceAmount: {
    fontSize: 15,
    fontWeight: '700',
    marginTop: 2,
  },
  settledBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    gap: 4,
  },
  settledText: {
    fontSize: 12,
    fontWeight: '600',
  },
  addButton: {
    padding: 4,
  },
  separator: {
    height: 10,
  },
  emptyState: {
    alignItems: 'center',
    padding: 32,
    borderRadius: 20,
    marginTop: 40,
  },
  emptyIcon: {
    width: 80,
    height: 80,
    borderRadius: 40,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: '600',
    marginBottom: 8,
  },
  emptyText: {
    fontSize: 14,
    textAlign: 'center',
    marginBottom: 24,
    paddingHorizontal: 16,
  },
  emptyButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 12,
    gap: 8,
  },
  emptyButtonText: {
    color: colors.white,
    fontSize: 16,
    fontWeight: '600',
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

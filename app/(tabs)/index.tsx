/**
 * Home Screen
 * 
 * Main dashboard showing user summary and quick actions.
 */

import { Ionicons } from '@expo/vector-icons';
import { MotiView } from 'moti';
import { useCallback, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';

import { colors } from '@/constants/colors';
import { useAuth } from '@/contexts/auth-context';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useFriends } from '@/hooks/use-friends';
import { useRecentActivity, type ActivityItem } from '@/hooks/use-recent-activity';
import { formatCurrency } from '@/lib/utils';

export default function HomeScreen() {
  const colorScheme = useColorScheme() ?? 'light';
  const isDark = colorScheme === 'dark';
  const { user } = useAuth();
  const { friends, isLoading: isLoadingFriends, refresh: refreshFriends } = useFriends();
  const { activities, isLoading: isLoadingActivity, refresh: refreshActivity } = useRecentActivity();
  const [refreshing, setRefreshing] = useState(false);

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    await Promise.all([refreshFriends(), refreshActivity()]);
    setRefreshing(false);
  }, [refreshFriends, refreshActivity]);

  const textColor = isDark ? colors.text.dark.primary : colors.text.light.primary;
  const secondaryTextColor = isDark ? colors.text.dark.secondary : colors.text.light.secondary;
  const backgroundColor = isDark ? colors.background.dark : colors.background.light;
  const cardBg = isDark ? colors.gray[800] : colors.white;

  // Calculate balance summary from friends data
  const balanceSummary = useMemo(() => {
    if (!friends || friends.length === 0) {
      return { totalOwed: 0, totalOwing: 0, netBalance: 0 };
    }

    let totalOwed = 0;  // Others owe you (positive balances)
    let totalOwing = 0; // You owe others (negative balances)

    friends.forEach(friend => {
      if (friend.total_balance > 0) {
        totalOwed += friend.total_balance;
      } else if (friend.total_balance < 0) {
        totalOwing += Math.abs(friend.total_balance);
      }
    });

    return {
      totalOwed,
      totalOwing,
      netBalance: totalOwed - totalOwing,
    };
  }, [friends]);

  // Get user info from metadata
  const userName = user?.user_metadata?.name || 'User';
  const userInitials = userName
    .split(' ')
    .map((n: string) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);

  const handleAddExpense = () => {
    router.push('/add-expense');
  };

  const handleCreateGroup = () => {
    router.push('/create-group');
  };

  const handleSettleUp = () => {
    router.push('/settle-up');
  };

  const handleActivityPress = (item: ActivityItem) => {
    if (item.type === 'expense') {
      router.push(`/expense/${item.id}`);
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

  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map((n) => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor }]} edges={['top']}>
      <ScrollView
        style={styles.content}
        contentContainerStyle={styles.contentContainer}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            tintColor={colors.primary[500]}
            colors={[colors.primary[500]]}
          />
        }
      >
        {/* Header */}
        <MotiView
          from={{ opacity: 0, translateY: -20 }}
          animate={{ opacity: 1, translateY: 0 }}
          transition={{ type: 'timing', duration: 500 }}
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
            <View style={[styles.avatarSmall, { backgroundColor: colors.primary[500] }]}>
              <Text style={styles.avatarSmallText}>{userInitials}</Text>
            </View>
          </Pressable>
        </MotiView>

        {/* Balance Summary Card */}
        <MotiView
          from={{ opacity: 0, translateY: 20 }}
          animate={{ opacity: 1, translateY: 0 }}
          transition={{ type: 'timing', duration: 500, delay: 200 }}
          style={[
            styles.balanceCard, 
            { 
              backgroundColor: balanceSummary.netBalance >= 0 
                ? colors.primary[500] 
                : colors.error 
            }
          ]}
        >
          <Text style={styles.balanceLabel}>
            {balanceSummary.netBalance >= 0 ? 'You are owed' : 'You owe'}
          </Text>
          {isLoadingFriends ? (
            <ActivityIndicator color={colors.white} size="small" style={{ marginVertical: 12 }} />
          ) : (
            <Text style={styles.balanceValue}>
              {formatCurrency(Math.abs(balanceSummary.netBalance))}
            </Text>
          )}
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
        </MotiView>

        {/* Quick Actions */}
        <MotiView
          from={{ opacity: 0, translateY: 20 }}
          animate={{ opacity: 1, translateY: 0 }}
          transition={{ type: 'timing', duration: 500, delay: 300 }}
        >
          <Text style={[styles.sectionTitle, { color: textColor }]}>Quick Actions</Text>
          <View style={styles.actionsRow}>
            <Pressable 
              onPress={handleAddExpense}
              style={({ pressed }) => [
                styles.actionCard,
                { backgroundColor: cardBg, opacity: pressed ? 0.8 : 1 },
              ]}
            >
              <View style={[styles.actionIcon, { backgroundColor: colors.primary[100] }]}>
                <Ionicons name="add-circle-outline" size={28} color={colors.primary[500]} />
              </View>
              <Text style={[styles.actionLabel, { color: textColor }]}>Add Expense</Text>
            </Pressable>
            
            <Pressable 
              onPress={handleCreateGroup}
              style={({ pressed }) => [
                styles.actionCard,
                { backgroundColor: cardBg, opacity: pressed ? 0.8 : 1 },
              ]}
            >
              <View style={[styles.actionIcon, { backgroundColor: colors.success + '20' }]}>
                <Ionicons name="people-outline" size={28} color={colors.success} />
              </View>
              <Text style={[styles.actionLabel, { color: textColor }]}>Create Group</Text>
            </Pressable>
            
            <Pressable 
              onPress={handleSettleUp}
              style={({ pressed }) => [
                styles.actionCard,
                { backgroundColor: cardBg, opacity: pressed ? 0.8 : 1 },
              ]}
            >
              <View style={[styles.actionIcon, { backgroundColor: colors.warning + '20' }]}>
                <Ionicons name="wallet-outline" size={28} color={colors.warning} />
              </View>
              <Text style={[styles.actionLabel, { color: textColor }]}>Settle Up</Text>
            </Pressable>
          </View>
        </MotiView>

        {/* Recent Activity */}
        <MotiView
          from={{ opacity: 0, translateY: 20 }}
          animate={{ opacity: 1, translateY: 0 }}
          transition={{ type: 'timing', duration: 500, delay: 400 }}
          style={styles.recentSection}
        >
          <Text style={[styles.sectionTitle, { color: textColor }]}>Recent Activity</Text>
          
          {isLoadingActivity ? (
            <View style={[styles.emptyState, { backgroundColor: cardBg }]}>
              <ActivityIndicator size="small" color={colors.primary[500]} />
            </View>
          ) : activities.length === 0 ? (
            <View style={[styles.emptyState, { backgroundColor: cardBg }]}>
              <Ionicons name="receipt-outline" size={48} color={colors.gray[400]} />
              <Text style={[styles.emptyStateTitle, { color: textColor }]}>
                No recent activity
              </Text>
              <Text style={[styles.emptyStateText, { color: secondaryTextColor }]}>
                Your expenses and settlements will appear here
              </Text>
            </View>
          ) : (
            <View style={styles.activityList}>
              {activities.map((item, index) => {
                const isSettlement = item.type === 'settlement';
                const isYouPaid = item.paid_by.id === user?.id;
                
                return (
                  <MotiView
                    key={item.id}
                    from={{ opacity: 0, translateX: -20 }}
                    animate={{ opacity: 1, translateX: 0 }}
                    transition={{ type: 'timing', duration: 300, delay: index * 50 }}
                  >
                    <Pressable
                      onPress={() => handleActivityPress(item)}
                      style={({ pressed }) => [
                        styles.activityItem,
                        { backgroundColor: cardBg, opacity: pressed ? 0.8 : 1 },
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
                            color={isSettlement ? colors.primary[500] : colors.gray[600]}
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
                          <Text style={[styles.activityAmount, { color: colors.primary[500] }]}>
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
              })}
            </View>
          )}
        </MotiView>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    flex: 1,
  },
  contentContainer: {
    paddingHorizontal: 24,
    paddingTop: 20,
    paddingBottom: 24,
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
  avatarSmall: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarSmallText: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.white,
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
  recentSection: {
    flex: 1,
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
  // Activity feed styles
  activityList: {
    flex: 1,
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


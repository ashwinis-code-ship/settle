/**
 * Groups Screen
 * 
 * List of all groups the user is a member of.
 * Shows balance summary per group.
 */

import { useState, useCallback } from 'react';
import {
  StyleSheet,
  View,
  Text,
  FlatList,
  Pressable,
  RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MotiView } from 'moti';
import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { router } from 'expo-router';

import { EmptyState } from '@/components/ui/empty-state';
import { SkeletonList } from '@/components/ui/skeleton';
import { colors } from '@/constants/colors';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useGroups } from '@/hooks/use-groups';
import { hapticLight } from '@/lib/haptics';
import { CURRENCIES } from '@/types/database';
import type { GroupListItem } from '@/types';

export default function GroupsScreen() {
  const colorScheme = useColorScheme() ?? 'light';
  const isDark = colorScheme === 'dark';
  const { groups, isLoading, error, refresh } = useGroups();
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

  const handleCreateGroup = () => {
    hapticLight();
    router.push('/create-group');
  };

  const handleGroupPress = (group: GroupListItem) => {
    hapticLight();
    router.push(`/group/${group.id}`);
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
    if (balance > 0) return 'you are owed';
    if (balance < 0) return 'you owe';
    return 'settled up';
  };

  const renderGroupCard = ({ item, index }: { item: GroupListItem; index: number }) => {
    const balance = item.your_balance;
    const balanceColor = getBalanceColor(balance);
    
    // Generate initials for avatar
    const initials = item.name
      .split(' ')
      .map(word => word[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);

    // Generate a consistent color based on group name
    const avatarColors = [
      colors.primary[500],
      colors.success,
      colors.warning,
      '#9333EA', // purple
      '#EC4899', // pink
      '#06B6D4', // cyan
    ];
    const avatarColor = avatarColors[item.name.length % avatarColors.length];

    return (
      <MotiView
        from={{ opacity: 0, translateY: 20, scale: 0.95 }}
        animate={{ opacity: 1, translateY: 0, scale: 1 }}
        transition={{ 
          type: 'spring', 
          damping: 18,
          stiffness: 120,
          delay: Math.min(index * 80, 400),
        }}
      >
        <Pressable
          onPress={() => handleGroupPress(item)}
          style={({ pressed }) => [
            styles.groupCard,
            { 
              backgroundColor: cardBg, 
              opacity: pressed ? 0.9 : 1,
              transform: [{ scale: pressed ? 0.98 : 1 }],
            },
          ]}
        >
          {/* Group Avatar */}
          <View style={[styles.groupAvatar, { backgroundColor: avatarColor }]}>
            {item.image_url ? (
              <Image
                source={{ uri: item.image_url }}
                style={styles.groupAvatarImage}
                contentFit="cover"
                transition={200}
              />
            ) : (
              <Text style={styles.groupAvatarText}>{initials}</Text>
            )}
          </View>

          {/* Group Info */}
          <View style={styles.groupInfo}>
            <Text style={[styles.groupName, { color: textColor }]} numberOfLines={1}>
              {item.name}
            </Text>
            <View style={styles.groupMeta}>
              <Ionicons name="people-outline" size={14} color={secondaryTextColor} />
              <Text style={[styles.groupMetaText, { color: secondaryTextColor }]}>
                {item.member_count} {item.member_count === 1 ? 'member' : 'members'}
              </Text>
            </View>
          </View>

          {/* Balance */}
          <View style={styles.balanceContainer}>
            {balance !== 0 ? (
              <>
                <Text style={[styles.balanceAmount, { color: balanceColor }]}>
                  {formatBalance(balance, item.currency)}
                </Text>
                <Text style={[styles.balanceLabel, { color: balanceColor }]}>
                  {getBalanceText(balance)}
                </Text>
              </>
            ) : (
              <View style={styles.settledBadge}>
                <Ionicons name="checkmark-circle" size={16} color={colors.success} />
                <Text style={[styles.settledText, { color: colors.success }]}>
                  settled
                </Text>
              </View>
            )}
          </View>
        </Pressable>
      </MotiView>
    );
  };

  const renderEmptyState = () => (
    <EmptyState
      icon="people-outline"
      title="No groups yet"
      description="Create a group to start splitting expenses with your friends and family"
      actionLabel="Create Group"
      onAction={handleCreateGroup}
    />
  );

  const renderHeader = () => (
    <MotiView
      from={{ opacity: 0, translateY: -20 }}
      animate={{ opacity: 1, translateY: 0 }}
      transition={{ type: 'timing', duration: 500 }}
      style={styles.header}
    >
      <View>
        <Text style={[styles.title, { color: textColor }]}>Groups</Text>
        <Text style={[styles.subtitle, { color: secondaryTextColor }]}>
          {groups.length > 0
            ? `${groups.length} group${groups.length !== 1 ? 's' : ''}`
            : 'Split for trips, roommates & more'}
        </Text>
      </View>
      {groups.length > 0 && (
        <Pressable
          onPress={handleCreateGroup}
          style={({ pressed }) => [
            styles.addButton,
            { backgroundColor: colors.primary[500], opacity: pressed ? 0.8 : 1 },
          ]}
        >
          <Ionicons name="add" size={24} color={colors.white} />
        </Pressable>
      )}
    </MotiView>
  );

  return (
    <SafeAreaView style={[styles.container, { backgroundColor }]} edges={['top']}>
      {renderHeader()}
      
      {error && (
        <MotiView
          from={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          style={styles.errorContainer}
        >
          <Ionicons name="alert-circle" size={18} color={colors.error} />
          <Text style={styles.errorText}>{error}</Text>
        </MotiView>
      )}

      <FlatList
        data={groups}
        renderItem={renderGroupCard}
        keyExtractor={(item) => item.id}
        contentContainerStyle={[
          styles.listContent,
          groups.length === 0 && !isLoading && styles.listContentEmpty,
        ]}
        ListEmptyComponent={
          isLoading ? (
            <SkeletonList count={4} />
          ) : (
            renderEmptyState()
          )
        }
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={colors.primary[500]}
            colors={[colors.primary[500]]}
          />
        }
        showsVerticalScrollIndicator={false}
      />
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
    paddingHorizontal: 24,
    paddingTop: 20,
    paddingBottom: 16,
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
  },
  subtitle: {
    fontSize: 14,
    marginTop: 2,
  },
  addButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  errorContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.error + '15',
    marginHorizontal: 24,
    padding: 12,
    borderRadius: 12,
    gap: 8,
  },
  errorText: {
    color: colors.error,
    fontSize: 14,
    flex: 1,
  },
  listContent: {
    paddingHorizontal: 24,
    paddingBottom: 100,
  },
  listContentEmpty: {
    flex: 1,
    justifyContent: 'center',
  },
  groupCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderRadius: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  groupAvatar: {
    width: 50,
    height: 50,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  groupAvatarImage: {
    width: 50,
    height: 50,
    borderRadius: 14,
  },
  groupAvatarText: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.white,
  },
  groupInfo: {
    flex: 1,
    marginLeft: 14,
  },
  groupName: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 4,
  },
  groupMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  groupMetaText: {
    fontSize: 13,
  },
  balanceContainer: {
    alignItems: 'flex-end',
  },
  balanceAmount: {
    fontSize: 16,
    fontWeight: '700',
  },
  balanceLabel: {
    fontSize: 11,
    marginTop: 2,
  },
  settledBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  settledText: {
    fontSize: 13,
    fontWeight: '500',
  },
  emptyContainer: {
    alignItems: 'center',
    paddingHorizontal: 40,
  },
  emptyIcon: {
    width: 100,
    height: 100,
    borderRadius: 50,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 24,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: '600',
    marginBottom: 8,
  },
  emptyText: {
    fontSize: 15,
    textAlign: 'center',
    marginBottom: 32,
    lineHeight: 22,
  },
  createButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 24,
    borderRadius: 12,
    gap: 8,
  },
  createButtonText: {
    color: colors.white,
    fontSize: 16,
    fontWeight: '600',
  },
});

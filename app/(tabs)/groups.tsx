/**
 * Groups Screen
 * 
 * List of all groups the user is a member of.
 * Shows balance summary per group.
 */

import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { router } from 'expo-router';
import { Avatar } from '@/components/ui/avatar';
import { MotiView } from 'moti';
import { useCallback, useState } from 'react';
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

import { EmptyState } from '@/components/ui/empty-state';
import { SkeletonList } from '@/components/ui/skeleton';
import { colors } from '@/constants/colors';
import { useSync } from '@/contexts/sync-context';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useGroups } from '@/hooks/use-groups';
import { hapticLight, hapticWarning } from '@/lib/haptics';
import type { GroupListItem } from '@/types';

// ─── Activity colour interpolation ───────────────────────────────────────────
// Neutral (secondary text) → deep orange over 28 days, pure RGB lerp.
// No step conditions — colour changes continuously with time.

const ACTIVITY_MAX_MS = 28 * 24 * 60 * 60 * 1000; // 28 days
const DEEP_ORANGE: [number, number, number] = [234, 88, 12]; // #EA580C

function hexToRgb(hex: string): [number, number, number] {
  return [
    parseInt(hex.slice(1, 3), 16),
    parseInt(hex.slice(3, 5), 16),
    parseInt(hex.slice(5, 7), 16),
  ];
}

function lerpColor(
  from: [number, number, number],
  to: [number, number, number],
  t: number,
): string {
  const r = Math.round(from[0] + (to[0] - from[0]) * t);
  const g = Math.round(from[1] + (to[1] - from[1]) * t);
  const b = Math.round(from[2] + (to[2] - from[2]) * t);
  return `rgb(${r},${g},${b})`;
}

function getActivityColor(dateStr: string | null, isDark: boolean): string {
  if (!dateStr) return isDark ? '#D1D5DB' : '#4B5563';
  const diffMs = Date.now() - new Date(dateStr).getTime();
  const t = Math.min(Math.max(diffMs / ACTIVITY_MAX_MS, 0), 1);
  const neutral = hexToRgb(isDark ? '#D1D5DB' : '#4B5563');
  return lerpColor(neutral, DEEP_ORANGE, t);
}

// ─────────────────────────────────────────────────────────────────────────────

export default function GroupsScreen() {
  const colorScheme = useColorScheme() ?? 'light';
  const isDark = colorScheme === 'dark';
  const { groups, isLoading, error, refresh } = useGroups();
  const { isOnline } = useSync();
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

  // Refetch when screen comes into focus (e.g., after creating a group)
  useFocusEffect(
    useCallback(() => {
      if (isOnline) {
        refresh();
      }
    }, [isOnline, refresh])
  );

  const handleCreateGroup = () => {
    if (!isOnline) {
      hapticWarning();
      Alert.alert(
        'No Connection',
        'Creating groups requires an internet connection.',
        [{ text: 'OK' }]
      );
      return;
    }
    hapticLight();
    router.push('/create-group');
  };

  const handleGroupPress = (group: GroupListItem) => {
    hapticLight();
    router.push(`/group/${group.id}`);
  };

  const formatLastActivity = (dateStr: string | null): string => {
    if (!dateStr) return 'No activity';
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (diffHours < 1) return 'Just now';
    if (diffHours < 24) return diffHours === 1 ? '1 hour ago' : `${diffHours} hours ago`;
    if (diffDays === 1) return 'Yesterday';
    if (diffDays <= 30) return `${diffDays} days ago`;

    const diffMonths = Math.floor(diffDays / 30);
    if (diffMonths === 1) return '1 month ago';
    if (diffMonths < 12) return `${diffMonths} months ago`;

    const diffYears = Math.floor(diffDays / 365);
    if (diffYears === 1) return '1 year ago';
    return `${diffYears} years ago`;
  };

  const renderGroupCard = ({ item, index }: { item: GroupListItem; index: number }) => (
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
        <Avatar group={item} size={50} />

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

        {/* Last Activity */}
        <View style={styles.lastActivityContainer}>
          <Text style={[styles.lastActivityLabel, { color: secondaryTextColor }]}>
            last active
          </Text>
          <Text style={[styles.lastActivityValue, { color: getActivityColor(item.last_activity, isDark) }]}>
            {formatLastActivity(item.last_activity)}
          </Text>
        </View>
      </Pressable>
    </MotiView>
  );

  const renderEmptyState = () => {
    // Show offline empty state when no cached data
    if (!isOnline) {
      return (
        <EmptyState
          icon="cloud-offline-outline"
          title="No cached data"
          description="Connect to the internet to load your groups"
        />
      );
    }
    
    return (
      <EmptyState
        icon="people-outline"
        title="No groups yet"
        description="Create a group to start splitting expenses with your friends and family"
        actionLabel="Create Group"
        onAction={handleCreateGroup}
      />
    );
  };

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
  lastActivityContainer: {
    alignItems: 'flex-end',
  },
  lastActivityLabel: {
    fontSize: 11,
    marginBottom: 2,
  },
  lastActivityValue: {
    fontSize: 14,
    fontWeight: '600',
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

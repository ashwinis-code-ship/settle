/**
 * Skeleton Loading Components
 * 
 * Animated placeholder UI for loading states.
 * Uses Moti for smooth shimmer animations.
 */

import { MotiView } from 'moti';
import { StyleSheet, View } from 'react-native';

import { colors } from '@/constants/colors';
import { useColorScheme } from '@/hooks/use-color-scheme';

interface SkeletonProps {
  /** Width of the skeleton. Can be number or percentage string */
  width?: number | string;
  /** Height of the skeleton */
  height?: number;
  /** Border radius */
  borderRadius?: number;
  /** Whether to show as a circle */
  circle?: boolean;
}

/**
 * Base Skeleton component with shimmer animation
 */
export function Skeleton({ 
  width = '100%', 
  height = 16, 
  borderRadius = 8,
  circle = false,
}: SkeletonProps) {
  const colorScheme = useColorScheme() ?? 'light';
  const isDark = colorScheme === 'dark';
  
  const baseColor = isDark ? colors.gray[700] : colors.gray[200];
  const highlightColor = isDark ? colors.gray[600] : colors.gray[100];

  const size = circle ? (typeof width === 'number' ? width : height) : undefined;

  return (
    <MotiView
      from={{ opacity: 0.5 }}
      animate={{ opacity: 1 }}
      transition={{
        type: 'timing',
        duration: 800,
        loop: true,
      }}
      style={[
        {
          width: circle ? size : width,
          height: circle ? size : height,
          borderRadius: circle ? (size || height) / 2 : borderRadius,
          backgroundColor: baseColor,
        },
      ]}
    />
  );
}

/**
 * Skeleton for a group/friend card in list
 */
export function SkeletonCard() {
  const colorScheme = useColorScheme() ?? 'light';
  const isDark = colorScheme === 'dark';
  const cardBg = isDark ? colors.gray[800] : colors.white;

  return (
    <View style={[styles.card, { backgroundColor: cardBg }]}>
      {/* Avatar */}
      <Skeleton width={48} height={48} circle />
      
      {/* Content */}
      <View style={styles.cardContent}>
        <Skeleton width="60%" height={16} borderRadius={4} />
        <View style={{ height: 8 }} />
        <Skeleton width="40%" height={12} borderRadius={4} />
      </View>
      
      {/* Right side */}
      <View style={styles.cardRight}>
        <Skeleton width={60} height={14} borderRadius={4} />
        <View style={{ height: 6 }} />
        <Skeleton width={50} height={10} borderRadius={4} />
      </View>
    </View>
  );
}

/**
 * Skeleton for activity/expense item
 */
export function SkeletonActivityItem() {
  const colorScheme = useColorScheme() ?? 'light';
  const isDark = colorScheme === 'dark';
  const cardBg = isDark ? colors.gray[800] : colors.white;

  return (
    <View style={[styles.activityItem, { backgroundColor: cardBg }]}>
      {/* Icon */}
      <Skeleton width={40} height={40} borderRadius={12} />
      
      {/* Content */}
      <View style={styles.activityContent}>
        <Skeleton width="70%" height={14} borderRadius={4} />
        <View style={{ height: 6 }} />
        <Skeleton width="45%" height={10} borderRadius={4} />
      </View>
      
      {/* Amount */}
      <View style={styles.activityRight}>
        <Skeleton width={50} height={14} borderRadius={4} />
      </View>
    </View>
  );
}

/**
 * Skeleton for balance summary card
 */
export function SkeletonBalanceCard() {
  return (
    <View style={styles.balanceCard}>
      <Skeleton width={100} height={12} borderRadius={4} />
      <View style={{ height: 12 }} />
      <Skeleton width={140} height={32} borderRadius={6} />
      <View style={{ height: 20 }} />
      <View style={styles.balanceRow}>
        <View style={styles.balanceItem}>
          <Skeleton width={24} height={24} circle />
          <View style={{ marginLeft: 8 }}>
            <Skeleton width={60} height={10} borderRadius={4} />
            <View style={{ height: 4 }} />
            <Skeleton width={50} height={14} borderRadius={4} />
          </View>
        </View>
        <View style={styles.balanceDivider} />
        <View style={styles.balanceItem}>
          <Skeleton width={24} height={24} circle />
          <View style={{ marginLeft: 8 }}>
            <Skeleton width={60} height={10} borderRadius={4} />
            <View style={{ height: 4 }} />
            <Skeleton width={50} height={14} borderRadius={4} />
          </View>
        </View>
      </View>
    </View>
  );
}

/**
 * Skeleton list - renders multiple skeleton cards
 */
export function SkeletonList({ count = 5 }: { count?: number }) {
  return (
    <View style={styles.list}>
      {Array.from({ length: count }).map((_, i) => (
        <View key={i} style={styles.listItem}>
          <SkeletonCard />
        </View>
      ))}
    </View>
  );
}

/**
 * Skeleton for activity list
 */
export function SkeletonActivityList({ count = 4 }: { count?: number }) {
  return (
    <View style={styles.list}>
      {Array.from({ length: count }).map((_, i) => (
        <View key={i} style={styles.activityListItem}>
          <SkeletonActivityItem />
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderRadius: 16,
  },
  cardContent: {
    flex: 1,
    marginLeft: 12,
  },
  cardRight: {
    alignItems: 'flex-end',
  },
  activityItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 14,
  },
  activityContent: {
    flex: 1,
    marginLeft: 12,
  },
  activityRight: {
    alignItems: 'flex-end',
  },
  balanceCard: {
    padding: 24,
    borderRadius: 24,
    backgroundColor: colors.primary[500],
    opacity: 0.6,
  },
  balanceRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  balanceItem: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  balanceDivider: {
    width: 1,
    height: 40,
    backgroundColor: colors.white,
    opacity: 0.3,
    marginHorizontal: 16,
  },
  list: {
    gap: 0,
  },
  listItem: {
    marginBottom: 12,
  },
  activityListItem: {
    marginBottom: 8,
  },
});

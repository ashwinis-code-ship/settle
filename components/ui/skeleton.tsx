/**
 * Skeleton Loading Components
 *
 * Animated placeholder UI for loading states.
 * Uses a true left-to-right shimmer sweep (LinearGradient + Reanimated)
 * instead of an opacity pulse — the pattern iOS/Android users recognise
 * and trust as a loading indicator.
 */

import { LinearGradient } from 'expo-linear-gradient';
import { useEffect } from 'react';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';
import { StyleSheet, View, ViewStyle } from 'react-native';

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
  /** Additional styles applied to the outer container */
  style?: ViewStyle;
}

/**
 * Base Skeleton component with shimmer sweep animation.
 * The shimmer travels left-to-right, repeating indefinitely.
 */
export function Skeleton({
  width = '100%',
  height = 16,
  borderRadius = 8,
  circle = false,
  style,
}: SkeletonProps) {
  const colorScheme = useColorScheme() ?? 'light';
  const isDark = colorScheme === 'dark';

  const baseColor = isDark ? colors.gray[700] : colors.gray[200];
  const shimmerColor = isDark ? 'rgba(255,255,255,0.07)' : 'rgba(255,255,255,0.65)';

  // Travel distance: use numeric width when known, otherwise assume 300px.
  // The container clips overflow so any overshoot is invisible.
  const travelPx = (typeof width === 'number' ? width : 300) * 1.5;

  const progress = useSharedValue(0);
  useEffect(() => {
    progress.value = withRepeat(
      withTiming(1, { duration: 1100, easing: Easing.linear }),
      -1,
      false,
    );
  }, [progress]);

  const animStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: (progress.value - 0.5) * 2 * travelPx }],
  }));

  const size = circle ? (typeof width === 'number' ? width : height) : undefined;

  return (
    <View
      style={[{
        width: circle ? size : width,
        height: circle ? size : height,
        borderRadius: circle ? (size ?? height) / 2 : borderRadius,
        backgroundColor: baseColor,
        overflow: 'hidden',
      }, style]}
    >
      <Animated.View style={[StyleSheet.absoluteFill, animStyle]}>
        <LinearGradient
          colors={['transparent', shimmerColor, 'transparent']}
          start={{ x: 0, y: 0.5 }}
          end={{ x: 1, y: 0.5 }}
          style={StyleSheet.absoluteFill}
        />
      </Animated.View>
    </View>
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
 * Skeleton for a contact/people list row (avatar + name + phone)
 */
export function SkeletonContactList({ count = 7 }: { count?: number }) {
  return (
    <View>
      {Array.from({ length: count }).map((_, i) => (
        <View key={i} style={styles.contactRow}>
          <Skeleton width={40} height={40} circle />
          <View style={styles.contactContent}>
            <Skeleton width={130} height={14} borderRadius={6} />
            <View style={{ height: 6 }} />
            <Skeleton width={90} height={11} borderRadius={5} />
          </View>
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
  contactRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 16,
    gap: 12,
  },
  contactContent: {
    flex: 1,
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

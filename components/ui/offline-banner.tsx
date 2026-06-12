/**
 * Offline Banner
 * 
 * Shows when the user is offline with optional pending count.
 */

import { IconSymbol } from '@/components/ui/icon-symbol';
import { colors } from '@/constants/colors';
import { useSync } from '@/contexts/sync-context';
import { formatDistanceToNow } from '@/lib/utils';
import { MotiView } from 'moti';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

type OfflineBannerPlacement = 'top' | 'accessory';

export function OfflineBanner({ placement = 'top' }: { placement?: OfflineBannerPlacement }) {
  const insets = useSafeAreaInsets();
  const { pendingCount, syncStatus, lastSyncTime } = useSync();

  // Format last sync text
  const lastSyncText = lastSyncTime
    ? `Last synced ${formatDistanceToNow(lastSyncTime)}`
    : 'Not synced yet';

  return (
    <MotiView
      from={{ opacity: 0, translateY: -20 }}
      animate={{ opacity: 1, translateY: 0 }}
      exit={{ opacity: 0, translateY: -20 }}
      transition={{ type: 'timing', duration: 200 }}
      style={[
        styles.container,
        placement === 'top'
          ? { paddingTop: insets.top + 10, paddingBottom: 10 }
          : styles.accessoryContainer,
      ]}
    >
      <View style={styles.content}>
        <View style={styles.iconContainer}>
          <IconSymbol name="eye" size={18} color={colors.white} />
        </View>
        <View style={styles.textContainer}>
          <Text style={styles.title}>View-only mode</Text>
          <Text style={styles.subtitle} numberOfLines={1} ellipsizeMode="tail">
            {lastSyncText}
          </Text>
        </View>
      </View>

      {syncStatus === 'syncing' && (
        <View style={styles.syncingIndicator}>
          <IconSymbol name="arrow.triangle.2.circlepath" size={16} color={colors.white} />
        </View>
      )}
    </MotiView>
  );
}

/**
 * Compact Offline Indicator
 * 
 * Small indicator for headers/navigation.
 */
export function OfflineIndicator() {
  const { isOnline, pendingCount } = useSync();

  if (isOnline && pendingCount === 0) return null;

  return (
    <View style={styles.indicator}>
      {!isOnline && (
        <View style={styles.offlineDot}>
          <IconSymbol name="icloud.slash" size={14} color={colors.warning[500]} />
        </View>
      )}
      {pendingCount > 0 && (
        <View style={styles.pendingBadge}>
          <Text style={styles.pendingText}>{pendingCount}</Text>
        </View>
      )}
    </View>
  );
}

/**
 * Pending Badge
 * 
 * Shows on items that are pending sync.
 */
export function PendingBadge({ compact = false }: { compact?: boolean }) {
  if (compact) {
    return (
      <View style={styles.pendingBadgeCompact}>
        <IconSymbol name="clock" size={12} color={colors.warning[600]} />
      </View>
    );
  }

  return (
    <View style={styles.pendingTag}>
      <IconSymbol name="clock" size={12} color={colors.warning[700]} />
      <Text style={styles.pendingTagText}>Pending</Text>
    </View>
  );
}

/**
 * Sync Status Button
 * 
 * Button to manually trigger sync.
 */
export function SyncStatusButton() {
  const { isOnline, pendingCount, syncStatus, sync } = useSync();

  if (!isOnline || pendingCount === 0) return null;

  return (
    <Pressable
      style={({ pressed }) => [
        styles.syncButton,
        pressed && styles.syncButtonPressed,
        syncStatus === 'syncing' && styles.syncButtonDisabled,
      ]}
      onPress={sync}
      disabled={syncStatus === 'syncing'}
    >
      <IconSymbol
        name={syncStatus === 'syncing' ? 'arrow.triangle.2.circlepath' : 'icloud.and.arrow.up'}
        size={16}
        color={colors.white}
      />
      <Text style={styles.syncButtonText}>
        {syncStatus === 'syncing' ? 'Syncing...' : `Sync ${pendingCount}`}
      </Text>
    </Pressable>
  );
}

/**
 * Stale Data Notice
 * 
 * Subtle notice shown when viewing cached data while offline.
 * Use this on individual screens to indicate data may be stale.
 */
export function StaleDataNotice({ style }: { style?: object }) {
  const { isOnline } = useSync();

  // Don't show if online
  if (isOnline) return null;

  return (
    <View style={[styles.staleNotice, style]}>
      <IconSymbol name="info.circle" size={14} color={colors.gray[500]} />
      <Text style={styles.staleNoticeText}>Showing cached data</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: colors.gray[700],
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  accessoryContainer: {
    paddingTop: 10,
    paddingBottom: 10,
  },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  iconContainer: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.gray[600],
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  textContainer: {
    flex: 1,
    minWidth: 0,
  },
  title: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.white,
  },
  subtitle: {
    fontSize: 12,
    color: colors.gray[300],
    marginTop: 2,
  },
  syncingIndicator: {
    marginLeft: 8,
  },
  indicator: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  offlineDot: {
    padding: 4,
  },
  pendingBadge: {
    backgroundColor: colors.warning[500],
    borderRadius: 10,
    minWidth: 20,
    height: 20,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 6,
  },
  pendingText: {
    fontSize: 11,
    fontWeight: '600',
    color: colors.white,
  },
  pendingBadgeCompact: {
    backgroundColor: colors.warning[100],
    borderRadius: 8,
    padding: 4,
  },
  pendingTag: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.warning[100],
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    gap: 4,
  },
  pendingTagText: {
    fontSize: 11,
    fontWeight: '500',
    color: colors.warning[700],
  },
  syncButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.primary[500],
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 16,
    gap: 6,
  },
  syncButtonPressed: {
    opacity: 0.8,
  },
  syncButtonDisabled: {
    opacity: 0.6,
  },
  syncButtonText: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.white,
  },
  staleNotice: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 6,
    paddingHorizontal: 12,
    backgroundColor: colors.gray[100],
    borderRadius: 8,
    gap: 6,
  },
  staleNoticeText: {
    fontSize: 12,
    color: colors.gray[500],
  },
});

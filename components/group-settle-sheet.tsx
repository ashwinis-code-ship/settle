/**
 * Group Settle Sheet
 *
 * Bottom sheet shown from the group detail page. Displays every member of the
 * group (excluding the current user) alongside their NET GLOBAL balance — i.e.
 * the real amount owed across ALL groups and 1:1 expenses, not just this group.
 *
 * Left side of each row (avatar + name + balance) → friend detail screen
 * "Settle" button on the right → /settle-up pre-filled with that friend
 */

import { Ionicons } from '@expo/vector-icons';
import BottomSheet, { BottomSheetScrollView } from '@gorhom/bottom-sheet';
import { Image } from 'expo-image';
import { router } from 'expo-router';
import { forwardRef, useCallback, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { colors } from '@/constants/colors';
import type { GroupDetail } from '@/hooks/use-group';
import { hapticLight } from '@/lib/haptics';
import { supabase } from '@/lib/supabase';
import type { UserSummary } from '@/types';

interface MemberBalance {
  user: UserSummary;
  /** Positive = they owe you, Negative = you owe them */
  netBalance: number;
}

interface GroupSettleSheetProps {
  group: GroupDetail;
  currentUserId: string;
  isDark: boolean;
  onClose: () => void;
}

const getInitials = (name: string) =>
  name
    .split(' ')
    .map(n => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);

const getAvatarColor = (name: string) => {
  const palette = [
    colors.primary[500],
    colors.success,
    colors.warning,
    '#9333EA',
    '#EC4899',
    '#06B6D4',
    '#F97316',
    '#14B8A6',
  ];
  const sum = name.split('').reduce((acc, c) => acc + c.charCodeAt(0), 0);
  return palette[sum % palette.length];
};

export const GroupSettleSheet = forwardRef<BottomSheet, GroupSettleSheetProps>(
  ({ group, currentUserId, isDark, onClose }, ref) => {
    const insets = useSafeAreaInsets();
    const snapPoints = useMemo(() => ['55%', '80%'], []);

    const textColor = isDark ? colors.text.dark.primary : colors.text.light.primary;
    const secondaryTextColor = isDark ? colors.text.dark.secondary : colors.text.light.secondary;
    const cardBg = isDark ? colors.gray[800] : colors.white;
    const dividerColor = isDark ? colors.gray[700] : colors.gray[200];

    const [balances, setBalances] = useState<MemberBalance[]>([]);
    // hasFetched prevents the empty state from flashing before the first fetch completes
    const [hasFetched, setHasFetched] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const [isOpen, setIsOpen] = useState(false);

    const sheetStyle = useMemo(
      () =>
        isOpen
          ? {
              shadowColor: '#000',
              shadowOffset: { width: 0, height: -6 },
              shadowOpacity: 0.12,
              shadowRadius: 16,
              elevation: 20,
            }
          : undefined,
      [isOpen]
    );

    const closeSheet = useCallback(() => {
      if (ref && typeof ref !== 'function' && ref.current) {
        ref.current.close();
      }
    }, [ref]);

    // Fetch global net balances for every group member (excluding self)
    const fetchBalances = useCallback(async () => {
      const otherMembers = group.members.filter(m => m.user_id !== currentUserId);
      if (otherMembers.length === 0) {
        setBalances([]);
        setHasFetched(true);
        return;
      }

      setIsLoading(true);
      try {
        const results: MemberBalance[] = [];

        await Promise.all(
          otherMembers.map(async member => {
            const { data } = await supabase.rpc('calculate_balance_between_users', {
              user1_id: currentUserId,
              user2_id: member.user_id,
            });
            const net = Number(data) || 0;
            if (net !== 0) {
              results.push({ user: member.user, netBalance: net });
            }
          })
        );

        // Sort: people you owe first (most actionable), then people who owe you
        results.sort((a, b) => a.netBalance - b.netBalance);
        setBalances(results);
      } catch (err) {
        console.error('[GroupSettleSheet] Failed to fetch balances:', err);
      } finally {
        setIsLoading(false);
        setHasFetched(true);
      }
    }, [group.members, currentUserId]);

    const handleSheetChange = useCallback(
      (index: number) => {
        const opened = index >= 0;
        setIsOpen(opened);
        if (opened && !hasFetched && !isLoading) {
          fetchBalances();
        }
        if (!opened) {
          onClose();
        }
      },
      [hasFetched, isLoading, fetchBalances, onClose]
    );

    // Left-side tap: go to the friend's transaction history
    const handleViewTransactions = useCallback(
      (member: UserSummary) => {
        hapticLight();
        closeSheet();
        router.push(`/friend/${member.id}`);
      },
      [closeSheet]
    );

    // Right-side button: go to settle-up pre-filled with this friend
    const handleSettle = useCallback(
      (member: UserSummary) => {
        hapticLight();
        closeSheet();
        router.push(`/settle-up?friendId=${member.id}`);
      },
      [closeSheet]
    );

    const youOwe = balances.filter(b => b.netBalance < 0);
    const theyOwe = balances.filter(b => b.netBalance > 0);

    const renderMember = (item: MemberBalance) => {
      const isDebt = item.netBalance < 0;
      const absAmount = Math.abs(item.netBalance).toFixed(2);
      const balanceColor = isDebt ? colors.error : colors.success;
      const label = isDebt ? `you owe ₹${absAmount}` : `owes you ₹${absAmount}`;

      return (
        <View key={item.user.id} style={styles.memberRow}>
          {/* Left: avatar + name + balance → friend detail */}
          <Pressable
            onPress={() => handleViewTransactions(item.user)}
            style={({ pressed }) => [styles.memberLeft, { opacity: pressed ? 0.7 : 1 }]}
          >
            <View style={[styles.avatar, { backgroundColor: getAvatarColor(item.user.name) }]}>
              {item.user.avatar_url ? (
                <Image
                  source={{ uri: item.user.avatar_url }}
                  style={styles.avatarImage}
                  contentFit="cover"
                  transition={200}
                />
              ) : (
                <Text style={styles.avatarText}>{getInitials(item.user.name)}</Text>
              )}
            </View>
            <View style={styles.memberInfo}>
              <Text style={[styles.memberName, { color: textColor }]}>{item.user.name}</Text>
              <Text style={[styles.memberBalance, { color: balanceColor }]}>{label}</Text>
            </View>
          </Pressable>

          {/* Right: Settle button → settle-up screen */}
          <Pressable
            onPress={() => handleSettle(item.user)}
            style={({ pressed }) => [
              styles.settleButton,
              { borderColor: colors.primary[500], opacity: pressed ? 0.7 : 1 },
            ]}
          >
            <Text style={[styles.settleButtonText, { color: colors.primary[500] }]}>Settle</Text>
          </Pressable>
        </View>
      );
    };

    const renderContent = () => {
      if (isLoading || !hasFetched) {
        return (
          <View style={styles.centered}>
            <ActivityIndicator size="small" color={colors.primary[500]} />
            <Text style={[styles.loadingText, { color: secondaryTextColor }]}>
              Calculating balances…
            </Text>
          </View>
        );
      }

      if (balances.length === 0) {
        return (
          <View style={styles.centered}>
            <View style={[styles.allSettledIcon, { backgroundColor: colors.success + '20' }]}>
              <Ionicons name="checkmark-circle" size={48} color={colors.success} />
            </View>
            <Text style={[styles.allSettledTitle, { color: textColor }]}>All settled up!</Text>
            <Text style={[styles.allSettledSub, { color: secondaryTextColor }]}>
              You have no outstanding balances with anyone in this group.
            </Text>
          </View>
        );
      }

      return (
        <>
          {youOwe.length > 0 && (
            <View style={styles.section}>
              <Text style={[styles.sectionLabel, { color: secondaryTextColor }]}>You owe</Text>
              {youOwe.map(renderMember)}
            </View>
          )}

          {youOwe.length > 0 && theyOwe.length > 0 && (
            <View style={[styles.divider, { backgroundColor: dividerColor }]} />
          )}

          {theyOwe.length > 0 && (
            <View style={styles.section}>
              <Text style={[styles.sectionLabel, { color: secondaryTextColor }]}>They owe you</Text>
              {theyOwe.map(renderMember)}
            </View>
          )}
        </>
      );
    };

    return (
      <BottomSheet
        ref={ref}
        index={-1}
        snapPoints={snapPoints}
        bottomInset={insets.bottom}
        enablePanDownToClose
        enableOverDrag={false}
        enableDynamicSizing={false}
        style={sheetStyle}
        onChange={handleSheetChange}
        backgroundStyle={{ backgroundColor: cardBg }}
        handleIndicatorStyle={{ backgroundColor: colors.gray[400] }}
      >
        <BottomSheetScrollView
          contentContainerStyle={[
            styles.content,
            { paddingBottom: Math.max(insets.bottom, 24) + 24 },
          ]}
          showsVerticalScrollIndicator={false}
        >
          {/* Header */}
          <View style={styles.header}>
            <Text style={[styles.title, { color: textColor }]}>Settle Up</Text>
            <Text style={[styles.subtitle, { color: secondaryTextColor }]}>
              Balances include all shared groups and expenses, not just this one. Tap a name to see the full history.
            </Text>
          </View>

          {renderContent()}
        </BottomSheetScrollView>
      </BottomSheet>
    );
  }
);

GroupSettleSheet.displayName = 'GroupSettleSheet';

const styles = StyleSheet.create({
  content: {
    paddingHorizontal: 20,
    paddingTop: 4,
  },
  header: {
    marginBottom: 20,
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 6,
  },
  subtitle: {
    fontSize: 13,
    lineHeight: 19,
  },
  centered: {
    alignItems: 'center',
    paddingVertical: 40,
    gap: 12,
  },
  loadingText: {
    fontSize: 14,
  },
  allSettledIcon: {
    width: 80,
    height: 80,
    borderRadius: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  allSettledTitle: {
    fontSize: 18,
    fontWeight: '700',
  },
  allSettledSub: {
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 20,
    paddingHorizontal: 16,
  },
  section: {
    gap: 4,
  },
  sectionLabel: {
    fontSize: 12,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 6,
    marginLeft: 4,
  },
  divider: {
    height: 1,
    marginVertical: 16,
  },
  memberRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 6,
    gap: 10,
  },
  memberLeft: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 6,
    paddingHorizontal: 4,
  },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  avatarImage: {
    width: 44,
    height: 44,
    borderRadius: 22,
  },
  avatarText: {
    color: colors.white,
    fontSize: 15,
    fontWeight: '700',
  },
  memberInfo: {
    flex: 1,
  },
  memberName: {
    fontSize: 16,
    fontWeight: '600',
  },
  memberBalance: {
    fontSize: 13,
    marginTop: 2,
  },
  settleButton: {
    paddingVertical: 7,
    paddingHorizontal: 14,
    borderRadius: 20,
    borderWidth: 1.5,
    flexShrink: 0,
  },
  settleButtonText: {
    fontSize: 13,
    fontWeight: '600',
  },
});

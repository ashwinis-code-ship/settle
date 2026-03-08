/**
 * Balance Spectrum Bar
 *
 * A horizontal gradient track (red → green) that plots each group member's
 * net position within the group.
 *
 *   Red   (left)  = member owes money to the group
 *   Green (right) = member is owed money by the group
 *   Centre (0)    = perfectly balanced
 *
 * Avatars are placed proportionally to net_balance. Bubbles that would
 * visually overlap are merged into a tightly-stacked cluster (only ~10% of
 * each back avatar peeks out). Tap any bubble or cluster to reveal an
 * animated floating popover showing name(s) + colour-coded amount(s).
 */

import { Image } from 'expo-image';
import { AnimatePresence, MotiView } from 'moti';
import { useCallback, useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import type { LayoutChangeEvent } from 'react-native';

import { colors } from '@/constants/colors';
import type { GroupMemberBalance } from '@/types';

// ─── Gradient ────────────────────────────────────────────────────────────────

/** Correct CSS HSL→hex (uses k−3 / 9−k formula, not k / 4−k). */
function hslToHex(h: number, s: number, l: number): string {
  s /= 100;
  l /= 100;
  const a = s * Math.min(l, 1 - l);
  const f = (n: number) => {
    const k = (n + h / 30) % 12;
    return Math.round(255 * (l - a * Math.max(-1, Math.min(k - 3, 9 - k, 1))));
  };
  const hex = (v: number) => v.toString(16).padStart(2, '0');
  return `#${hex(f(0))}${hex(f(8))}${hex(f(4))}`;
}

// 24 steps: hue 0° (red) → 142° (green), saturation 72%, lightness 48%
const GRADIENT: string[] = Array.from({ length: 24 }, (_, i) =>
  hslToHex((i / 23) * 142, 72, 48)
);

// ─── Constants ───────────────────────────────────────────────────────────────

const AVATAR_SIZE = 30;
/** Only 10% (3 px) of each back avatar peeks out — tight stack. */
const OVERLAP = Math.round(AVATAR_SIZE * 0.9);   // 27
const STEM_H = 8;
const TRACK_H = 8;
const SECTION_H = AVATAR_SIZE + STEM_H + TRACK_H; // 46 px total
const CLUSTER_GAP = AVATAR_SIZE + 6;               // min centre-to-centre
const TOOLTIP_ROW_H = 28;
const TOOLTIP_PADDING = 20;
const TOOLTIP_W = 178;

// ─── Helpers ─────────────────────────────────────────────────────────────────

const getInitials = (name: string) =>
  name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);

const getAvatarColor = (name: string) => {
  const palette = [
    colors.primary[500], colors.success, colors.warning,
    '#9333EA', '#EC4899', '#06B6D4', '#F97316', '#14B8A6',
  ];
  return palette[name.split('').reduce((s, c) => s + c.charCodeAt(0), 0) % palette.length];
};

/** Visual width of N tightly-stacked avatars. */
function clusterVisualWidth(count: number): number {
  return AVATAR_SIZE + Math.max(0, count - 1) * (AVATAR_SIZE - OVERLAP);
}

// ─── Types ───────────────────────────────────────────────────────────────────

interface Positioned { balance: GroupMemberBalance; x: number; }
interface Cluster { members: GroupMemberBalance[]; centerX: number; }

// ─── Computation ─────────────────────────────────────────────────────────────

function computePositions(balances: GroupMemberBalance[], trackWidth: number): Positioned[] {
  const maxAbs = Math.max(...balances.map(b => Math.abs(b.net_balance)));
  const padding = AVATAR_SIZE / 2 + 2;
  const usable = trackWidth - padding * 2;
  return balances.map(b => ({
    balance: b,
    x: maxAbs === 0 ? trackWidth / 2 : padding + ((b.net_balance / maxAbs + 1) / 2) * usable,
  }));
}

function buildClusters(positioned: Positioned[]): Cluster[] {
  const sorted = [...positioned].sort((a, b) => a.x - b.x);
  const clusters: Cluster[] = [];
  let group: Positioned[] = [sorted[0]];

  for (let i = 1; i < sorted.length; i++) {
    if (sorted[i].x - group[group.length - 1].x < CLUSTER_GAP) {
      group.push(sorted[i]);
    } else {
      clusters.push({
        members: group.map(p => p.balance),
        centerX: group.reduce((s, p) => s + p.x, 0) / group.length,
      });
      group = [sorted[i]];
    }
  }
  clusters.push({
    members: group.map(p => p.balance),
    centerX: group.reduce((s, p) => s + p.x, 0) / group.length,
  });
  return clusters;
}

// ─── Component ───────────────────────────────────────────────────────────────

interface BalanceSpectrumBarProps {
  balances: GroupMemberBalance[];
  currentUserId: string;
  isDark: boolean;
}

export function BalanceSpectrumBar({ balances, currentUserId, isDark }: BalanceSpectrumBarProps) {
  const cardBg      = isDark ? colors.gray[800] : colors.white;
  const textColor   = isDark ? colors.text.dark.primary   : colors.text.light.primary;
  const subColor    = isDark ? colors.text.dark.secondary : colors.text.light.secondary;
  const tooltipBg   = isDark ? colors.gray[750] ?? colors.gray[700] : colors.white;
  const tooltipBorder = isDark ? colors.gray[600] : colors.gray[200];
  const stemColor   = isDark ? colors.gray[500] : colors.gray[300];

  const [trackWidth, setTrackWidth]     = useState(0);
  const [activeCluster, setActiveCluster] = useState<Cluster | null>(null);

  const handleLayout = useCallback((e: LayoutChangeEvent) => {
    setTrackWidth(e.nativeEvent.layout.width);
  }, []);

  const clusters = useMemo<Cluster[]>(() => {
    if (!trackWidth || balances.length === 0) return [];
    return buildClusters(computePositions(balances, trackWidth));
  }, [balances, trackWidth]);

  const handleClusterPress = useCallback((cluster: Cluster) => {
    setActiveCluster(prev => prev?.centerX === cluster.centerX ? null : cluster);
  }, []);

  if (balances.length === 0) return null;

  // Clamp tooltip horizontally so it never clips off either edge
  const tooltipLeft = activeCluster
    ? Math.max(0, Math.min(trackWidth - TOOLTIP_W, activeCluster.centerX - TOOLTIP_W / 2))
    : 0;

  // Tooltip opens upward — above the avatars — so it never overlaps content below the card
  const tooltipHeight = activeCluster
    ? TOOLTIP_PADDING + activeCluster.members.length * TOOLTIP_ROW_H
    : 0;
  const tooltipTop = -(tooltipHeight + 8);

  return (
    <View style={[styles.card, { backgroundColor: cardBg }]}>
      {/*
        `inner` is the positioning context for the floating tooltip.
        The axis labels sit at a fixed margin below the track and NEVER
        move — the tooltip floats on top of them via zIndex.
      */}
      <View style={styles.inner} onLayout={handleLayout}>

        {/* ── Track section: gradient bar + stems + avatar clusters ── */}
        <View style={[styles.trackSection, { height: SECTION_H }]}>

          {/* Stems connecting each cluster to the track */}
          {trackWidth > 0 && clusters.map((cluster, i) => (
            <View
              key={`stem-${i}`}
              style={[styles.stem, {
                left: cluster.centerX - 1,
                top: AVATAR_SIZE,
                height: STEM_H,
                backgroundColor: stemColor,
              }]}
            />
          ))}

          {/* Gradient bar */}
          <View style={[styles.trackRow, { top: AVATAR_SIZE + STEM_H, height: TRACK_H }]}>
            {GRADIENT.map((color, i) => (
              <View key={i} style={[styles.trackSegment, { backgroundColor: color }]} />
            ))}
            {/* White centre tick at 0 */}
            <View style={styles.centreTick} />
          </View>

          {/* Avatar clusters */}
          {trackWidth > 0 && clusters.map((cluster, i) => {
            const displayMembers = cluster.members.slice(0, 3);
            const extra = cluster.members.length - displayMembers.length;
            const w = clusterVisualWidth(displayMembers.length);
            const isActive = activeCluster?.centerX === cluster.centerX;

            return (
              <Pressable
                key={`cluster-${i}`}
                onPress={() => handleClusterPress(cluster)}
                style={[styles.cluster, {
                  left: cluster.centerX - w / 2,
                  top: 0,
                  width: w,
                  zIndex: 10,
                  opacity: activeCluster && !isActive ? 0.35 : 1,
                }]}
              >
                {displayMembers.map((member, mi) => (
                  <View
                    key={member.user.id}
                    style={[styles.avatar, {
                      backgroundColor: getAvatarColor(member.user.name),
                      marginLeft: mi === 0 ? 0 : -OVERLAP,
                      zIndex: displayMembers.length - mi,
                      borderColor: cardBg,
                    }]}
                  >
                    {member.user.avatar_url ? (
                      <Image
                        source={{ uri: member.user.avatar_url }}
                        style={styles.avatarImage}
                        contentFit="cover"
                        transition={150}
                      />
                    ) : (
                      <Text style={styles.avatarText}>{getInitials(member.user.name)}</Text>
                    )}
                  </View>
                ))}
                {extra > 0 && (
                  <View style={[styles.extraBadge, {
                    backgroundColor: colors.gray[500],
                    marginLeft: -OVERLAP,
                    zIndex: 0,
                    borderColor: cardBg,
                  }]}>
                    <Text style={styles.extraText}>+{extra}</Text>
                  </View>
                )}
              </Pressable>
            );
          })}
        </View>

        {/* ── Axis labels — fixed, never pushed by tooltip ── */}
        <View style={styles.axis}>
          <Text style={[styles.axisLabel, { color: colors.error + 'AA' }]}>← owes</Text>
          <Text style={[styles.axisLabel, { color: subColor }]}>0</Text>
          <Text style={[styles.axisLabel, { color: colors.success + 'AA' }]}>owed →</Text>
        </View>

        {/* ── Floating tooltip — absolutely positioned, floats over axis ── */}
        <AnimatePresence>
          {activeCluster && (
            <MotiView
              key={`tooltip-${activeCluster.centerX}`}
              from={{ opacity: 0, scale: 0.93, translateY: 6 }}
              animate={{ opacity: 1, scale: 1, translateY: 0 }}
              exit={{ opacity: 0, scale: 0.93, translateY: 6 }}
              transition={{ type: 'timing', duration: 160 }}
              style={[styles.tooltip, {
                top: tooltipTop,
                left: tooltipLeft,
                backgroundColor: tooltipBg,
                borderColor: tooltipBorder,
              }]}
            >
              {activeCluster.members.map(member => {
                const isDebt = member.net_balance < 0;
                const amountColor = isDebt ? colors.error : colors.success;
                const name = member.user.id === currentUserId
                  ? 'You'
                  : member.user.name.split(' ')[0];
                return (
                  <View key={member.user.id} style={styles.tooltipRow}>
                    <View style={[styles.tooltipDot, { backgroundColor: amountColor }]} />
                    <Text style={[styles.tooltipName, { color: textColor }]} numberOfLines={1}>
                      {name}
                    </Text>
                    <Text style={[styles.tooltipAmount, { color: amountColor }]}>
                      {isDebt ? '−' : '+'}₹{Math.abs(member.net_balance).toFixed(0)}
                    </Text>
                  </View>
                );
              })}
            </MotiView>
          )}
        </AnimatePresence>

      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 16,
    padding: 16,
    paddingBottom: 14,
  },
  /** Positioning context for the absolute tooltip. */
  inner: {
    position: 'relative',
  },
  trackSection: {
    position: 'relative',
    width: '100%',
  },
  stem: {
    position: 'absolute',
    width: 2,
    borderRadius: 1,
  },
  trackRow: {
    position: 'absolute',
    left: 0,
    right: 0,
    flexDirection: 'row',
    borderRadius: TRACK_H / 2,
    overflow: 'hidden',
  },
  trackSegment: {
    flex: 1,
    height: '100%',
  },
  centreTick: {
    position: 'absolute',
    left: '50%',
    marginLeft: -1,
    top: 0,
    bottom: 0,
    width: 2,
    backgroundColor: 'rgba(255,255,255,0.5)',
  },
  cluster: {
    position: 'absolute',
    flexDirection: 'row',
    alignItems: 'center',
  },
  avatar: {
    width: AVATAR_SIZE,
    height: AVATAR_SIZE,
    borderRadius: AVATAR_SIZE / 2,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    overflow: 'hidden',
  },
  avatarImage: {
    width: AVATAR_SIZE,
    height: AVATAR_SIZE,
    borderRadius: AVATAR_SIZE / 2,
  },
  avatarText: {
    color: colors.white,
    fontSize: 10,
    fontWeight: '700',
  },
  extraBadge: {
    width: AVATAR_SIZE,
    height: AVATAR_SIZE,
    borderRadius: AVATAR_SIZE / 2,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
  },
  extraText: {
    color: colors.white,
    fontSize: 9,
    fontWeight: '700',
  },
  axis: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 8,
  },
  axisLabel: {
    fontSize: 11,
    fontWeight: '500',
  },
  /** Floating popover — absolutely positioned over the axis. */
  tooltip: {
    position: 'absolute',
    width: TOOLTIP_W,
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 10,
    gap: 4,
    zIndex: 50,
    // iOS shadow
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.14,
    shadowRadius: 14,
    // Android elevation
    elevation: 8,
  },
  tooltipRow: {
    flexDirection: 'row',
    alignItems: 'center',
    height: TOOLTIP_ROW_H,
    gap: 8,
  },
  tooltipDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    flexShrink: 0,
  },
  tooltipName: {
    flex: 1,
    fontSize: 13,
    fontWeight: '600',
  },
  tooltipAmount: {
    fontSize: 13,
    fontWeight: '700',
    flexShrink: 0,
  },
});

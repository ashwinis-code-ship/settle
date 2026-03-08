/**
 * FilterScrubber
 *
 * A floating frosted-glass pill that sits above the tab bar.
 * - Collapsed: shows 4 coloured dots (active one pulses/glows)
 * - Expanded: touch expands the pill; drag finger to switch filter;
 *             a sliding highlight follows the active item
 * - Auto-collapses 1.5 s after finger lifts
 * - Hides/shows based on scroll direction (controlled via `visible` prop)
 */

import { BlurView } from 'expo-blur';
import { Ionicons } from '@expo/vector-icons';
import { useCallback, useEffect, useRef } from 'react';
import { Dimensions, StyleSheet, Text, View } from 'react-native';
import Animated, {
  Easing,
  interpolate,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';

import { colors } from '@/constants/colors';
import { hapticLight } from '@/lib/haptics';

// ─── Types & constants ────────────────────────────────────────────────────────

export type FilterType = 'all' | 'outstanding' | 'i_owe' | 'they_owe';

const FILTERS = [
  { key: 'all'         as FilterType, label: 'Everyone',    icon: 'people-outline'    as const, color: colors.gray[500]   },
  { key: 'outstanding' as FilterType, label: 'Outstanding', icon: 'swap-horizontal'   as const, color: '#3B82F6'           },
  { key: 'i_owe'       as FilterType, label: 'Paying',      icon: 'arrow-up-circle'   as const, color: colors.error       },
  { key: 'they_owe'    as FilterType, label: 'Collecting',  icon: 'arrow-down-circle' as const, color: colors.success     },
] as const;

const { width: SCREEN_W } = Dimensions.get('window');

const COLLAPSED_W = 136;
const EXPANDED_W  = Math.min(SCREEN_W - 48, 340);
const COLLAPSED_H = 38;
const EXPANDED_H  = 56;
const ITEM_W      = EXPANDED_W / 4;

// ─── FilterDot ────────────────────────────────────────────────────────────────

function FilterDot({
  color,
  isActive,
  expanded,
  pulse,
}: {
  color: string;
  isActive: boolean;
  expanded: Animated.SharedValue<number>;
  pulse: Animated.SharedValue<number>;
}) {
  const dotSize  = isActive ? 13 : 8;
  const glowSize = dotSize + 10;

  // Slow ambient glow ring — only opacity breathes, no scale change
  const glowStyle = useAnimatedStyle(() => ({
    opacity: isActive
      ? interpolate(pulse.value, [0, 1], [0.18, 0.52]) *
        interpolate(expanded.value, [0, 0.3], [1, 0])
      : 0,
  }));

  const coreStyle = useAnimatedStyle(() => ({
    opacity: interpolate(expanded.value, [0, 0.35], [1, 0]),
  }));

  return (
    <View style={styles.dotWrapper}>
      <Animated.View
        style={[
          styles.dotGlow,
          { width: glowSize, height: glowSize, borderRadius: glowSize / 2, backgroundColor: color + '44' },
          glowStyle,
        ]}
      />
      <Animated.View
        style={[
          styles.dotCore,
          { width: dotSize, height: dotSize, borderRadius: dotSize / 2, backgroundColor: isActive ? color : 'rgba(150,150,160,0.45)' },
          coreStyle,
        ]}
      />
    </View>
  );
}

// ─── FilterItem (expanded label) ──────────────────────────────────────────────

function FilterItem({
  filter,
  isActive,
  expanded,
}: {
  filter: (typeof FILTERS)[number];
  isActive: boolean;
  expanded: Animated.SharedValue<number>;
}) {
  const animStyle = useAnimatedStyle(() => ({
    opacity: interpolate(expanded.value, [0.55, 1], [0, 1]),
  }));

  return (
    <Animated.View style={[styles.filterItem, animStyle]}>
      <Ionicons
        name={filter.icon}
        size={13}
        color={isActive ? filter.color : colors.gray[400]}
      />
      <Text
        style={[
          styles.filterLabel,
          { color: isActive ? filter.color : colors.gray[400] },
          isActive && styles.filterLabelActive,
        ]}
        numberOfLines={1}
      >
        {filter.label}
      </Text>
    </Animated.View>
  );
}

// ─── ActiveHighlight (sliding pill under selected item) ───────────────────────

function ActiveHighlight({
  expanded,
  highlightX,
}: {
  expanded: Animated.SharedValue<number>;
  highlightX: Animated.SharedValue<number>;
}) {
  const style = useAnimatedStyle(() => ({
    opacity: interpolate(expanded.value, [0.5, 1], [0, 1]),
    transform: [{ translateX: highlightX.value + 4 }],
  }));

  return <Animated.View style={[styles.highlight, style]} />;
}

// ─── FilterScrubber ───────────────────────────────────────────────────────────

export interface FilterScrubberProps {
  activeFilter: FilterType;
  onFilterChange: (filter: FilterType) => void;
  visible: boolean;
  isDark: boolean;
}

export function FilterScrubber({
  activeFilter,
  onFilterChange,
  visible,
  isDark,
}: FilterScrubberProps) {
  const expanded   = useSharedValue(0);
  const pulse      = useSharedValue(1);
  const visibleSV  = useSharedValue(visible ? 1 : 0);

  const activeIdx  = FILTERS.findIndex((f) => f.key === activeFilter);
  const highlightX = useSharedValue(activeIdx * ITEM_W);

  const lastIdx      = useRef(activeIdx);
  const collapseTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Show / hide via shared value so the spring runs on the UI thread
  useEffect(() => {
    visibleSV.value = withSpring(visible ? 1 : 0, { damping: 28, stiffness: 180 });
  }, [visible]);

  // Slow ambient glow breath — 4 s per full cycle, pure opacity (no scale)
  useEffect(() => {
    pulse.value = 0;
    pulse.value = withRepeat(
      withSequence(
        withTiming(1, { duration: 2000, easing: Easing.inOut(Easing.sin) }),
        withTiming(0, { duration: 2000, easing: Easing.inOut(Easing.sin) }),
      ),
      -1,
      false,
    );
  }, [activeFilter]);

  // Slide highlight to new active item
  useEffect(() => {
    highlightX.value = withSpring(activeIdx * ITEM_W, { damping: 30, stiffness: 300 });
    lastIdx.current = activeIdx;
  }, [activeIdx]);

  const clearCollapse = useCallback(() => {
    if (collapseTimer.current) {
      clearTimeout(collapseTimer.current);
      collapseTimer.current = null;
    }
  }, []);

  const scheduleCollapse = useCallback(() => {
    clearCollapse();
    collapseTimer.current = setTimeout(() => {
      expanded.value = withSpring(0, { damping: 32, stiffness: 250 });
    }, 1500);
  }, [clearCollapse]);

  const handleFilterChange = useCallback(
    (idx: number) => {
      if (idx !== lastIdx.current) {
        lastIdx.current = idx;
        onFilterChange(FILTERS[idx].key);
        hapticLight();
      }
    },
    [onFilterChange],
  );

  const panGesture = Gesture.Pan()
    .minDistance(0)
    .onBegin((e) => {
      runOnJS(clearCollapse)();
      expanded.value = withSpring(1, { damping: 32, stiffness: 300 });
      // Detect which item was tapped immediately on touch-down
      const leftEdge = (SCREEN_W - EXPANDED_W) / 2;
      const idx = Math.max(0, Math.min(3, Math.floor((e.absoluteX - leftEdge) / ITEM_W)));
      runOnJS(handleFilterChange)(idx);
    })
    .onUpdate((e) => {
      const leftEdge = (SCREEN_W - EXPANDED_W) / 2;
      const idx = Math.max(0, Math.min(3, Math.floor((e.absoluteX - leftEdge) / ITEM_W)));
      runOnJS(handleFilterChange)(idx);
    })
    .onFinalize(() => {
      runOnJS(scheduleCollapse)();
    });

  const pillAnimStyle = useAnimatedStyle(() => ({
    width:        interpolate(expanded.value, [0, 1], [COLLAPSED_W, EXPANDED_W]),
    height:       interpolate(expanded.value, [0, 1], [COLLAPSED_H, EXPANDED_H]),
    borderRadius: interpolate(expanded.value, [0, 1], [COLLAPSED_H / 2, EXPANDED_H / 2]),
  }));

  const wrapperAnimStyle = useAnimatedStyle(() => ({
    opacity:   visibleSV.value,
    transform: [
      { scale:      interpolate(visibleSV.value, [0, 1], [0.82, 1]) },
      { translateY: interpolate(visibleSV.value, [0, 1], [10, 0]) },
    ],
  }));

  const dotsLayerAnimStyle = useAnimatedStyle(() => ({
    opacity: interpolate(expanded.value, [0, 0.3], [1, 0]),
  }));

  const itemsLayerAnimStyle = useAnimatedStyle(() => ({
    opacity: interpolate(expanded.value, [0.5, 1], [0, 1]),
  }));

  return (
    <Animated.View style={[styles.wrapper, wrapperAnimStyle]}>
      <GestureDetector gesture={panGesture}>
        <Animated.View
          style={[
            styles.pill,
            { borderColor: isDark ? 'rgba(255,255,255,0.14)' : 'rgba(0,0,0,0.08)' },
            pillAnimStyle,
          ]}
        >
          {/* Frosted glass background */}
          <BlurView
            intensity={75}
            tint={isDark ? 'dark' : 'light'}
            style={StyleSheet.absoluteFill}
          />
          {/* Tint overlay for contrast */}
          <View
            style={[
              StyleSheet.absoluteFill,
              { backgroundColor: isDark ? 'rgba(18,18,24,0.42)' : 'rgba(255,255,255,0.30)' },
            ]}
          />

          {/* Sliding highlight under active item (expanded state) */}
          <ActiveHighlight expanded={expanded} highlightX={highlightX} />

          {/* Dots (collapsed state) */}
          <Animated.View style={[styles.dotsLayer, dotsLayerAnimStyle]} pointerEvents="none">
            {FILTERS.map((f, idx) => (
              <FilterDot
                key={f.key}
                color={f.color}
                isActive={idx === activeIdx}
                expanded={expanded}
                pulse={pulse}
              />
            ))}
          </Animated.View>

          {/* Labelled items (expanded state) */}
          <Animated.View style={[styles.itemsLayer, itemsLayerAnimStyle]} pointerEvents="none">
            {FILTERS.map((f, idx) => (
              <FilterItem
                key={f.key}
                filter={f}
                isActive={idx === activeIdx}
                expanded={expanded}
              />
            ))}
          </Animated.View>
        </Animated.View>
      </GestureDetector>
    </Animated.View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  wrapper: {
    alignItems: 'center',
  },
  pill: {
    overflow: 'hidden',
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.18,
    shadowRadius: 14,
    elevation: 10,
  },
  dotsLayer: {
    position: 'absolute',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 14,
    width: '100%',
    height: '100%',
  },
  itemsLayer: {
    position: 'absolute',
    flexDirection: 'row',
    alignItems: 'center',
    width: EXPANDED_W,
    height: '100%',
  },
  dotWrapper: {
    width: 20,
    height: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dotGlow: {
    position: 'absolute',
  },
  dotCore: {
    position: 'absolute',
  },
  filterItem: {
    width: ITEM_W,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 4,
    paddingHorizontal: 2,
  },
  filterLabel: {
    fontSize: 11,
    fontWeight: '500',
  },
  filterLabelActive: {
    fontWeight: '700',
  },
  highlight: {
    position: 'absolute',
    left: 0,
    top: 8,
    width: ITEM_W - 8,
    height: EXPANDED_H - 16,
    borderRadius: (EXPANDED_H - 16) / 2,
    backgroundColor: 'rgba(255, 255, 255, 0.18)',
  },
});

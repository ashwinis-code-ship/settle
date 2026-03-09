/**
 * FilterScrubber
 *
 * A floating frosted-glass pill that sits above the tab bar.
 * - Collapsed: shows N coloured dots (active one pulses/glows)
 * - Expanded: touch expands the pill; drag finger to switch filter;
 *             a sliding highlight follows the active item
 * - Auto-collapses 500 ms after finger lifts
 * - Hides/shows based on scroll direction (controlled via `visible` prop)
 *
 * Accepts a generic `filters` array so it works for any screen.
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

// ─── Public types ─────────────────────────────────────────────────────────────

export interface FilterOption {
  key: string;
  label: string;
  icon: React.ComponentProps<typeof Ionicons>['name'];
  color: string;
}

/** Legacy alias kept so friends.tsx can keep using FilterType without changes */
export type FilterType = 'all' | 'outstanding' | 'i_owe' | 'they_owe';

export const FRIEND_FILTERS: FilterOption[] = [
  { key: 'all',         label: 'Everyone',    icon: 'people-outline',    color: colors.gray[500] },
  { key: 'outstanding', label: 'Outstanding', icon: 'swap-horizontal',   color: '#3B82F6'        },
  { key: 'i_owe',       label: 'Paying',      icon: 'arrow-up-circle',   color: colors.error     },
  { key: 'they_owe',    label: 'Collecting',  icon: 'arrow-down-circle', color: colors.success   },
];

export const GROUP_FILTERS: FilterOption[] = [
  { key: 'all',      label: 'All',      icon: 'people-outline',  color: colors.gray[500]   },
  { key: 'active',   label: 'Active',   icon: 'flash-outline',   color: colors.primary[500] },
  { key: 'archived', label: 'Archived', icon: 'archive-outline', color: '#EA580C'           },
];

export interface FilterScrubberProps {
  filters: FilterOption[];
  activeFilter: string;
  onFilterChange: (filter: string) => void;
  visible: boolean;
  isDark: boolean;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const { width: SCREEN_W } = Dimensions.get('window');
const COLLAPSED_H = 38;
const EXPANDED_H  = 56;

function getMetrics(count: number) {
  const expandedW  = Math.min(SCREEN_W - 48, Math.max(280, count * 90));
  const collapsedW = count * 34 + 24;
  const itemW      = expandedW / count;
  return { expandedW, collapsedW, itemW };
}

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
  itemW,
}: {
  filter: FilterOption;
  isActive: boolean;
  expanded: Animated.SharedValue<number>;
  itemW: number;
}) {
  const animStyle = useAnimatedStyle(() => ({
    opacity: interpolate(expanded.value, [0.55, 1], [0, 1]),
  }));

  return (
    <Animated.View style={[styles.filterItem, { width: itemW }, animStyle]}>
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

// ─── ActiveHighlight ──────────────────────────────────────────────────────────

function ActiveHighlight({
  expanded,
  highlightX,
  itemW,
}: {
  expanded: Animated.SharedValue<number>;
  highlightX: Animated.SharedValue<number>;
  itemW: number;
}) {
  const style = useAnimatedStyle(() => ({
    opacity: interpolate(expanded.value, [0.5, 1], [0, 1]),
    transform: [{ translateX: highlightX.value + 4 }],
  }));

  return (
    <Animated.View
      style={[
        styles.highlight,
        { width: itemW - 8, height: EXPANDED_H - 16, borderRadius: (EXPANDED_H - 16) / 2 },
        style,
      ]}
    />
  );
}

// ─── FilterScrubber ───────────────────────────────────────────────────────────

export function FilterScrubber({
  filters,
  activeFilter,
  onFilterChange,
  visible,
  isDark,
}: FilterScrubberProps) {
  const { expandedW, collapsedW, itemW } = getMetrics(filters.length);
  const maxIdx = filters.length - 1;

  const expanded    = useSharedValue(0);
  const pulse       = useSharedValue(1);
  const visibleSV   = useSharedValue(visible ? 1 : 0);

  const activeIdx   = filters.findIndex((f) => f.key === activeFilter);
  const highlightX  = useSharedValue(activeIdx * itemW);

  const lastIdx       = useRef(activeIdx);
  const collapseTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    visibleSV.value = withSpring(visible ? 1 : 0, { damping: 28, stiffness: 180 });
  }, [visible]);

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

  useEffect(() => {
    highlightX.value = activeIdx * itemW;
    lastIdx.current  = activeIdx;
  }, [activeIdx, itemW]);

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
    }, 500);
  }, [clearCollapse]);

  const handleFilterChange = useCallback(
    (idx: number) => {
      if (idx !== lastIdx.current) {
        lastIdx.current = idx;
        onFilterChange(filters[idx].key);
        hapticLight();
      }
    },
    [onFilterChange, filters],
  );

  const panGesture = Gesture.Pan()
    .minDistance(0)
    .onBegin((e) => {
      runOnJS(clearCollapse)();
      expanded.value = withSpring(1, { damping: 32, stiffness: 300 });
      const leftEdge = (SCREEN_W - expandedW) / 2;
      const idx = Math.max(0, Math.min(maxIdx, Math.floor((e.absoluteX - leftEdge) / itemW)));
      highlightX.value = idx * itemW;
      runOnJS(handleFilterChange)(idx);
    })
    .onUpdate((e) => {
      const leftEdge = (SCREEN_W - expandedW) / 2;
      const idx = Math.max(0, Math.min(maxIdx, Math.floor((e.absoluteX - leftEdge) / itemW)));
      highlightX.value = idx * itemW;
      runOnJS(handleFilterChange)(idx);
    })
    .onFinalize(() => {
      runOnJS(scheduleCollapse)();
    });

  const pillAnimStyle = useAnimatedStyle(() => ({
    width:        interpolate(expanded.value, [0, 1], [collapsedW, expandedW]),
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
          <BlurView
            intensity={75}
            tint={isDark ? 'dark' : 'light'}
            style={StyleSheet.absoluteFill}
          />
          <View
            style={[
              StyleSheet.absoluteFill,
              { backgroundColor: isDark ? 'rgba(18,18,24,0.42)' : 'rgba(255,255,255,0.30)' },
            ]}
          />

          <ActiveHighlight expanded={expanded} highlightX={highlightX} itemW={itemW} />

          <Animated.View style={[styles.dotsLayer, dotsLayerAnimStyle]} pointerEvents="none">
            {filters.map((f, idx) => (
              <FilterDot
                key={f.key}
                color={f.color}
                isActive={idx === activeIdx}
                expanded={expanded}
                pulse={pulse}
              />
            ))}
          </Animated.View>

          <Animated.View
            style={[styles.itemsLayer, { width: expandedW }, itemsLayerAnimStyle]}
            pointerEvents="none"
          >
            {filters.map((f, idx) => (
              <FilterItem
                key={f.key}
                filter={f}
                isActive={idx === activeIdx}
                expanded={expanded}
                itemW={itemW}
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
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 4,
    paddingHorizontal: 2,
  },
  filterLabel: {
    fontSize: 11,
    fontFamily: 'Nunito_500Medium',
  },
  filterLabelActive: {
    fontFamily: 'Nunito_700Bold',
  },
  highlight: {
    position: 'absolute',
    left: 0,
    top: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.18)',
  },
});

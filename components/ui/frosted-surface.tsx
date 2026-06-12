/**
 * Platform-native frosted / surface material.
 *
 * iOS 26+: Liquid Glass (GlassView)
 * iOS <26: BlurView + light tint overlay
 * Android: M3 elevated surface (no blur)
 */

import { BlurView } from 'expo-blur';
import { GlassView, isGlassEffectAPIAvailable } from 'expo-glass-effect';
import {
  Platform,
  StyleSheet,
  View,
  type StyleProp,
  type ViewProps,
  type ViewStyle,
} from 'react-native';

import { platform } from '@/constants/colors';

export type FrostedSurfaceVariant = 'elevated' | 'flat';

interface FrostedSurfaceProps extends Pick<ViewProps, 'pointerEvents'> {
  isDark: boolean;
  style?: StyleProp<ViewStyle>;
  children?: React.ReactNode;
  /** Android elevation; ignored when variant is flat */
  elevation?: number;
  variant?: FrostedSurfaceVariant;
  blurIntensity?: number;
}

export function FrostedSurface({
  isDark,
  style,
  children,
  elevation = 3,
  variant = 'elevated',
  blurIntensity = 75,
  pointerEvents,
}: FrostedSurfaceProps) {
  const surfaceColor = isDark ? platform.surface.dark : platform.surface.light;
  const androidElevation = variant === 'elevated' ? elevation : 0;

  if (Platform.OS === 'ios' && isGlassEffectAPIAvailable()) {
    return (
      <GlassView
        style={style}
        glassEffectStyle="regular"
        colorScheme={isDark ? 'dark' : 'light'}
        pointerEvents={pointerEvents}
      >
        {children}
      </GlassView>
    );
  }

  if (Platform.OS === 'ios') {
    return (
      <View style={[style, styles.clip]} pointerEvents={pointerEvents}>
        <BlurView
          intensity={blurIntensity}
          tint={isDark ? 'dark' : 'light'}
          style={StyleSheet.absoluteFill}
        />
        <View
          style={[
            StyleSheet.absoluteFill,
            {
              backgroundColor: isDark ? 'rgba(18,18,24,0.42)' : 'rgba(255,255,255,0.30)',
            },
          ]}
        />
        {children}
      </View>
    );
  }

  return (
    <View
      pointerEvents={pointerEvents}
      style={[
        style,
        {
          backgroundColor: surfaceColor,
          elevation: androidElevation,
        },
      ]}
    >
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  clip: {
    overflow: 'hidden',
  },
});

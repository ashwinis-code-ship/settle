/**
 * Platform-native background for @gorhom/bottom-sheet.
 */

import type { BottomSheetBackgroundProps } from '@gorhom/bottom-sheet';

import { FrostedSurface } from '@/components/ui/frosted-surface';
import { useColorScheme } from '@/hooks/use-color-scheme';

export function SheetBackground({ style, pointerEvents }: BottomSheetBackgroundProps) {
  const colorScheme = useColorScheme() ?? 'light';
  const isDark = colorScheme === 'dark';

  return (
    <FrostedSurface
      isDark={isDark}
      style={style}
      variant="elevated"
      elevation={8}
      blurIntensity={80}
      pointerEvents={pointerEvents}
    />
  );
}

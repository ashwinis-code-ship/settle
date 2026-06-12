/**
 * Layout offsets for content floating above native tab bars.
 *
 * The old JS tab bar used a fixed ~61px chrome height. Native tabs differ by platform:
 * - iOS UITabBar ≈ 49pt above the home indicator
 * - Android Material bottom nav ≈ 80dp (icon + label)
 */

import { Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const NATIVE_TAB_BAR_HEIGHT = Platform.select({
  ios: 49,
  android: 80,
  default: 56,
})!;

const SCRUBBER_GAP = 12;
const SCRUBBER_HEIGHT = 56;

export function useTabBarOffset() {
  const insets = useSafeAreaInsets();
  const tabBarOffset = insets.bottom + NATIVE_TAB_BAR_HEIGHT;

  return {
    /** Bottom inset for floating UI (e.g. FilterScrubber) */
    scrubberBottom: tabBarOffset + SCRUBBER_GAP,
    /** List content padding to clear tab bar + scrubber */
    listPaddingBottom: tabBarOffset + SCRUBBER_HEIGHT + SCRUBBER_GAP + 24,
  };
}

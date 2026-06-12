/**
 * Android system chrome — edge-to-edge navigation bar + root background.
 */

import * as SystemUI from 'expo-system-ui';
import { Platform } from 'react-native';

import { getPlatformChrome } from '@/lib/platform-theme';

export async function configureAndroidChrome(isDark: boolean) {
  if (Platform.OS !== 'android') return;

  const { background } = getPlatformChrome(isDark);

  // Navigation bar styling is configured via the expo-navigation-bar config plugin.
  // Runtime color APIs are no-ops under mandatory edge-to-edge on SDK 55+.
  await SystemUI.setBackgroundColorAsync(background);
}

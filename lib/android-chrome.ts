/**
 * Android system chrome — edge-to-edge navigation bar + root background.
 */

import * as NavigationBar from 'expo-navigation-bar';
import * as SystemUI from 'expo-system-ui';
import { Platform } from 'react-native';

import { getPlatformChrome } from '@/lib/platform-theme';

export async function configureAndroidChrome(isDark: boolean) {
  if (Platform.OS !== 'android') return;

  const { background } = getPlatformChrome(isDark);

  await SystemUI.setBackgroundColorAsync(background);
  await NavigationBar.setButtonStyleAsync(isDark ? 'light' : 'dark');
}

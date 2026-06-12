/**
 * Platform chrome tokens — backgrounds, surfaces, and nav colors for native shell.
 *
 * Brand accents (CTAs, balances) stay in `brand`; use these for tab bar, headers, and system UI.
 * We intentionally do NOT call Appearance.setColorScheme() — it can break iOS 26 tab bar blur.
 * User theme preference flows through explicit native props instead.
 */

import { DarkTheme, DefaultTheme, type Theme } from '@react-navigation/native';
import { Platform } from 'react-native';

import { brand, platform, type ColorScheme } from '@/constants/colors';
import type { ThemeMode } from '@/contexts/settings-context';

export type PlatformChrome = {
  background: string;
  surface: string;
  textPrimary: string;
  textSecondary: string;
  tabBarBackground: string | undefined;
  tabIconDefault: string;
  headerShadow: boolean;
};

export function getPlatformChrome(isDark: boolean): PlatformChrome {
  return {
    background: isDark ? platform.background.dark : platform.background.light,
    surface: isDark ? platform.surface.dark : platform.surface.light,
    textPrimary: isDark ? platform.text.dark.primary : platform.text.light.primary,
    textSecondary: isDark ? platform.text.dark.secondary : platform.text.light.secondary,
    tabBarBackground:
      Platform.OS === 'android' ? (isDark ? platform.gray[900] : platform.white) : undefined,
    tabIconDefault: isDark ? platform.gray[400] : platform.gray[500],
    headerShadow: Platform.OS === 'android' ? true : !isDark,
  };
}

/** Whether native chrome needs explicit colors (vs system liquid glass on iOS). */
export function shouldUseExplicitNativeChrome(themeMode: ThemeMode): boolean {
  return Platform.OS === 'android' || themeMode !== 'system';
}

/** iOS tab bar material when user overrides system appearance. */
export function getIosTabBarBlurEffect(isDark: boolean): 'systemChromeMaterialDark' | 'systemChromeMaterialLight' {
  return isDark ? 'systemChromeMaterialDark' : 'systemChromeMaterialLight';
}

export function getNavigationTheme(scheme: ColorScheme): Theme {
  const isDark = scheme === 'dark';
  const chrome = getPlatformChrome(isDark);
  const base = isDark ? DarkTheme : DefaultTheme;

  return {
    ...base,
    dark: isDark,
    colors: {
      ...base.colors,
      primary: brand.primary[500],
      background: chrome.background,
      card: chrome.surface,
      text: chrome.textPrimary,
      border: isDark ? platform.gray[800] : platform.gray[200],
      notification: brand.error,
    },
  };
}

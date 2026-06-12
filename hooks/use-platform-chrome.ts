import { useMemo } from 'react';

import { useSettings } from '@/contexts/settings-context';
import { useColorScheme } from '@/hooks/use-color-scheme';
import {
  getIosTabBarBlurEffect,
  getPlatformChrome,
  shouldUseExplicitNativeChrome,
  type PlatformChrome,
} from '@/lib/platform-theme';

export function usePlatformChrome(): PlatformChrome & {
  isDark: boolean;
  themeMode: ReturnType<typeof useSettings>['themeMode'];
  useExplicitNativeChrome: boolean;
  iosTabBarBlurEffect: ReturnType<typeof getIosTabBarBlurEffect> | undefined;
} {
  const colorScheme = useColorScheme();
  const { themeMode } = useSettings();
  const isDark = colorScheme === 'dark';

  const chrome = useMemo(() => getPlatformChrome(isDark), [isDark]);
  const useExplicitNativeChrome = shouldUseExplicitNativeChrome(themeMode);

  return {
    ...chrome,
    isDark,
    themeMode,
    useExplicitNativeChrome,
    iosTabBarBlurEffect:
      useExplicitNativeChrome && themeMode !== 'system'
        ? getIosTabBarBlurEffect(isDark)
        : undefined,
  };
}

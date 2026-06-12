import { useEffect } from 'react';

import { configureAndroidChrome } from '@/lib/android-chrome';
import { useColorScheme } from '@/hooks/use-color-scheme';

/** Keeps Android navigation bar icons + root background in sync with theme. */
export function useAndroidChrome() {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';

  useEffect(() => {
    void configureAndroidChrome(isDark);
  }, [isDark]);
}

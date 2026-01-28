/**
 * Custom useColorScheme hook
 * 
 * Uses settings context for theme preference with fallback to system.
 */

import { useContext } from 'react';
import { useColorScheme as useSystemColorScheme } from 'react-native';

// Try to import settings context, but don't fail if not available
let useSettingsContext: (() => { effectiveTheme: 'light' | 'dark' }) | null = null;

try {
  // Dynamic import to avoid circular dependencies
  const settingsModule = require('@/contexts/settings-context');
  useSettingsContext = settingsModule.useSettings;
} catch {
  // Settings context not available, will use system theme
}

export function useColorScheme(): 'light' | 'dark' {
  const systemTheme = useSystemColorScheme();
  
  // Try to use settings context if available
  try {
    if (useSettingsContext) {
      const { effectiveTheme } = useSettingsContext();
      return effectiveTheme;
    }
  } catch {
    // Context not available (e.g., outside provider), fall back to system
  }
  
  return systemTheme ?? 'light';
}

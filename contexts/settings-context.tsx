/**
 * Settings Context
 * 
 * Manages app-wide user preferences like theme, currency, and notifications.
 * Persists settings to AsyncStorage.
 */

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from 'react';
import { useColorScheme as useSystemColorScheme } from 'react-native';
import { storage, STORAGE_KEYS } from '@/lib/storage';
import type { CurrencyCode } from '@/types';

// ============================================
// TYPES
// ============================================

export type ThemeMode = 'light' | 'dark' | 'system';

interface SettingsContextType {
  // Theme
  themeMode: ThemeMode;
  effectiveTheme: 'light' | 'dark';
  setThemeMode: (mode: ThemeMode) => Promise<void>;
  
  // Currency
  defaultCurrency: CurrencyCode;
  setDefaultCurrency: (currency: CurrencyCode) => Promise<void>;
  
  // Notifications
  notificationsEnabled: boolean;
  setNotificationsEnabled: (enabled: boolean) => Promise<void>;
  
  // Loading state
  isLoading: boolean;
}

const SettingsContext = createContext<SettingsContextType | undefined>(undefined);

// ============================================
// PROVIDER
// ============================================

export function SettingsProvider({ children }: { children: ReactNode }) {
  const systemColorScheme = useSystemColorScheme();
  
  const [themeMode, setThemeModeState] = useState<ThemeMode>('system');
  const [defaultCurrency, setDefaultCurrencyState] = useState<CurrencyCode>('INR');
  const [notificationsEnabled, setNotificationsEnabledState] = useState(true);
  const [isLoading, setIsLoading] = useState(true);

  // Load settings from storage on mount
  useEffect(() => {
    const loadSettings = async () => {
      try {
        const [savedTheme, savedCurrency, savedNotifications] = await Promise.all([
          storage.get<ThemeMode>(STORAGE_KEYS.THEME),
          storage.get<CurrencyCode>(STORAGE_KEYS.DEFAULT_CURRENCY),
          storage.get<boolean>(STORAGE_KEYS.NOTIFICATIONS_ENABLED),
        ]);

        if (savedTheme) setThemeModeState(savedTheme);
        if (savedCurrency) setDefaultCurrencyState(savedCurrency);
        if (savedNotifications !== null) setNotificationsEnabledState(savedNotifications);
      } catch (error) {
        console.error('[Settings] Failed to load settings:', error);
      } finally {
        setIsLoading(false);
      }
    };

    loadSettings();
  }, []);

  // Calculate effective theme based on mode and system preference.
  // Native chrome reads effectiveTheme via useColorScheme — we intentionally avoid
  // Appearance.setColorScheme() which can break iOS 26 liquid glass on inactive tabs.
  const effectiveTheme: 'light' | 'dark' =
    themeMode === 'system' 
      ? (systemColorScheme ?? 'light')
      : themeMode;

  // Theme setter with persistence
  const setThemeMode = useCallback(async (mode: ThemeMode) => {
    setThemeModeState(mode);
    await storage.set(STORAGE_KEYS.THEME, mode);
  }, []);

  // Currency setter with persistence
  const setDefaultCurrency = useCallback(async (currency: CurrencyCode) => {
    setDefaultCurrencyState(currency);
    await storage.set(STORAGE_KEYS.DEFAULT_CURRENCY, currency);
  }, []);

  // Notifications setter with persistence
  const setNotificationsEnabled = useCallback(async (enabled: boolean) => {
    setNotificationsEnabledState(enabled);
    await storage.set(STORAGE_KEYS.NOTIFICATIONS_ENABLED, enabled);
  }, []);

  return (
    <SettingsContext.Provider
      value={{
        themeMode,
        effectiveTheme,
        setThemeMode,
        defaultCurrency,
        setDefaultCurrency,
        notificationsEnabled,
        setNotificationsEnabled,
        isLoading,
      }}
    >
      {children}
    </SettingsContext.Provider>
  );
}

// ============================================
// HOOK
// ============================================

export function useSettings() {
  const context = useContext(SettingsContext);
  if (context === undefined) {
    throw new Error('useSettings must be used within a SettingsProvider');
  }
  return context;
}

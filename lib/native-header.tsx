/**
 * Shared native stack header styling for pushed screens.
 */

import type { NativeStackNavigationOptions } from '@react-navigation/native-stack';
import { useNavigation } from 'expo-router';
import { useLayoutEffect, useMemo, type ReactNode } from 'react';
import { ActivityIndicator, Platform, Pressable, Text } from 'react-native';

import { IconSymbol } from '@/components/ui/icon-symbol';
import type { IconSymbolName } from '@/components/ui/icon-symbol-mapping';

import { brand, colors } from '@/constants/colors';
import { getPlatformChrome } from '@/lib/platform-theme';
import { useColorScheme } from '@/hooks/use-color-scheme';

export function getNativeStackScreenOptions(isDark: boolean): NativeStackNavigationOptions {
  const chrome = getPlatformChrome(isDark);

  return {
    headerShown: true,
    headerBackTitle: Platform.OS === 'ios' ? 'Back' : '',
    headerBackButtonDisplayMode: Platform.OS === 'ios' ? 'default' : 'minimal',
    headerTintColor: brand.primary[500],
    headerStyle: {
      backgroundColor: chrome.surface,
    },
    headerTitleStyle: {
      color: chrome.textPrimary,
      ...(Platform.OS === 'android' ? { fontWeight: '500' as const } : {}),
    },
    headerShadowVisible: chrome.headerShadow,
    gestureEnabled: true,
    animation: Platform.OS === 'android' ? 'slide_from_right' : 'default',
  };
}

export function HeaderIconButton({
  icon,
  onPress,
  disabled,
  color,
}: {
  icon: IconSymbolName;
  onPress: () => void;
  disabled?: boolean;
  color?: string;
}) {
  const colorScheme = useColorScheme() ?? 'light';
  const isDark = colorScheme === 'dark';
  const tint = color ?? (isDark ? colors.text.dark.primary : colors.text.light.primary);

  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      hitSlop={8}
      style={({ pressed }) => ({ opacity: pressed || disabled ? 0.5 : 1, paddingHorizontal: 4 })}
    >
      <IconSymbol name={icon} size={22} color={tint} />
    </Pressable>
  );
}

export function HeaderSaveButton({
  onPress,
  disabled,
  loading,
  label = 'Save',
}: {
  onPress: () => void;
  disabled?: boolean;
  loading?: boolean;
  label?: string;
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled || loading}
      hitSlop={8}
      style={({ pressed }) => ({
        opacity: pressed || disabled || loading ? 0.55 : 1,
        flexDirection: 'row',
        alignItems: 'center',
        gap: label ? 4 : 0,
        paddingHorizontal: 4,
      })}
    >
      {loading ? (
        <ActivityIndicator size="small" color={colors.primary[500]} />
      ) : (
        <>
          <IconSymbol name="checkmark" size={label ? 20 : 26} color={colors.primary[500]} />
          {label ? (
            <Text style={{ color: colors.primary[500], fontSize: 16, fontWeight: '600' }}>{label}</Text>
          ) : null}
        </>
      )}
    </Pressable>
  );
}

/**
 * Configures the native stack header via navigation options.
 * Render once near the top of a screen component.
 */
export function NativeScreenHeader({
  title,
  headerRight,
  headerLeft,
  headerBackVisible = true,
  headerShown = true,
}: {
  title: string;
  headerRight?: ReactNode;
  headerLeft?: ReactNode;
  headerBackVisible?: boolean;
  headerShown?: boolean;
}) {
  const navigation = useNavigation();
  const colorScheme = useColorScheme() ?? 'light';
  const isDark = colorScheme === 'dark';
  const baseOptions = useMemo(() => getNativeStackScreenOptions(isDark), [isDark]);

  useLayoutEffect(() => {
    navigation.setOptions({
      ...baseOptions,
      title,
      headerShown,
      headerBackVisible,
      headerLeft: headerLeft ? () => headerLeft : undefined,
      headerRight: headerRight ? () => headerRight : undefined,
    });
  }, [navigation, baseOptions, title, headerShown, headerBackVisible, headerLeft, headerRight]);

  return null;
}

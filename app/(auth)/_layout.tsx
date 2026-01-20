/**
 * Auth Layout
 * 
 * Stack navigator for auth screens
 * 
 * Flow:
 * - sign-in: Login with phone + password
 * - sign-up: Step 1 - Name + Phone → Get OTP
 * - verify-otp: Step 2 - Enter OTP
 * - set-password: Step 3 - Create password
 */

import { Stack } from 'expo-router';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { colors } from '@/constants/colors';

export default function AuthLayout() {
  const colorScheme = useColorScheme() ?? 'light';
  const isDark = colorScheme === 'dark';

  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: {
          backgroundColor: isDark ? colors.background.dark : colors.background.light,
        },
        animation: 'slide_from_right',
      }}
    >
      <Stack.Screen name="sign-in" />
      <Stack.Screen name="sign-up" />
      <Stack.Screen name="verify-otp" />
      <Stack.Screen name="set-password" />
      <Stack.Screen name="forgot-password" />
      <Stack.Screen name="reset-password" />
    </Stack>
  );
}

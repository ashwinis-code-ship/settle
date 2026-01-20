/**
 * Reset Password Screen
 * 
 * Set new password after OTP verification (forgot password flow).
 */

import { useState, useRef } from 'react';
import {
  StyleSheet,
  View,
  Text,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Pressable,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MotiView, MotiText } from 'moti';
import { router, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { colors } from '@/constants/colors';
import { supabase } from '@/lib/supabase';

export default function ResetPasswordScreen() {
  const colorScheme = useColorScheme() ?? 'light';
  const isDark = colorScheme === 'dark';
  const params = useLocalSearchParams<{ phone: string; resetToken: string }>();

  const phone = params.phone || '';
  const resetToken = params.resetToken || '';

  // Form state
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  // Refs
  const confirmPasswordRef = useRef<TextInput>(null);

  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!password) {
      newErrors.password = 'Password is required';
    } else if (password.length < 6) {
      newErrors.password = 'Password must be at least 6 characters';
    } else if (!/[A-Za-z]/.test(password) || !/[0-9]/.test(password)) {
      newErrors.password = 'Password must contain letters and numbers';
    }

    if (!confirmPassword) {
      newErrors.confirmPassword = 'Please confirm your password';
    } else if (password !== confirmPassword) {
      newErrors.confirmPassword = 'Passwords do not match';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleResetPassword = async () => {
    if (!validateForm()) return;

    setIsLoading(true);
    setErrors({});

    try {
      // Call Edge Function to reset password with the signed token
      const { data, error } = await supabase.functions.invoke('reset-password', {
        body: { resetToken, password },
      });

      // If we have valid data response, use it (includes business logic errors)
      if (data && typeof data.success === 'boolean') {
        if (!data.success) {
          setErrors({ form: data.message || 'Failed to reset password. Please try again.' });
          return;
        }
      } else if (error) {
        // Technical error - don't show details to user
        console.error('[ResetPassword] Error:', error);
        setErrors({ form: 'Something went wrong. Please try again later.' });
        return;
      }

      // Navigate to sign-in
      router.replace('/(auth)/sign-in');
    } catch (err) {
      console.error('[ResetPassword] Exception:', err);
      setErrors({ form: 'Something went wrong. Please try again later.' });
    } finally {
      setIsLoading(false);
    }
  };

  const textColor = isDark ? colors.text.dark.primary : colors.text.light.primary;
  const secondaryTextColor = isDark ? colors.text.dark.secondary : colors.text.light.secondary;
  const backgroundColor = isDark ? colors.background.dark : colors.background.light;

  // Password strength indicator
  const getPasswordStrength = () => {
    if (!password) return { level: 0, label: '', color: colors.gray[400] };
    
    let strength = 0;
    if (password.length >= 6) strength++;
    if (password.length >= 8) strength++;
    if (/[A-Z]/.test(password)) strength++;
    if (/[0-9]/.test(password)) strength++;
    if (/[^A-Za-z0-9]/.test(password)) strength++;

    if (strength <= 2) return { level: 1, label: 'Weak', color: colors.error };
    if (strength <= 3) return { level: 2, label: 'Medium', color: colors.warning };
    return { level: 3, label: 'Strong', color: colors.success };
  };

  const passwordStrength = getPasswordStrength();

  return (
    <SafeAreaView style={[styles.container, { backgroundColor }]} edges={['top']}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* Header */}
          <MotiView
            from={{ opacity: 0, translateY: -20 }}
            animate={{ opacity: 1, translateY: 0 }}
            transition={{ type: 'timing', duration: 500 }}
            style={styles.header}
          >
            <MotiView
              from={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ type: 'spring', damping: 15, delay: 200 }}
              style={[styles.iconContainer, { backgroundColor: colors.success + '20' }]}
            >
              <Ionicons name="shield-checkmark-outline" size={40} color={colors.success} />
            </MotiView>
            <MotiText
              from={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ type: 'timing', duration: 500, delay: 300 }}
              style={[styles.title, { color: textColor }]}
            >
              Reset Password
            </MotiText>
            <MotiText
              from={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ type: 'timing', duration: 500, delay: 400 }}
              style={[styles.subtitle, { color: secondaryTextColor }]}
            >
              Create a new password for your account
            </MotiText>
          </MotiView>

          {/* Form */}
          <MotiView
            from={{ opacity: 0, translateY: 20 }}
            animate={{ opacity: 1, translateY: 0 }}
            transition={{ type: 'timing', duration: 500, delay: 500 }}
            style={styles.form}
          >
            {/* Form Error */}
            {errors.form && (
              <MotiView
                from={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                style={styles.formError}
              >
                <Ionicons name="alert-circle" size={20} color={colors.error} />
                <Text style={styles.formErrorText}>{errors.form}</Text>
              </MotiView>
            )}

            {/* Password Input */}
            <Input
              label="New Password"
              placeholder="Create a strong password"
              value={password}
              onChangeText={setPassword}
              error={errors.password}
              secureTextEntry={!showPassword}
              autoComplete="new-password"
              returnKeyType="next"
              onSubmitEditing={() => confirmPasswordRef.current?.focus()}
              leftIcon={
                <Ionicons
                  name="lock-closed-outline"
                  size={20}
                  color={isDark ? colors.gray[400] : colors.gray[500]}
                />
              }
              rightIcon={
                <Pressable onPress={() => setShowPassword(!showPassword)}>
                  <Ionicons
                    name={showPassword ? 'eye-off-outline' : 'eye-outline'}
                    size={20}
                    color={isDark ? colors.gray[400] : colors.gray[500]}
                  />
                </Pressable>
              }
            />

            {/* Password Strength */}
            {password.length > 0 && (
              <MotiView
                from={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                style={styles.strengthContainer}
              >
                <View style={styles.strengthBars}>
                  {[1, 2, 3].map((level) => (
                    <View
                      key={level}
                      style={[
                        styles.strengthBar,
                        {
                          backgroundColor:
                            passwordStrength.level >= level
                              ? passwordStrength.color
                              : isDark
                              ? colors.gray[700]
                              : colors.gray[200],
                        },
                      ]}
                    />
                  ))}
                </View>
                <Text style={[styles.strengthLabel, { color: passwordStrength.color }]}>
                  {passwordStrength.label}
                </Text>
              </MotiView>
            )}

            {/* Confirm Password Input */}
            <Input
              ref={confirmPasswordRef}
              label="Confirm Password"
              placeholder="Re-enter your password"
              value={confirmPassword}
              onChangeText={setConfirmPassword}
              error={errors.confirmPassword}
              secureTextEntry={!showPassword}
              autoComplete="new-password"
              returnKeyType="done"
              onSubmitEditing={handleResetPassword}
              leftIcon={
                <Ionicons
                  name="lock-closed-outline"
                  size={20}
                  color={isDark ? colors.gray[400] : colors.gray[500]}
                />
              }
              rightIcon={
                confirmPassword && password === confirmPassword ? (
                  <Ionicons name="checkmark-circle" size={20} color={colors.success} />
                ) : null
              }
            />

            {/* Reset Password Button */}
            <Button
              title="Reset Password"
              onPress={handleResetPassword}
              loading={isLoading}
              style={styles.button}
            />
          </MotiView>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  flex: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: 24,
    paddingTop: 60,
    paddingBottom: 40,
  },
  header: {
    alignItems: 'center',
    marginBottom: 40,
  },
  iconContainer: {
    width: 80,
    height: 80,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 24,
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    textAlign: 'center',
  },
  form: {
    flex: 1,
  },
  formError: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: `${colors.error}15`,
    padding: 12,
    borderRadius: 12,
    marginBottom: 16,
  },
  formErrorText: {
    color: colors.error,
    marginLeft: 8,
    flex: 1,
  },
  strengthContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: -8,
    marginBottom: 16,
  },
  strengthBars: {
    flexDirection: 'row',
    flex: 1,
    gap: 4,
  },
  strengthBar: {
    flex: 1,
    height: 4,
    borderRadius: 2,
  },
  strengthLabel: {
    fontSize: 12,
    fontWeight: '600',
    marginLeft: 12,
    width: 60,
    textAlign: 'right',
  },
  button: {
    marginTop: 24,
  },
});

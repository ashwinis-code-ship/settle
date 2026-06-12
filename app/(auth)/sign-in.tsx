/**
 * Sign In Screen
 * 
 * Login form with phone and password.
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
import { router } from 'expo-router';
import { IconSymbol } from '@/components/ui/icon-symbol';

import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { CountryPicker } from '@/components/ui/country-picker';
import { useAuth } from '@/contexts/auth-context';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { colors } from '@/constants/colors';
import { DEFAULT_COUNTRY, type Country } from '@/constants/countries';

export default function SignInScreen() {
  const colorScheme = useColorScheme() ?? 'light';
  const isDark = colorScheme === 'dark';
  const { signIn } = useAuth();

  // Form state
  const [country, setCountry] = useState<Country>(DEFAULT_COUNTRY);
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  // Refs for focus management
  const passwordRef = useRef<TextInput>(null);

  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!phone.trim()) {
      newErrors.phone = 'Phone number is required';
    }

    if (!password) {
      newErrors.password = 'Password is required';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSignIn = async () => {
    if (!validateForm()) return;

    setIsLoading(true);
    setErrors({});

    try {
      const fullPhone = `${country.dialCode}${phone.replace(/\s/g, '')}`;
      const { error } = await signIn(fullPhone, password);

      if (error) {
        setErrors({ form: error.message });
        return;
      }

      // Navigate to main app
      router.replace('/(tabs)');
    } catch (err) {
      console.error('[SignIn] Exception:', err);
      setErrors({ form: 'Something went wrong. Please try again later.' });
    } finally {
      setIsLoading(false);
    }
  };

  const textColor = isDark ? colors.text.dark.primary : colors.text.light.primary;
  const secondaryTextColor = isDark ? colors.text.dark.secondary : colors.text.light.secondary;
  const backgroundColor = isDark ? colors.background.dark : colors.background.light;

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
            <View style={styles.logoContainer}>
              <MotiView
                from={{ scale: 0, rotate: '-180deg' }}
                animate={{ scale: 1, rotate: '0deg' }}
                transition={{ type: 'spring', damping: 15 }}
                style={[styles.logo, { backgroundColor: colors.primary[500] }]}
              >
                <IconSymbol name="creditcard" size={40} color={colors.white} />
              </MotiView>
            </View>
            <MotiText
              from={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ type: 'timing', duration: 500, delay: 200 }}
              style={[styles.title, { color: textColor }]}
            >
              Settle
            </MotiText>
            <MotiText
              from={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ type: 'timing', duration: 500, delay: 300 }}
              style={[styles.subtitle, { color: secondaryTextColor }]}
            >
              Split bills. Settle debts. Stay friends.
            </MotiText>
          </MotiView>

          {/* Form */}
          <MotiView
            from={{ opacity: 0, translateY: 20 }}
            animate={{ opacity: 1, translateY: 0 }}
            transition={{ type: 'timing', duration: 500, delay: 400 }}
            style={styles.form}
          >
            {/* Form Error */}
            {errors.form && (
              <MotiView
                from={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                style={styles.formError}
              >
                <IconSymbol name="exclamationmark.circle" size={20} color={colors.error} />
                <Text style={styles.formErrorText}>{errors.form}</Text>
              </MotiView>
            )}

            {/* Phone Input */}
            <View style={styles.phoneInputContainer}>
              <Text style={[styles.inputLabel, { color: secondaryTextColor }]}>
                Phone Number
              </Text>
              <View style={styles.phoneRow}>
                <CountryPicker
                  selectedCountry={country}
                  onSelect={setCountry}
                />
                <View style={styles.phoneInputWrapper}>
                  <Input
                    placeholder="98765 43210"
                    value={phone}
                    onChangeText={setPhone}
                    error={errors.phone}
                    keyboardType="phone-pad"
                    autoComplete="tel"
                    returnKeyType="next"
                    onSubmitEditing={() => passwordRef.current?.focus()}
                    containerStyle={styles.phoneInput}
                  />
                </View>
              </View>
            </View>

            {/* Password Input */}
            <Input
              ref={passwordRef}
              label="Password"
              placeholder="••••••••"
              value={password}
              onChangeText={setPassword}
              error={errors.password}
              secureTextEntry={!showPassword}
              autoComplete="password"
              returnKeyType="done"
              onSubmitEditing={handleSignIn}
              leftIcon={
                <IconSymbol
                  name="lock"
                  size={20}
                  color={isDark ? colors.gray[400] : colors.gray[500]}
                />
              }
              rightIcon={
                <Pressable onPress={() => setShowPassword(!showPassword)}>
                  <IconSymbol
                    name={showPassword ? 'eye.slash' : 'eye'}
                    size={20}
                    color={isDark ? colors.gray[400] : colors.gray[500]}
                  />
                </Pressable>
              }
            />

            {/* Forgot Password Link */}
            <View style={styles.forgotPasswordContainer}>
              <Pressable onPress={() => router.push('/(auth)/forgot-password')}>
                <Text style={[styles.forgotPasswordText, { color: colors.primary[500] }]}>
                  Forgot Password?
                </Text>
              </Pressable>
            </View>

            {/* Sign In Button */}
            <Button
              title="Sign In"
              onPress={handleSignIn}
              loading={isLoading}
              style={styles.button}
            />

            {/* Sign Up Link */}
            <View style={styles.footer}>
              <Text style={[styles.footerText, { color: secondaryTextColor }]}>
                Don't have an account?{' '}
              </Text>
              <Pressable onPress={() => router.replace('/(auth)/sign-up')}>
                <Text style={[styles.link, { color: colors.primary[500] }]}>
                  Sign Up
                </Text>
              </Pressable>
            </View>
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
    paddingTop: 80,
    paddingBottom: 40,
  },
  header: {
    alignItems: 'center',
    marginBottom: 48,
  },
  logoContainer: {
    marginBottom: 24,
  },
  logo: {
    width: 80,
    height: 80,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: colors.primary[500],
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.3,
    shadowRadius: 16,
    elevation: 8,
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
  forgotPasswordContainer: {
    alignItems: 'flex-end',
    marginBottom: 24,
    marginTop: -8,
  },
  forgotPasswordText: {
    fontSize: 14,
    fontWeight: '500',
  },
  button: {
    marginTop: 8,
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginTop: 24,
  },
  footerText: {
    fontSize: 14,
  },
  link: {
    fontSize: 14,
    fontWeight: '600',
  },
  phoneInputContainer: {
    marginBottom: 16,
  },
  inputLabel: {
    fontSize: 14,
    fontWeight: '500',
    marginBottom: 6,
  },
  phoneRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  phoneInputWrapper: {
    flex: 1,
  },
  phoneInput: {
    marginBottom: 0,
  },
});

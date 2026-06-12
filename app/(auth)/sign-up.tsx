/**
 * Sign Up Screen - Step 1
 * 
 * Collect name and phone number, then send OTP.
 */

import { useState, useRef, useEffect } from 'react';
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
import { useColorScheme } from '@/hooks/use-color-scheme';
import { colors } from '@/constants/colors';
import { DEFAULT_COUNTRY, type Country } from '@/constants/countries';
import { sendOtp } from '@/lib/otp-service';
import { Analytics } from '@/lib/analytics';
import { AUTH_EVENTS } from '@/lib/analytics-events';

export default function SignUpScreen() {
  const colorScheme = useColorScheme() ?? 'light';
  const isDark = colorScheme === 'dark';

  // Form state
  const [name, setName] = useState('');
  const [country, setCountry] = useState<Country>(DEFAULT_COUNTRY);
  const [phone, setPhone] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  // Refs for focus management
  const phoneRef = useRef<TextInput>(null);

  // Track screen view and sign up started
  useEffect(() => {
    Analytics.trackScreen('sign_up');
    Analytics.track(AUTH_EVENTS.SIGN_UP_STARTED);
  }, []);

  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!name.trim()) {
      newErrors.name = 'Name is required';
    } else if (name.trim().length < 2) {
      newErrors.name = 'Name must be at least 2 characters';
    }

    if (!phone.trim()) {
      newErrors.phone = 'Phone number is required';
    } else if (!/^[1-9]\d{6,14}$/.test(phone.replace(/\s/g, ''))) {
      newErrors.phone = 'Enter a valid phone number';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleGetOtp = async () => {
    if (!validateForm()) return;

    setIsLoading(true);
    setErrors({});

    try {
      const fullPhone = `${country.dialCode}${phone.replace(/\s/g, '')}`;
      
      // Send OTP via Edge Function
      const result = await sendOtp(fullPhone, 'signup');

      if (!result.success) {
        Analytics.track(AUTH_EVENTS.SIGN_UP_FAILED, { 
          error_stage: 'otp_request',
          error_type: 'otp_failed',
        });
        setErrors({ form: result.message });
        return;
      }

      // Track OTP requested
      Analytics.track(AUTH_EVENTS.SIGN_UP_OTP_REQUESTED, {
        country_code: country.code,
      });

      // Navigate to OTP verification screen
      router.push({
        pathname: '/(auth)/verify-otp',
        params: {
          phone: fullPhone,
          name: name.trim(),
          purpose: 'signup',
        },
      });
    } catch (err) {
      console.error('[SignUp] Exception:', err);
      Analytics.track(AUTH_EVENTS.SIGN_UP_FAILED, { 
        error_stage: 'otp_request',
        error_type: 'exception',
      });
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
              Create Account
            </MotiText>
            <MotiText
              from={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ type: 'timing', duration: 500, delay: 300 }}
              style={[styles.subtitle, { color: secondaryTextColor }]}
            >
              Split expenses with friends & family
            </MotiText>
          </MotiView>

          {/* Step Indicator */}
          <MotiView
            from={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ type: 'timing', duration: 500, delay: 350 }}
            style={styles.stepIndicator}
          >
            <View style={[styles.stepDot, styles.stepDotActive]} />
            <View style={[styles.stepLine, { backgroundColor: colors.gray[300] }]} />
            <View style={[styles.stepDot, { backgroundColor: colors.gray[300] }]} />
            <View style={[styles.stepLine, { backgroundColor: colors.gray[300] }]} />
            <View style={[styles.stepDot, { backgroundColor: colors.gray[300] }]} />
          </MotiView>
          <Text style={[styles.stepText, { color: secondaryTextColor }]}>
            Step 1 of 3: Your Details
          </Text>

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

            {/* Name Input */}
            <Input
              label="Full Name"
              placeholder="John Doe"
              value={name}
              onChangeText={setName}
              error={errors.name}
              autoCapitalize="words"
              autoComplete="name"
              returnKeyType="next"
              onSubmitEditing={() => phoneRef.current?.focus()}
              leftIcon={
                <IconSymbol
                  name="person"
                  size={20}
                  color={isDark ? colors.gray[400] : colors.gray[500]}
                />
              }
            />

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
                    ref={phoneRef}
                    placeholder="98765 43210"
                    value={phone}
                    onChangeText={setPhone}
                    error={errors.phone}
                    keyboardType="phone-pad"
                    autoComplete="tel"
                    returnKeyType="done"
                    onSubmitEditing={handleGetOtp}
                    containerStyle={styles.phoneInput}
                  />
                </View>
              </View>
            </View>

            {/* Get OTP Button */}
            <Button
              title="Get OTP"
              onPress={handleGetOtp}
              loading={isLoading}
              style={styles.button}
            />

            {/* Sign In Link */}
            <View style={styles.footer}>
              <Text style={[styles.footerText, { color: secondaryTextColor }]}>
                Already have an account?{' '}
              </Text>
              <Pressable onPress={() => router.replace('/(auth)/sign-in')}>
                <Text style={[styles.link, { color: colors.primary[500] }]}>
                  Sign In
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
    paddingTop: 40,
    paddingBottom: 40,
  },
  header: {
    alignItems: 'center',
    marginBottom: 24,
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
  stepIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  stepDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
  },
  stepDotActive: {
    backgroundColor: colors.primary[500],
  },
  stepLine: {
    width: 40,
    height: 2,
    marginHorizontal: 4,
  },
  stepText: {
    textAlign: 'center',
    fontSize: 14,
    marginBottom: 24,
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

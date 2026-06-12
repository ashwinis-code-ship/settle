/**
 * Forgot Password Screen - Step 1
 * 
 * Enter phone number to receive OTP for password reset.
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
import { Ionicons } from '@expo/vector-icons';

import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { CountryPicker } from '@/components/ui/country-picker';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { colors } from '@/constants/colors';
import { DEFAULT_COUNTRY, type Country } from '@/constants/countries';
import { sendOtp } from '@/lib/otp-service';
import { Analytics } from '@/lib/analytics';
import { AUTH_EVENTS } from '@/lib/analytics-events';

export default function ForgotPasswordScreen() {
  const colorScheme = useColorScheme() ?? 'light';
  const isDark = colorScheme === 'dark';

  // Form state
  const [country, setCountry] = useState<Country>(DEFAULT_COUNTRY);
  const [phone, setPhone] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  // Refs
  const phoneRef = useRef<TextInput>(null);

  // Track screen view
  useEffect(() => {
    Analytics.trackScreen('forgot_password');
    Analytics.track(AUTH_EVENTS.FORGOT_PASSWORD_STARTED);
  }, []);

  const validateForm = (): boolean => {
    if (!phone.trim()) {
      setError('Phone number is required');
      return false;
    }
    if (!/^[1-9]\d{6,14}$/.test(phone.replace(/\s/g, ''))) {
      setError('Enter a valid phone number');
      return false;
    }
    return true;
  };

  const handleGetOtp = async () => {
    if (!validateForm()) return;

    setIsLoading(true);
    setError('');

    try {
      const fullPhone = `${country.dialCode}${phone.replace(/\s/g, '')}`;
      
      // Send OTP via Edge Function
      const result = await sendOtp(fullPhone, 'forgot_password');

      if (!result.success) {
        setError(result.message);
        return;
      }

      // Track OTP requested for password reset
      Analytics.track(AUTH_EVENTS.FORGOT_PASSWORD_OTP_REQUESTED, {
        country_code: country.code,
      });

      // Navigate to OTP verification screen
      router.push({
        pathname: '/(auth)/verify-otp',
        params: {
          phone: fullPhone,
          purpose: 'forgot_password',
        },
      });
    } catch (err) {
      console.error('[ForgotPassword] Exception:', err);
      setError('Something went wrong. Please try again later.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleBack = () => {
    router.back();
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
          {/* Back Button */}
          <MotiView
            from={{ opacity: 0, translateX: -20 }}
            animate={{ opacity: 1, translateX: 0 }}
            transition={{ type: 'timing', duration: 300 }}
          >
            <Pressable onPress={handleBack} style={styles.backButton}>
              <Ionicons name="arrow-back" size={24} color={textColor} />
            </Pressable>
          </MotiView>

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
              style={[styles.iconContainer, { backgroundColor: colors.warning + '20' }]}
            >
              <Ionicons name="key-outline" size={40} color={colors.warning} />
            </MotiView>
            <MotiText
              from={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ type: 'timing', duration: 500, delay: 300 }}
              style={[styles.title, { color: textColor }]}
            >
              Forgot Password?
            </MotiText>
            <MotiText
              from={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ type: 'timing', duration: 500, delay: 400 }}
              style={[styles.subtitle, { color: secondaryTextColor }]}
            >
              Enter your phone number to receive a verification code
            </MotiText>
          </MotiView>

          {/* Form */}
          <MotiView
            from={{ opacity: 0, translateY: 20 }}
            animate={{ opacity: 1, translateY: 0 }}
            transition={{ type: 'timing', duration: 500, delay: 500 }}
            style={styles.form}
          >
            {/* Error */}
            {error && (
              <MotiView
                from={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                style={styles.errorContainer}
              >
                <Ionicons name="alert-circle" size={20} color={colors.error} />
                <Text style={styles.errorText}>{error}</Text>
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
                    ref={phoneRef}
                    placeholder="98765 43210"
                    value={phone}
                    onChangeText={(text) => {
                      setPhone(text);
                      setError('');
                    }}
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
              title="Send Verification Code"
              onPress={handleGetOtp}
              loading={isLoading}
              style={styles.button}
            />

            {/* Back to Sign In */}
            <View style={styles.footer}>
              <Text style={[styles.footerText, { color: secondaryTextColor }]}>
                Remember your password?{' '}
              </Text>
              <Pressable onPress={handleBack}>
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
    paddingTop: 16,
    paddingBottom: 40,
  },
  backButton: {
    width: 44,
    height: 44,
    justifyContent: 'center',
  },
  header: {
    alignItems: 'center',
    marginTop: 40,
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
    paddingHorizontal: 20,
  },
  form: {
    flex: 1,
  },
  errorContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: `${colors.error}15`,
    padding: 12,
    borderRadius: 12,
    marginBottom: 16,
  },
  errorText: {
    color: colors.error,
    marginLeft: 8,
    flex: 1,
  },
  phoneInputContainer: {
    marginBottom: 24,
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
});

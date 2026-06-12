/**
 * Verify OTP Screen - Step 2
 * 
 * 6-digit OTP input with resend timer.
 */

import { useState, useEffect, useRef, useCallback } from 'react';
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
import { IconSymbol } from '@/components/ui/icon-symbol';

import { Button } from '@/components/ui/button';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { colors } from '@/constants/colors';
import { sendOtp, verifyOtp, getResendCooldown } from '@/lib/otp-service';
import type { OtpPurpose } from '@/lib/otp-service';
import { Analytics } from '@/lib/analytics';
import { AUTH_EVENTS } from '@/lib/analytics-events';

const OTP_LENGTH = 6;

export default function VerifyOtpScreen() {
  const colorScheme = useColorScheme() ?? 'light';
  const isDark = colorScheme === 'dark';
  const params = useLocalSearchParams<{ phone: string; name: string; purpose: string }>();
  
  const phone = params.phone || '';
  const name = params.name || '';
  const purpose = (params.purpose || 'signup') as OtpPurpose;

  // OTP state
  const [otp, setOtp] = useState<string[]>(Array(OTP_LENGTH).fill(''));
  const [isLoading, setIsLoading] = useState(false);
  const [isResending, setIsResending] = useState(false);
  const [error, setError] = useState('');
  const [resendTimer, setResendTimer] = useState(getResendCooldown());

  // Refs for OTP inputs
  const inputRefs = useRef<(TextInput | null)[]>([]);

  // Resend timer
  useEffect(() => {
    if (resendTimer > 0) {
      const timer = setTimeout(() => setResendTimer(resendTimer - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [resendTimer]);

  // Focus first input on mount and track screen view
  useEffect(() => {
    Analytics.trackScreen('verify_otp', { purpose });
    setTimeout(() => inputRefs.current[0]?.focus(), 500);
  }, []);

  const handleOtpChange = useCallback((value: string, index: number) => {
    // Only allow digits
    const digit = value.replace(/[^0-9]/g, '').slice(-1);
    
    const newOtp = [...otp];
    newOtp[index] = digit;
    setOtp(newOtp);
    setError('');

    // Auto-focus next input
    if (digit && index < OTP_LENGTH - 1) {
      inputRefs.current[index + 1]?.focus();
    }

    // Auto-submit when all digits entered
    if (digit && index === OTP_LENGTH - 1) {
      const fullOtp = newOtp.join('');
      if (fullOtp.length === OTP_LENGTH) {
        handleVerify(fullOtp);
      }
    }
  }, [otp]);

  const handleKeyPress = useCallback((e: { nativeEvent: { key: string } }, index: number) => {
    if (e.nativeEvent.key === 'Backspace' && !otp[index] && index > 0) {
      // Move focus to previous input on backspace if current is empty
      inputRefs.current[index - 1]?.focus();
      const newOtp = [...otp];
      newOtp[index - 1] = '';
      setOtp(newOtp);
    }
  }, [otp]);

  const handleVerify = async (otpCode?: string) => {
    const code = otpCode || otp.join('');
    
    if (code.length !== OTP_LENGTH) {
      setError('Please enter the complete OTP');
      return;
    }

    setIsLoading(true);
    setError('');

    try {
      const result = await verifyOtp(phone, code, purpose);

      if (!result.success) {
        Analytics.track(AUTH_EVENTS.SIGN_UP_FAILED, { 
          error_stage: 'otp_verification',
          error_type: 'invalid_otp',
          purpose,
        });
        setError(result.message);
        // Clear OTP on error
        setOtp(Array(OTP_LENGTH).fill(''));
        setTimeout(() => inputRefs.current[0]?.focus(), 100);
        return;
      }

      // Track successful OTP verification
      Analytics.track(AUTH_EVENTS.SIGN_UP_OTP_VERIFIED, { purpose });

      // Navigate based on purpose
      if (purpose === 'forgot_password') {
        router.push({
          pathname: '/(auth)/reset-password',
          params: { 
            phone,
            resetToken: result.resetToken || '',
          },
        });
      } else {
        router.push({
          pathname: '/(auth)/set-password',
          params: { 
            phone, 
            name, 
            signupToken: result.signupToken || '',
          },
        });
      }
    } catch (err) {
      console.error('[VerifyOtp] Exception:', err);
      setError('Something went wrong. Please try again later.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleResend = async () => {
    if (resendTimer > 0 || isResending) return;

    setIsResending(true);
    setError('');

    try {
      const result = await sendOtp(phone, purpose);

      if (!result.success) {
        setError(result.message);
        return;
      }

      // Reset timer
      setResendTimer(getResendCooldown());
      // Clear OTP
      setOtp(Array(OTP_LENGTH).fill(''));
      inputRefs.current[0]?.focus();
    } catch (err) {
      console.error('[VerifyOtp] Resend exception:', err);
      setError('Something went wrong. Please try again later.');
    } finally {
      setIsResending(false);
    }
  };

  const handleBack = () => {
    router.back();
  };

  const formatPhone = (p: string) => {
    // Format as +91 98765 43210
    if (p.startsWith('+')) {
      const countryCode = p.slice(0, 3);
      const number = p.slice(3);
      return `${countryCode} ${number.slice(0, 5)} ${number.slice(5)}`;
    }
    return p;
  };

  const textColor = isDark ? colors.text.dark.primary : colors.text.light.primary;
  const secondaryTextColor = isDark ? colors.text.dark.secondary : colors.text.light.secondary;
  const backgroundColor = isDark ? colors.background.dark : colors.background.light;
  const inputBg = isDark ? colors.gray[800] : colors.gray[100];
  const inputBorder = isDark ? colors.gray[700] : colors.gray[200];

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
              <IconSymbol name="chevron.left" size={24} color={textColor} />
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
              style={[styles.iconContainer, { backgroundColor: colors.primary[100] }]}
            >
              <IconSymbol name="bubble.left" size={40} color={colors.primary[500]} />
            </MotiView>
            <MotiText
              from={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ type: 'timing', duration: 500, delay: 300 }}
              style={[styles.title, { color: textColor }]}
            >
              Verify Your Phone
            </MotiText>
            <MotiText
              from={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ type: 'timing', duration: 500, delay: 400 }}
              style={[styles.subtitle, { color: secondaryTextColor }]}
            >
              Enter the 6-digit code sent to
            </MotiText>
            <MotiText
              from={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ type: 'timing', duration: 500, delay: 450 }}
              style={[styles.phone, { color: textColor }]}
            >
              {formatPhone(phone)}
            </MotiText>
          </MotiView>

          {/* Step Indicator */}
          <MotiView
            from={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ type: 'timing', duration: 500, delay: 350 }}
            style={styles.stepIndicator}
          >
            <View style={[styles.stepDot, styles.stepDotCompleted]} />
            <View style={[styles.stepLine, { backgroundColor: colors.primary[500] }]} />
            <View style={[styles.stepDot, styles.stepDotActive]} />
            <View style={[styles.stepLine, { backgroundColor: colors.gray[300] }]} />
            <View style={[styles.stepDot, { backgroundColor: colors.gray[300] }]} />
          </MotiView>
          <Text style={[styles.stepText, { color: secondaryTextColor }]}>
            Step 2 of 3: Verification
          </Text>

          {/* OTP Input */}
          <MotiView
            from={{ opacity: 0, translateY: 20 }}
            animate={{ opacity: 1, translateY: 0 }}
            transition={{ type: 'timing', duration: 500, delay: 500 }}
            style={styles.otpContainer}
          >
            <View style={styles.otpInputs}>
              {otp.map((digit, index) => (
                <MotiView
                  key={index}
                  from={{ opacity: 0, scale: 0.5 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ type: 'spring', damping: 15, delay: 500 + index * 50 }}
                >
                  <TextInput
                    ref={(ref) => (inputRefs.current[index] = ref)}
                    style={[
                      styles.otpInput,
                      {
                        backgroundColor: inputBg,
                        borderColor: digit ? colors.primary[500] : inputBorder,
                        color: textColor,
                      },
                    ]}
                    value={digit}
                    onChangeText={(value) => handleOtpChange(value, index)}
                    onKeyPress={(e) => handleKeyPress(e, index)}
                    keyboardType="number-pad"
                    maxLength={1}
                    selectTextOnFocus
                    caretHidden
                  />
                </MotiView>
              ))}
            </View>

            {/* Error */}
            {error && (
              <MotiView
                from={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                style={styles.errorContainer}
              >
                <IconSymbol name="exclamationmark.circle" size={18} color={colors.error} />
                <Text style={styles.errorText}>{error}</Text>
              </MotiView>
            )}

            {/* Verify Button */}
            <Button
              title="Verify OTP"
              onPress={() => handleVerify()}
              loading={isLoading}
              disabled={otp.join('').length !== OTP_LENGTH}
              style={styles.button}
            />

            {/* Resend */}
            <View style={styles.resendContainer}>
              <Text style={[styles.resendText, { color: secondaryTextColor }]}>
                Didn't receive the code?{' '}
              </Text>
              {resendTimer > 0 ? (
                <Text style={[styles.resendTimer, { color: colors.primary[500] }]}>
                  Resend in {resendTimer}s
                </Text>
              ) : (
                <Pressable onPress={handleResend} disabled={isResending}>
                  <Text style={[styles.resendLink, { color: colors.primary[500] }]}>
                    {isResending ? 'Sending...' : 'Resend OTP'}
                  </Text>
                </Pressable>
              )}
            </View>

            {/* Dev hint */}
            <MotiView
              from={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ type: 'timing', duration: 500, delay: 1000 }}
              style={[styles.devHint, { backgroundColor: colors.primary[50] }]}
            >
              <IconSymbol name="info.circle" size={18} color={colors.primary[600]} />
              <Text style={[styles.devHintText, { color: colors.primary[700] }]}>
                Development mode: Use OTP 123456
              </Text>
            </MotiView>
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
    marginTop: 20,
    marginBottom: 24,
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
  phone: {
    fontSize: 18,
    fontWeight: '600',
    marginTop: 4,
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
  stepDotCompleted: {
    backgroundColor: colors.success,
  },
  stepLine: {
    width: 40,
    height: 2,
    marginHorizontal: 4,
  },
  stepText: {
    textAlign: 'center',
    fontSize: 14,
    marginBottom: 32,
  },
  otpContainer: {
    alignItems: 'center',
  },
  otpInputs: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 10,
    marginBottom: 24,
  },
  otpInput: {
    width: 48,
    height: 56,
    borderRadius: 12,
    borderWidth: 2,
    fontSize: 24,
    fontWeight: '700',
    textAlign: 'center',
  },
  errorContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  errorText: {
    color: colors.error,
    marginLeft: 6,
    fontSize: 14,
  },
  button: {
    width: '100%',
    marginBottom: 24,
  },
  resendContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  resendText: {
    fontSize: 14,
  },
  resendTimer: {
    fontSize: 14,
    fontWeight: '600',
  },
  resendLink: {
    fontSize: 14,
    fontWeight: '600',
  },
  devHint: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 12,
    marginTop: 32,
  },
  devHintText: {
    fontSize: 14,
    marginLeft: 8,
  },
});

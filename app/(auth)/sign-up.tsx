/**
 * Sign Up Screen
 * 
 * Beautiful registration form with phone, password, and name.
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
import { Ionicons } from '@expo/vector-icons';

import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/contexts/auth-context';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { colors } from '@/constants/colors';
import { supabase } from '@/lib/supabase';

export default function SignUpScreen() {
  const colorScheme = useColorScheme() ?? 'light';
  const isDark = colorScheme === 'dark';
  const { signUp } = useAuth();

  // Form state
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  // Refs for focus management
  const phoneRef = useRef<TextInput>(null);
  const passwordRef = useRef<TextInput>(null);
  const confirmPasswordRef = useRef<TextInput>(null);

  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!name.trim()) {
      newErrors.name = 'Name is required';
    }

    if (!phone.trim()) {
      newErrors.phone = 'Phone number is required';
    } else if (!/^\+?[1-9]\d{9,14}$/.test(phone.replace(/\s/g, ''))) {
      newErrors.phone = 'Enter a valid phone number (e.g., +919876543210)';
    }

    if (!password) {
      newErrors.password = 'Password is required';
    } else if (password.length < 6) {
      newErrors.password = 'Password must be at least 6 characters';
    }

    if (password !== confirmPassword) {
      newErrors.confirmPassword = 'Passwords do not match';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSignUp = async () => {
    if (!validateForm()) return;

    setIsLoading(true);
    setErrors({});

    try {
      // Sign up with Supabase auth
      const { error } = await signUp(phone, password);

      if (error) {
        setErrors({ form: error.message });
        return;
      }

      // Create user profile
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        await supabase.from('users').insert({
          id: user.id,
          phone: phone,
          name: name.trim(),
        });
      }

      // Navigate to main app
      router.replace('/(tabs)');
    } catch (err) {
      setErrors({
        form: err instanceof Error ? err.message : 'Something went wrong',
      });
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
              <Ionicons name="wallet-outline" size={40} color={colors.white} />
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
              <Ionicons name="alert-circle" size={20} color={colors.error} />
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
              <Ionicons
                name="person-outline"
                size={20}
                color={isDark ? colors.gray[400] : colors.gray[500]}
              />
            }
          />

          {/* Phone Input */}
          <Input
            ref={phoneRef}
            label="Phone Number"
            placeholder="+91 98765 43210"
            value={phone}
            onChangeText={setPhone}
            error={errors.phone}
            keyboardType="phone-pad"
            autoComplete="tel"
            returnKeyType="next"
            onSubmitEditing={() => passwordRef.current?.focus()}
            leftIcon={
              <Ionicons
                name="call-outline"
                size={20}
                color={isDark ? colors.gray[400] : colors.gray[500]}
              />
            }
          />

          {/* Password Input */}
          <Input
            ref={passwordRef}
            label="Password"
            placeholder="••••••••"
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

          {/* Confirm Password Input */}
          <Input
            ref={confirmPasswordRef}
            label="Confirm Password"
            placeholder="••••••••"
            value={confirmPassword}
            onChangeText={setConfirmPassword}
            error={errors.confirmPassword}
            secureTextEntry={!showPassword}
            autoComplete="new-password"
            returnKeyType="done"
            onSubmitEditing={handleSignUp}
            leftIcon={
              <Ionicons
                name="lock-closed-outline"
                size={20}
                color={isDark ? colors.gray[400] : colors.gray[500]}
              />
            }
          />

          {/* Sign Up Button */}
          <Button
            title="Create Account"
            onPress={handleSignUp}
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
    paddingTop: 60,
    paddingBottom: 40,
  },
  header: {
    alignItems: 'center',
    marginBottom: 40,
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

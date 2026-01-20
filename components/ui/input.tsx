/**
 * Styled Text Input Component
 */

import { forwardRef, useState } from 'react';
import {
  StyleSheet,
  TextInput,
  View,
  Text,
  Pressable,
  type TextInputProps,
  type ViewStyle,
} from 'react-native';
import { MotiView } from 'moti';
import { colors } from '@/constants/colors';
import { useColorScheme } from '@/hooks/use-color-scheme';

interface InputProps extends TextInputProps {
  label?: string;
  error?: string;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
  containerStyle?: ViewStyle;
}

export const Input = forwardRef<TextInput, InputProps>(
  ({ label, error, leftIcon, rightIcon, containerStyle, style, ...props }, ref) => {
    const colorScheme = useColorScheme() ?? 'light';
    const isDark = colorScheme === 'dark';
    const [isFocused, setIsFocused] = useState(false);

    const borderColor = error
      ? colors.error
      : isFocused
      ? colors.primary[500]
      : isDark
      ? colors.gray[700]
      : colors.gray[300];

    const backgroundColor = isDark ? colors.gray[800] : colors.white;
    const textColor = isDark ? colors.text.dark.primary : colors.text.light.primary;
    const placeholderColor = isDark ? colors.gray[500] : colors.gray[400];
    const labelColor = isDark ? colors.text.dark.secondary : colors.text.light.secondary;

    return (
      <View style={[styles.container, containerStyle]}>
        {label && (
          <Text style={[styles.label, { color: labelColor }]}>{label}</Text>
        )}
        <MotiView
          animate={{
            borderColor,
            scale: isFocused ? 1.01 : 1,
          }}
          transition={{ type: 'timing', duration: 150 }}
          style={[
            styles.inputContainer,
            { backgroundColor, borderColor },
          ]}
        >
          {leftIcon && <View style={styles.iconLeft}>{leftIcon}</View>}
          <TextInput
            ref={ref}
            style={[
              styles.input,
              { color: textColor },
              leftIcon && styles.inputWithLeftIcon,
              rightIcon && styles.inputWithRightIcon,
              style,
            ]}
            placeholderTextColor={placeholderColor}
            onFocus={() => setIsFocused(true)}
            onBlur={() => setIsFocused(false)}
            {...props}
          />
          {rightIcon && <View style={styles.iconRight}>{rightIcon}</View>}
        </MotiView>
        {error && (
          <MotiView
            from={{ opacity: 0, translateY: -5 }}
            animate={{ opacity: 1, translateY: 0 }}
            transition={{ type: 'timing', duration: 200 }}
          >
            <Text style={styles.error}>{error}</Text>
          </MotiView>
        )}
      </View>
    );
  }
);

Input.displayName = 'Input';

const styles = StyleSheet.create({
  container: {
    marginBottom: 16,
  },
  label: {
    fontSize: 14,
    fontWeight: '500',
    marginBottom: 6,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1.5,
    borderRadius: 12,
    overflow: 'hidden',
  },
  input: {
    flex: 1,
    fontSize: 16,
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  inputWithLeftIcon: {
    paddingLeft: 8,
  },
  inputWithRightIcon: {
    paddingRight: 8,
  },
  iconLeft: {
    paddingLeft: 14,
  },
  iconRight: {
    paddingRight: 14,
  },
  error: {
    fontSize: 12,
    color: colors.error,
    marginTop: 4,
    marginLeft: 4,
  },
});

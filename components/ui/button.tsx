/**
 * Styled Button Component
 */

import { forwardRef } from 'react';
import {
  StyleSheet,
  Text,
  Pressable,
  ActivityIndicator,
  type PressableProps,
  type ViewStyle,
  type TextStyle,
} from 'react-native';
import { MotiView } from 'moti';
import { colors } from '@/constants/colors';
import { useColorScheme } from '@/hooks/use-color-scheme';

type ButtonVariant = 'primary' | 'secondary' | 'outline' | 'ghost';
type ButtonSize = 'sm' | 'md' | 'lg';

interface ButtonProps extends Omit<PressableProps, 'style'> {
  title: string;
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
  style?: ViewStyle;
  textStyle?: TextStyle;
}

export const Button = forwardRef<React.ElementRef<typeof Pressable>, ButtonProps>(
  (
    {
      title,
      variant = 'primary',
      size = 'md',
      loading = false,
      leftIcon,
      rightIcon,
      disabled,
      style,
      textStyle,
      ...props
    },
    ref
  ) => {
    const colorScheme = useColorScheme() ?? 'light';
    const isDark = colorScheme === 'dark';

    const isDisabled = disabled || loading;

    const getBackgroundColor = () => {
      if (isDisabled) return colors.gray[400];
      switch (variant) {
        case 'primary':
          return colors.primary[500];
        case 'secondary':
          return isDark ? colors.gray[700] : colors.gray[100];
        case 'outline':
        case 'ghost':
          return 'transparent';
        default:
          return colors.primary[500];
      }
    };

    const getTextColor = () => {
      if (isDisabled) return colors.white;
      switch (variant) {
        case 'primary':
          return colors.white;
        case 'secondary':
          return isDark ? colors.white : colors.gray[800];
        case 'outline':
        case 'ghost':
          return colors.primary[500];
        default:
          return colors.white;
      }
    };

    const getBorderColor = () => {
      if (variant === 'outline') {
        return isDisabled ? colors.gray[400] : colors.primary[500];
      }
      return 'transparent';
    };

    const sizeStyles = {
      sm: { paddingVertical: 8, paddingHorizontal: 16, fontSize: 14 },
      md: { paddingVertical: 14, paddingHorizontal: 24, fontSize: 16 },
      lg: { paddingVertical: 18, paddingHorizontal: 32, fontSize: 18 },
    };

    return (
      <Pressable ref={ref} disabled={isDisabled} {...props}>
        {({ pressed }) => (
          <MotiView
            animate={{
              scale: pressed ? 0.97 : 1,
              opacity: pressed ? 0.9 : 1,
            }}
            transition={{ type: 'timing', duration: 100 }}
            style={[
              styles.button,
              {
                backgroundColor: getBackgroundColor(),
                borderColor: getBorderColor(),
                paddingVertical: sizeStyles[size].paddingVertical,
                paddingHorizontal: sizeStyles[size].paddingHorizontal,
              },
              variant === 'outline' && styles.outline,
              style,
            ]}
          >
            {loading ? (
              <ActivityIndicator color={getTextColor()} size="small" />
            ) : (
              <>
                {leftIcon}
                <Text
                  style={[
                    styles.text,
                    {
                      color: getTextColor(),
                      fontSize: sizeStyles[size].fontSize,
                    },
                    leftIcon && styles.textWithLeftIcon,
                    rightIcon && styles.textWithRightIcon,
                    textStyle,
                  ]}
                >
                  {title}
                </Text>
                {rightIcon}
              </>
            )}
          </MotiView>
        )}
      </Pressable>
    );
  }
);

Button.displayName = 'Button';

const styles = StyleSheet.create({
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 12,
  },
  outline: {
    borderWidth: 1.5,
  },
  text: {
    fontWeight: '600',
    textAlign: 'center',
  },
  textWithLeftIcon: {
    marginLeft: 8,
  },
  textWithRightIcon: {
    marginRight: 8,
  },
});

/**
 * EmptyState Component
 * 
 * Reusable component for displaying empty states with illustrations.
 * Features animated entry and optional action button.
 */

import { Ionicons } from '@expo/vector-icons';
import { MotiView } from 'moti';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { colors } from '@/constants/colors';
import { useColorScheme } from '@/hooks/use-color-scheme';

interface EmptyStateProps {
  /** Large emoji or icon name */
  illustration: string;
  /** Whether illustration is an emoji (true) or Ionicons name (false) */
  isEmoji?: boolean;
  /** Main title */
  title: string;
  /** Description text */
  description: string;
  /** Optional action button */
  actionLabel?: string;
  /** Action button callback */
  onAction?: () => void;
  /** Icon color (for Ionicons). Default: primary */
  iconColor?: string;
  /** Background color for icon container */
  iconBgColor?: string;
  /** Compact mode for smaller spaces */
  compact?: boolean;
}

export function EmptyState({
  illustration,
  isEmoji = false,
  title,
  description,
  actionLabel,
  onAction,
  iconColor = colors.primary[500],
  iconBgColor = colors.primary[100],
  compact = false,
}: EmptyStateProps) {
  const colorScheme = useColorScheme() ?? 'light';
  const isDark = colorScheme === 'dark';
  
  const textColor = isDark ? colors.text.dark.primary : colors.text.light.primary;
  const secondaryTextColor = isDark ? colors.text.dark.secondary : colors.text.light.secondary;

  return (
    <MotiView
      from={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ type: 'spring', damping: 15, stiffness: 100 }}
      style={[styles.container, compact && styles.containerCompact]}
    >
      {/* Illustration */}
      <View
        style={[
          styles.illustrationContainer,
          compact && styles.illustrationContainerCompact,
          { backgroundColor: isEmoji ? 'transparent' : iconBgColor },
        ]}
      >
        {isEmoji ? (
          <Text style={[styles.emoji, compact && styles.emojiCompact]}>{illustration}</Text>
        ) : (
          <Ionicons
            name={illustration as any}
            size={compact ? 40 : 56}
            color={iconColor}
          />
        )}
      </View>

      {/* Title */}
      <Text style={[styles.title, compact && styles.titleCompact, { color: textColor }]}>
        {title}
      </Text>

      {/* Description */}
      <Text style={[styles.description, compact && styles.descriptionCompact, { color: secondaryTextColor }]}>
        {description}
      </Text>

      {/* Action Button */}
      {actionLabel && onAction && (
        <Pressable
          onPress={onAction}
          style={({ pressed }) => [
            styles.actionButton,
            { backgroundColor: colors.primary[500], opacity: pressed ? 0.8 : 1 },
          ]}
        >
          <Ionicons name="add" size={18} color={colors.white} />
          <Text style={styles.actionButtonText}>{actionLabel}</Text>
        </Pressable>
      )}
    </MotiView>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    paddingHorizontal: 40,
    paddingVertical: 40,
  },
  containerCompact: {
    paddingHorizontal: 24,
    paddingVertical: 24,
  },
  illustrationContainer: {
    width: 120,
    height: 120,
    borderRadius: 60,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 24,
  },
  illustrationContainerCompact: {
    width: 80,
    height: 80,
    borderRadius: 40,
    marginBottom: 16,
  },
  emoji: {
    fontSize: 64,
  },
  emojiCompact: {
    fontSize: 44,
  },
  title: {
    fontSize: 22,
    fontWeight: '700',
    marginBottom: 8,
    textAlign: 'center',
  },
  titleCompact: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 4,
  },
  description: {
    fontSize: 15,
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 24,
  },
  descriptionCompact: {
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 16,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 12,
  },
  actionButtonText: {
    color: colors.white,
    fontSize: 15,
    fontWeight: '600',
  },
});

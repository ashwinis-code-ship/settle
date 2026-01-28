/**
 * EmptyState Component
 * 
 * Reusable component for displaying empty states with icons.
 * Features animated entry and optional action button.
 */

import { Ionicons } from '@expo/vector-icons';
import { MotiView } from 'moti';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { colors } from '@/constants/colors';
import { useColorScheme } from '@/hooks/use-color-scheme';

interface EmptyStateProps {
  /** Ionicons icon name */
  icon: keyof typeof Ionicons.glyphMap;
  /** Main title */
  title: string;
  /** Description text */
  description: string;
  /** Optional action button */
  actionLabel?: string;
  /** Action button callback */
  onAction?: () => void;
  /** Compact mode for smaller spaces */
  compact?: boolean;
}

export function EmptyState({
  icon,
  title,
  description,
  actionLabel,
  onAction,
  compact = false,
}: EmptyStateProps) {
  const colorScheme = useColorScheme() ?? 'light';
  const isDark = colorScheme === 'dark';
  
  const textColor = isDark ? colors.text.dark.primary : colors.text.light.primary;
  const secondaryTextColor = isDark ? colors.text.dark.secondary : colors.text.light.secondary;
  const iconBgColor = isDark ? colors.gray[700] : colors.primary[50];

  return (
    <MotiView
      from={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ type: 'spring', damping: 15, stiffness: 100 }}
      style={[styles.container, compact && styles.containerCompact]}
    >
      {/* Icon */}
      <View
        style={[
          styles.iconContainer,
          compact && styles.iconContainerCompact,
          { backgroundColor: iconBgColor },
        ]}
      >
        <Ionicons
          name={icon}
          size={compact ? 36 : 48}
          color={colors.primary[500]}
        />
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
  iconContainer: {
    width: 100,
    height: 100,
    borderRadius: 50,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 24,
  },
  iconContainerCompact: {
    width: 72,
    height: 72,
    borderRadius: 36,
    marginBottom: 16,
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

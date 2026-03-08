import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import type { ViewStyle } from 'react-native';

import { colors } from '@/constants/colors';

// ─── Types ────────────────────────────────────────────────────────────────────

export type UserLike = { name: string; avatar_url: string | null };
export type GroupLike = { name: string; image_url: string | null };

type AvatarBase = {
  size?: number;
  /** 'edit' reveals a camera badge and wraps in a Pressable when onEditPress is provided */
  mode?: 'default' | 'edit';
  onEditPress?: () => void;
  isUploading?: boolean;
  disabled?: boolean;
  /** Adds a 2-px border — used by BalanceSpectrumBar for cluster stacking */
  borderColor?: string;
  /** Layout-only styles applied to the outermost element (e.g. marginLeft, zIndex) */
  style?: ViewStyle;
};

export type AvatarProps = AvatarBase &
  (
    | { user: UserLike; group?: never; groupImageUri?: never }
    | { group: GroupLike; user?: never; groupImageUri?: never }
    | { groupImageUri: string | null | undefined; user?: never; group?: never }
  );

// ─── Helpers ──────────────────────────────────────────────────────────────────

const getInitials = (name: string) =>
  name
    .split(' ')
    .map(n => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);

const getAvatarColor = (name: string) =>
  colors.chart[name.split('').reduce((s, c) => s + c.charCodeAt(0), 0) % colors.chart.length];

// ─── Component ────────────────────────────────────────────────────────────────

/**
 * Unified avatar component for user profile photos and group photos.
 *
 * Exactly one variant prop is required:
 *   user         → circle, initials fallback
 *   group        → squircle, people-icon fallback
 *   groupImageUri → squircle, people-icon fallback (for forms before a group exists)
 */
export function Avatar(props: AvatarProps) {
  const {
    size = 44,
    mode = 'default',
    onEditPress,
    isUploading = false,
    disabled = false,
    borderColor,
    style,
  } = props;

  // ── Derive shape + content from variant ──────────────────────────────────
  let imageUrl: string | null | undefined;
  let initialsText: string | null = null;
  let isCircle = false;
  let bgColor = colors.primary[500];

  if ('user' in props && props.user) {
    imageUrl = props.user.avatar_url;
    initialsText = getInitials(props.user.name);
    isCircle = true;
    bgColor = getAvatarColor(props.user.name);
  } else if ('group' in props && props.group) {
    imageUrl = props.group.image_url;
    isCircle = false;
    bgColor = getAvatarColor(props.group.name);
  } else {
    imageUrl = (props as { groupImageUri?: string | null }).groupImageUri;
    isCircle = false;
    bgColor = colors.primary[500];
  }

  const borderRadius = isCircle ? size / 2 : Math.round(size * 0.3);
  const fontSize = Math.max(10, Math.round(size * 0.35));

  // ── Camera badge ──────────────────────────────────────────────────────────
  const badgeSize = Math.max(20, Math.round(size * 0.3));
  const badgeOffset = -Math.round(badgeSize * 0.15);

  // ── Inner avatar body (overflow:hidden for image clipping) ────────────────
  const avatarBody = (
    <View
      style={[
        styles.body,
        {
          width: size,
          height: size,
          borderRadius,
          backgroundColor: bgColor,
          borderWidth: borderColor ? 2 : 0,
          borderColor: borderColor ?? 'transparent',
        },
      ]}
    >
      {isUploading ? (
        <ActivityIndicator size={size > 60 ? 'large' : 'small'} color={colors.white} />
      ) : imageUrl ? (
        <Image
          source={{ uri: imageUrl }}
          style={{ width: size, height: size, borderRadius }}
          contentFit="cover"
          transition={200}
        />
      ) : initialsText ? (
        <Text style={[styles.initials, { fontSize }]}>{initialsText}</Text>
      ) : (
        <Ionicons name="people" size={Math.round(size * 0.5)} color={colors.white} />
      )}
    </View>
  );

  // ── Wrapper: carries layout style + badge (outside overflow:hidden) ────────
  const wrapperStyle: ViewStyle = { width: size, height: size };

  const inner = (
    <View style={[wrapperStyle, style]}>
      {avatarBody}
      {mode === 'edit' && !isUploading && (
        <View
          style={[
            styles.badge,
            {
              width: badgeSize,
              height: badgeSize,
              borderRadius: badgeSize / 2,
              bottom: badgeOffset,
              right: badgeOffset,
            },
          ]}
        >
          <Ionicons name="camera" size={Math.round(badgeSize * 0.5)} color={colors.white} />
        </View>
      )}
    </View>
  );

  if (mode === 'edit' && onEditPress) {
    return (
      <Pressable
        onPress={onEditPress}
        disabled={disabled || isUploading}
        style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1 })}
      >
        {inner}
      </Pressable>
    );
  }

  return inner;
}

const styles = StyleSheet.create({
  body: {
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  initials: {
    color: colors.white,
    fontWeight: '700',
  },
  badge: {
    position: 'absolute',
    backgroundColor: colors.primary[500],
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: colors.white,
  },
});

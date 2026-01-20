/**
 * Profile Screen
 * 
 * View and edit user profile information.
 */

import { useState, useRef, useEffect } from 'react';
import {
  StyleSheet,
  View,
  Text,
  TextInput,
  ScrollView,
  Pressable,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MotiView } from 'moti';
import { Ionicons } from '@expo/vector-icons';

import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { colors } from '@/constants/colors';
import { useAuth } from '@/contexts/auth-context';
import { useUser } from '@/hooks/use-user';
import { useColorScheme } from '@/hooks/use-color-scheme';

export default function ProfileScreen() {
  const colorScheme = useColorScheme() ?? 'light';
  const isDark = colorScheme === 'dark';
  const { user: authUser, signOut } = useAuth();
  const { user, updateUser, isLoading: isUserLoading, refresh } = useUser();

  // Edit mode state
  const [isEditing, setIsEditing] = useState(false);
  const [name, setName] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState('');

  const nameInputRef = useRef<TextInput>(null);

  // Initialize name from user data
  useEffect(() => {
    const userName = user?.name || authUser?.user_metadata?.name || '';
    setName(userName);
  }, [user, authUser]);

  const handleEdit = () => {
    setIsEditing(true);
    setError('');
    setTimeout(() => nameInputRef.current?.focus(), 100);
  };

  const handleCancel = () => {
    setIsEditing(false);
    setError('');
    // Reset name to original
    const userName = user?.name || authUser?.user_metadata?.name || '';
    setName(userName);
  };

  const handleSave = async () => {
    const trimmedName = name.trim();
    
    if (!trimmedName) {
      setError('Name is required');
      return;
    }

    if (trimmedName.length < 2) {
      setError('Name must be at least 2 characters');
      return;
    }

    setIsSaving(true);
    setError('');

    try {
      const success = await updateUser({ name: trimmedName });
      
      if (success) {
        setIsEditing(false);
        await refresh();
      } else {
        setError('Failed to update profile. Please try again.');
      }
    } catch (err) {
      console.error('[Profile] Save error:', err);
      setError('Something went wrong. Please try again later.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleLogout = () => {
    Alert.alert(
      'Sign Out',
      'Are you sure you want to sign out?',
      [
        { text: 'Cancel', style: 'cancel' },
        { 
          text: 'Sign Out', 
          style: 'destructive',
          onPress: async () => {
            await signOut();
          },
        },
      ]
    );
  };

  // Get user info
  const userName = user?.name || authUser?.user_metadata?.name || 'User';
  const userPhone = user?.phone || authUser?.user_metadata?.phone || '';
  const userInitials = userName
    .split(' ')
    .map((n: string) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);

  // Format phone for display
  const formatPhone = (phone: string) => {
    if (phone.startsWith('+')) {
      const countryCode = phone.slice(0, 3);
      const number = phone.slice(3);
      return `${countryCode} ${number.slice(0, 5)} ${number.slice(5)}`;
    }
    return phone;
  };

  // Theme colors
  const textColor = isDark ? colors.text.dark.primary : colors.text.light.primary;
  const secondaryTextColor = isDark ? colors.text.dark.secondary : colors.text.light.secondary;
  const backgroundColor = isDark ? colors.background.dark : colors.background.light;
  const cardBg = isDark ? colors.gray[800] : colors.white;
  const inputBg = isDark ? colors.gray[700] : colors.gray[50];

  return (
    <SafeAreaView style={[styles.container, { backgroundColor }]} edges={['top']}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {/* Header */}
          <MotiView
            from={{ opacity: 0, translateY: -20 }}
            animate={{ opacity: 1, translateY: 0 }}
            transition={{ type: 'timing', duration: 500 }}
            style={styles.header}
          >
            <Text style={[styles.title, { color: textColor }]}>Profile</Text>
          </MotiView>

          {/* Avatar Section */}
          <MotiView
            from={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ type: 'spring', damping: 15, delay: 100 }}
            style={styles.avatarSection}
          >
            <View style={[styles.avatar, { backgroundColor: colors.primary[500] }]}>
              <Text style={styles.avatarText}>{userInitials}</Text>
            </View>
            {!isEditing && (
              <Pressable onPress={handleEdit} style={styles.editAvatarButton}>
                <Ionicons name="pencil" size={14} color={colors.white} />
              </Pressable>
            )}
          </MotiView>

          {/* Profile Card */}
          <MotiView
            from={{ opacity: 0, translateY: 20 }}
            animate={{ opacity: 1, translateY: 0 }}
            transition={{ type: 'timing', duration: 500, delay: 200 }}
            style={[styles.card, { backgroundColor: cardBg }]}
          >
            {/* Error Message */}
            {error && (
              <MotiView
                from={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                style={styles.errorContainer}
              >
                <Ionicons name="alert-circle" size={18} color={colors.error} />
                <Text style={styles.errorText}>{error}</Text>
              </MotiView>
            )}

            {/* Name Field */}
            <View style={styles.field}>
              <Text style={[styles.fieldLabel, { color: secondaryTextColor }]}>
                Full Name
              </Text>
              {isEditing ? (
                <Input
                  ref={nameInputRef}
                  value={name}
                  onChangeText={setName}
                  placeholder="Enter your name"
                  autoCapitalize="words"
                  returnKeyType="done"
                  onSubmitEditing={handleSave}
                  leftIcon={
                    <Ionicons
                      name="person-outline"
                      size={20}
                      color={isDark ? colors.gray[400] : colors.gray[500]}
                    />
                  }
                />
              ) : (
                <View style={[styles.fieldValue, { backgroundColor: inputBg }]}>
                  <Ionicons
                    name="person-outline"
                    size={20}
                    color={isDark ? colors.gray[400] : colors.gray[500]}
                  />
                  <Text style={[styles.fieldValueText, { color: textColor }]}>
                    {userName}
                  </Text>
                </View>
              )}
            </View>

            {/* Phone Field (Read-only) */}
            <View style={styles.field}>
              <Text style={[styles.fieldLabel, { color: secondaryTextColor }]}>
                Phone Number
              </Text>
              <View style={[styles.fieldValue, { backgroundColor: inputBg }]}>
                <Ionicons
                  name="call-outline"
                  size={20}
                  color={isDark ? colors.gray[400] : colors.gray[500]}
                />
                <Text style={[styles.fieldValueText, { color: textColor }]}>
                  {formatPhone(userPhone)}
                </Text>
                <View style={styles.verifiedBadge}>
                  <Ionicons name="checkmark-circle" size={16} color={colors.success} />
                  <Text style={styles.verifiedText}>Verified</Text>
                </View>
              </View>
            </View>

            {/* Edit/Save Buttons */}
            {isEditing ? (
              <View style={styles.editButtons}>
                <Button
                  title="Cancel"
                  variant="outline"
                  onPress={handleCancel}
                  style={styles.cancelButton}
                />
                <Button
                  title="Save Changes"
                  onPress={handleSave}
                  loading={isSaving}
                  style={styles.saveButton}
                />
              </View>
            ) : (
              <Pressable
                onPress={handleEdit}
                style={({ pressed }) => [
                  styles.editProfileButton,
                  { 
                    backgroundColor: colors.primary[500],
                    opacity: pressed ? 0.8 : 1,
                  },
                ]}
              >
                <Ionicons name="pencil-outline" size={18} color={colors.white} />
                <Text style={styles.editProfileText}>Edit Profile</Text>
              </Pressable>
            )}
          </MotiView>

          {/* Settings Section */}
          <MotiView
            from={{ opacity: 0, translateY: 20 }}
            animate={{ opacity: 1, translateY: 0 }}
            transition={{ type: 'timing', duration: 500, delay: 300 }}
            style={[styles.card, { backgroundColor: cardBg }]}
          >
            <Text style={[styles.sectionTitle, { color: textColor }]}>
              Settings
            </Text>

            {/* Theme Toggle Placeholder */}
            <Pressable style={styles.settingItem}>
              <View style={styles.settingLeft}>
                <View style={[styles.settingIcon, { backgroundColor: colors.primary[100] }]}>
                  <Ionicons name="moon-outline" size={20} color={colors.primary[500]} />
                </View>
                <Text style={[styles.settingLabel, { color: textColor }]}>
                  Dark Mode
                </Text>
              </View>
              <Text style={[styles.settingValue, { color: secondaryTextColor }]}>
                {isDark ? 'On' : 'Off'}
              </Text>
            </Pressable>

            {/* Notifications Placeholder */}
            <Pressable style={styles.settingItem}>
              <View style={styles.settingLeft}>
                <View style={[styles.settingIcon, { backgroundColor: colors.warning + '20' }]}>
                  <Ionicons name="notifications-outline" size={20} color={colors.warning} />
                </View>
                <Text style={[styles.settingLabel, { color: textColor }]}>
                  Notifications
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={20} color={secondaryTextColor} />
            </Pressable>

            {/* Privacy */}
            <Pressable style={[styles.settingItem, styles.settingItemLast]}>
              <View style={styles.settingLeft}>
                <View style={[styles.settingIcon, { backgroundColor: colors.success + '20' }]}>
                  <Ionicons name="shield-checkmark-outline" size={20} color={colors.success} />
                </View>
                <Text style={[styles.settingLabel, { color: textColor }]}>
                  Privacy
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={20} color={secondaryTextColor} />
            </Pressable>
          </MotiView>

          {/* Sign Out Button */}
          <MotiView
            from={{ opacity: 0, translateY: 20 }}
            animate={{ opacity: 1, translateY: 0 }}
            transition={{ type: 'timing', duration: 500, delay: 400 }}
            style={styles.signOutContainer}
          >
            <Pressable
              onPress={handleLogout}
              style={({ pressed }) => [
                styles.signOutButton,
                { 
                  backgroundColor: isDark ? colors.gray[800] : colors.gray[100],
                  opacity: pressed ? 0.7 : 1,
                },
              ]}
            >
              <Ionicons name="log-out-outline" size={20} color={colors.error} />
              <Text style={styles.signOutText}>Sign Out</Text>
            </Pressable>
          </MotiView>

          {/* App Version */}
          <MotiView
            from={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ type: 'timing', duration: 500, delay: 500 }}
            style={styles.versionContainer}
          >
            <Text style={[styles.versionText, { color: secondaryTextColor }]}>
              Settle v1.0.0
            </Text>
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
    paddingHorizontal: 24,
    paddingTop: 20,
    paddingBottom: 40,
  },
  header: {
    marginBottom: 24,
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
  },
  avatarSection: {
    alignItems: 'center',
    marginBottom: 24,
    position: 'relative',
  },
  avatar: {
    width: 100,
    height: 100,
    borderRadius: 50,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    fontSize: 36,
    fontWeight: '700',
    color: colors.white,
  },
  editAvatarButton: {
    position: 'absolute',
    bottom: 0,
    right: '50%',
    marginRight: -50,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.primary[600],
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 3,
    borderColor: colors.white,
  },
  card: {
    borderRadius: 20,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 4,
    marginBottom: 16,
  },
  errorContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.error + '15',
    padding: 12,
    borderRadius: 12,
    marginBottom: 16,
    gap: 8,
  },
  errorText: {
    color: colors.error,
    fontSize: 14,
    flex: 1,
  },
  field: {
    marginBottom: 16,
  },
  fieldLabel: {
    fontSize: 13,
    fontWeight: '500',
    marginBottom: 8,
    marginLeft: 4,
  },
  fieldValue: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderRadius: 12,
    gap: 12,
  },
  fieldValueText: {
    fontSize: 16,
    flex: 1,
  },
  verifiedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  verifiedText: {
    fontSize: 12,
    color: colors.success,
    fontWeight: '500',
  },
  editButtons: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 8,
  },
  cancelButton: {
    flex: 1,
  },
  saveButton: {
    flex: 1,
  },
  editProfileButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    borderRadius: 12,
    gap: 8,
    marginTop: 8,
  },
  editProfileText: {
    color: colors.white,
    fontSize: 16,
    fontWeight: '600',
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 16,
  },
  settingItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.gray[200],
  },
  settingItemLast: {
    borderBottomWidth: 0,
  },
  settingLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  settingIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  settingLabel: {
    fontSize: 16,
  },
  settingValue: {
    fontSize: 14,
  },
  signOutContainer: {
    marginTop: 8,
  },
  signOutButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    borderRadius: 12,
    gap: 8,
  },
  signOutText: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.error,
  },
  versionContainer: {
    alignItems: 'center',
    marginTop: 24,
  },
  versionText: {
    fontSize: 13,
  },
});

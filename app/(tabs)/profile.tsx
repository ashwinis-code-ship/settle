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
  ActionSheetIOS,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MotiView } from 'moti';
import { Ionicons } from '@expo/vector-icons';

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
  const [isEditingName, setIsEditingName] = useState(false);
  const [name, setName] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState('');

  const nameInputRef = useRef<TextInput>(null);

  // Initialize name from user data
  useEffect(() => {
    const userName = user?.name || authUser?.user_metadata?.name || '';
    setName(userName);
  }, [user, authUser]);

  const handleEditName = () => {
    setIsEditingName(true);
    setError('');
    setTimeout(() => nameInputRef.current?.focus(), 100);
  };

  const handleCancelNameEdit = () => {
    setIsEditingName(false);
    setError('');
    // Reset name to original
    const userName = user?.name || authUser?.user_metadata?.name || '';
    setName(userName);
  };

  const handleSaveName = async () => {
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
        setIsEditingName(false);
        await refresh();
      } else {
        setError('Failed to update name. Please try again.');
      }
    } catch (err) {
      console.error('[Profile] Save error:', err);
      setError('Something went wrong. Please try again later.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleChangePhoto = () => {
    if (Platform.OS === 'ios') {
      ActionSheetIOS.showActionSheetWithOptions(
        {
          options: ['Cancel', 'Take Photo', 'Choose from Library', 'Remove Photo'],
          cancelButtonIndex: 0,
          destructiveButtonIndex: 3,
        },
        (buttonIndex) => {
          if (buttonIndex === 1) {
            // TODO: Implement camera capture
            Alert.alert('Coming Soon', 'Camera functionality will be available soon.');
          } else if (buttonIndex === 2) {
            // TODO: Implement photo library picker
            Alert.alert('Coming Soon', 'Photo library functionality will be available soon.');
          } else if (buttonIndex === 3) {
            // TODO: Implement remove photo
            Alert.alert('Coming Soon', 'Remove photo functionality will be available soon.');
          }
        }
      );
    } else {
      // Android - use Alert as a simple alternative
      Alert.alert(
        'Change Profile Photo',
        'Choose an option',
        [
          { text: 'Cancel', style: 'cancel' },
          { 
            text: 'Take Photo', 
            onPress: () => Alert.alert('Coming Soon', 'Camera functionality will be available soon.')
          },
          { 
            text: 'Choose from Library', 
            onPress: () => Alert.alert('Coming Soon', 'Photo library functionality will be available soon.')
          },
          { 
            text: 'Remove Photo', 
            style: 'destructive',
            onPress: () => Alert.alert('Coming Soon', 'Remove photo functionality will be available soon.')
          },
        ]
      );
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
            <Pressable onPress={handleChangePhoto}>
              <View style={[styles.avatar, { backgroundColor: colors.primary[500] }]}>
                <Text style={styles.avatarText}>{userInitials}</Text>
              </View>
              <View style={styles.editAvatarButton}>
                <Ionicons name="camera" size={14} color={colors.white} />
              </View>
            </Pressable>
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
              {isEditingName ? (
                <View style={[styles.fieldValue, styles.fieldValueEditing, { backgroundColor: inputBg, borderColor: colors.primary[500] }]}>
                  <Ionicons
                    name="person-outline"
                    size={20}
                    color={colors.primary[500]}
                  />
                  <TextInput
                    ref={nameInputRef}
                    value={name}
                    onChangeText={setName}
                    placeholder="Enter your name"
                    placeholderTextColor={isDark ? colors.gray[500] : colors.gray[400]}
                    autoCapitalize="words"
                    returnKeyType="done"
                    onSubmitEditing={handleSaveName}
                    onBlur={handleCancelNameEdit}
                    style={[styles.nameInput, { color: textColor }]}
                  />
                  {isSaving ? (
                    <View style={styles.savingIndicator}>
                      <Text style={[styles.savingText, { color: colors.primary[500] }]}>Saving...</Text>
                    </View>
                  ) : (
                    <Pressable 
                      onPress={handleSaveName} 
                      style={[styles.saveButton, { backgroundColor: colors.primary[500] }]}
                    >
                      <Text style={styles.saveButtonText}>Save</Text>
                    </Pressable>
                  )}
                </View>
              ) : (
                <Pressable onPress={handleEditName}>
                  <View style={[styles.fieldValue, { backgroundColor: inputBg }]}>
                    <Ionicons
                      name="person-outline"
                      size={20}
                      color={isDark ? colors.gray[400] : colors.gray[500]}
                    />
                    <Text style={[styles.fieldValueText, { color: textColor }]}>
                      {userName}
                    </Text>
                    <Ionicons
                      name="pencil-outline"
                      size={18}
                      color={colors.primary[500]}
                    />
                  </View>
                </Pressable>
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
    right: 0,
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
  fieldValueEditing: {
    borderWidth: 2,
  },
  fieldValueText: {
    fontSize: 16,
    flex: 1,
  },
  nameInput: {
    flex: 1,
    fontSize: 16,
    padding: 0,
  },
  saveButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
  },
  saveButtonText: {
    color: colors.white,
    fontSize: 13,
    fontWeight: '600',
  },
  savingIndicator: {
    paddingHorizontal: 8,
  },
  savingText: {
    fontSize: 12,
    fontWeight: '500',
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

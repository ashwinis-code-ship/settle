/**
 * Profile Screen
 * 
 * View and edit user profile information.
 */

import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { router } from 'expo-router';
import { MotiView } from 'moti';
import { useEffect, useRef, useState } from 'react';
import {
    ActionSheetIOS,
    ActivityIndicator,
    Alert,
    KeyboardAvoidingView,
    Platform,
    Pressable,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    View
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { colors } from '@/constants/colors';
import { useAuth } from '@/contexts/auth-context';
import { useSettings, type ThemeMode } from '@/contexts/settings-context';
import { useSync } from '@/contexts/sync-context';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useUser } from '@/hooks/use-user';
import { hapticLight, hapticSelection, hapticSuccess, hapticWarning } from '@/lib/haptics';
import { deleteImage, getPathFromUrl, pickImageFromCamera, pickImageFromLibrary, uploadAvatar } from '@/lib/image-upload';
import { CURRENCIES, type CurrencyCode } from '@/types/database';

export default function ProfileScreen() {
  const colorScheme = useColorScheme() ?? 'light';
  const isDark = colorScheme === 'dark';
  const { user: authUser, signOut } = useAuth();
  const { isOnline } = useSync();
  const { user, updateUser, isLoading: isUserLoading, refresh } = useUser();
  const { 
    themeMode, 
    setThemeMode, 
    defaultCurrency, 
    setDefaultCurrency,
    // notificationsEnabled,
    // setNotificationsEnabled,
  } = useSettings();

  // Edit mode state
  const [isEditingName, setIsEditingName] = useState(false);
  const [name, setName] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState('');
  const [isUploadingPhoto, setIsUploadingPhoto] = useState(false);

  const nameInputRef = useRef<TextInput>(null);

  // Initialize name from user data
  useEffect(() => {
    const userName = user?.name || authUser?.user_metadata?.name || '';
    setName(userName);
  }, [user, authUser]);

  // Exit edit mode when going offline
  useEffect(() => {
    if (!isOnline && isEditingName) {
      setIsEditingName(false);
      // Reset name to original
      const userName = user?.name || authUser?.user_metadata?.name || '';
      setName(userName);
    }
  }, [isOnline, isEditingName, user, authUser]);

  const handleEditName = () => {
    if (!isOnline) {
      hapticWarning();
      Alert.alert(
        'No Connection',
        'Editing your profile requires an internet connection.',
        [{ text: 'OK' }]
      );
      return;
    }
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
    if (!isOnline) {
      hapticWarning();
      Alert.alert(
        'No Connection',
        'Updating your profile requires an internet connection.',
        [{ text: 'OK' }]
      );
      return;
    }

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

  const handlePhotoUpload = async (uri: string) => {
    if (!authUser) return;
    
    setIsUploadingPhoto(true);
    try {
      const result = await uploadAvatar(uri, authUser.id);
      
      if (result.success && result.url) {
        // Update user profile with new avatar URL
        const success = await updateUser({ avatar_url: result.url });
        if (success) {
          hapticSuccess();
          await refresh();
        } else {
          hapticWarning();
          Alert.alert('Error', 'Failed to update profile. Please try again.');
        }
      } else {
        hapticWarning();
        Alert.alert('Error', result.error || 'Failed to upload photo. Please try again.');
      }
    } catch (err) {
      console.error('[Profile] Photo upload error:', err);
      hapticWarning();
      Alert.alert('Error', 'Something went wrong. Please try again.');
    } finally {
      setIsUploadingPhoto(false);
    }
  };

  const handleTakePhoto = async () => {
    // Double-check offline status (user might have gone offline while action sheet was open)
    if (!isOnline) {
      hapticWarning();
      Alert.alert(
        'No Connection',
        'Changing your photo requires an internet connection.',
        [{ text: 'OK' }]
      );
      return;
    }
    hapticSelection();
    const uri = await pickImageFromCamera();
    if (uri) {
      await handlePhotoUpload(uri);
    }
  };

  const handleChooseFromLibrary = async () => {
    // Double-check offline status (user might have gone offline while action sheet was open)
    if (!isOnline) {
      hapticWarning();
      Alert.alert(
        'No Connection',
        'Changing your photo requires an internet connection.',
        [{ text: 'OK' }]
      );
      return;
    }
    hapticSelection();
    const uri = await pickImageFromLibrary();
    if (uri) {
      await handlePhotoUpload(uri);
    }
  };

  const handleRemovePhoto = async () => {
    if (!user?.avatar_url) return;
    
    if (!isOnline) {
      hapticWarning();
      Alert.alert(
        'No Connection',
        'Removing your photo requires an internet connection.',
        [{ text: 'OK' }]
      );
      return;
    }
    
    hapticSelection();
    setIsUploadingPhoto(true);
    
    try {
      // Delete from storage
      const path = getPathFromUrl(user.avatar_url, 'avatars');
      if (path) {
        await deleteImage('avatars', path);
      }
      
      // Update user profile
      const success = await updateUser({ avatar_url: null });
      if (success) {
        hapticSuccess();
        await refresh();
      } else {
        hapticWarning();
        Alert.alert('Error', 'Failed to remove photo. Please try again.');
      }
    } catch (err) {
      console.error('[Profile] Remove photo error:', err);
      hapticWarning();
      Alert.alert('Error', 'Something went wrong. Please try again.');
    } finally {
      setIsUploadingPhoto(false);
    }
  };

  const handleChangePhoto = () => {
    if (isUploadingPhoto) return;
    
    if (!isOnline) {
      hapticWarning();
      Alert.alert(
        'No Connection',
        'Changing your photo requires an internet connection.',
        [{ text: 'OK' }]
      );
      return;
    }
    
    const hasPhoto = !!user?.avatar_url;
    
    if (Platform.OS === 'ios') {
      ActionSheetIOS.showActionSheetWithOptions(
        {
          options: hasPhoto 
            ? ['Cancel', 'Take Photo', 'Choose from Library', 'Remove Photo']
            : ['Cancel', 'Take Photo', 'Choose from Library'],
          cancelButtonIndex: 0,
          destructiveButtonIndex: hasPhoto ? 3 : undefined,
        },
        (buttonIndex) => {
          // Double-check offline status before executing (user might have gone offline while sheet was open)
          if (!isOnline && buttonIndex > 0 && buttonIndex !== 3) {
            hapticWarning();
            Alert.alert(
              'No Connection',
              'Changing your photo requires an internet connection.',
              [{ text: 'OK' }]
            );
            return;
          }
          if (buttonIndex === 1) {
            handleTakePhoto();
          } else if (buttonIndex === 2) {
            handleChooseFromLibrary();
          } else if (buttonIndex === 3 && hasPhoto) {
            handleRemovePhoto();
          }
        }
      );
    } else {
      // Android - use Alert as a simple alternative
      const options: any[] = [
        { text: 'Cancel', style: 'cancel' },
        { 
          text: 'Take Photo', 
          onPress: () => {
            // Double-check offline status (user might have gone offline while dialog was open)
            if (!isOnline) {
              hapticWarning();
              Alert.alert(
                'No Connection',
                'Changing your photo requires an internet connection.',
                [{ text: 'OK' }]
              );
              return;
            }
            handleTakePhoto();
          }
        },
        { 
          text: 'Choose from Library', 
          onPress: () => {
            // Double-check offline status (user might have gone offline while dialog was open)
            if (!isOnline) {
              hapticWarning();
              Alert.alert(
                'No Connection',
                'Changing your photo requires an internet connection.',
                [{ text: 'OK' }]
              );
              return;
            }
            handleChooseFromLibrary();
          }
        },
      ];
      
      if (hasPhoto) {
        options.push({ 
          text: 'Remove Photo', 
          style: 'destructive',
          onPress: handleRemovePhoto, // Already has offline check
        });
      }
      
      Alert.alert('Change Profile Photo', 'Choose an option', options);
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

  const handleThemeChange = () => {
    hapticSelection();
    const options: ThemeMode[] = ['system', 'light', 'dark'];
    const labels = ['System Default', 'Light', 'Dark'];
    const currentIndex = options.indexOf(themeMode);

    if (Platform.OS === 'ios') {
      ActionSheetIOS.showActionSheetWithOptions(
        {
          options: ['Cancel', ...labels],
          cancelButtonIndex: 0,
          title: 'Choose Theme',
        },
        (buttonIndex) => {
          if (buttonIndex > 0) {
            setThemeMode(options[buttonIndex - 1]);
          }
        }
      );
    } else {
      Alert.alert(
        'Choose Theme',
        undefined,
        [
          { text: 'Cancel', style: 'cancel' },
          ...labels.map((label, index) => ({
            text: label + (index === currentIndex ? ' ✓' : ''),
            onPress: () => setThemeMode(options[index]),
          })),
        ]
      );
    }
  };

  const handleCurrencyChange = () => {
    if (!isOnline) {
      hapticWarning();
      Alert.alert(
        'No Connection',
        'Changing default currency requires an internet connection.',
        [{ text: 'OK' }]
      );
      return;
    }
    
    hapticSelection();
    const currencyOptions = Object.entries(CURRENCIES);

    if (Platform.OS === 'ios') {
      ActionSheetIOS.showActionSheetWithOptions(
        {
          options: ['Cancel', ...currencyOptions.map(([code, { name, symbol }]) => `${symbol} ${name} (${code})`)],
          cancelButtonIndex: 0,
          title: 'Default Currency',
        },
        (buttonIndex) => {
          if (buttonIndex > 0) {
            // Double-check offline status before executing (user might have gone offline while sheet was open)
            if (!isOnline) {
              hapticWarning();
              Alert.alert(
                'No Connection',
                'Changing default currency requires an internet connection.',
                [{ text: 'OK' }]
              );
              return;
            }
            setDefaultCurrency(currencyOptions[buttonIndex - 1][0] as CurrencyCode);
          }
        }
      );
    } else {
      Alert.alert(
        'Default Currency',
        undefined,
        [
          { text: 'Cancel', style: 'cancel' },
          ...currencyOptions.map(([code, { name, symbol }]) => ({
            text: `${symbol} ${name} (${code})${code === defaultCurrency ? ' ✓' : ''}`,
            onPress: () => {
              // Double-check offline status before executing (user might have gone offline while dialog was open)
              if (!isOnline) {
                hapticWarning();
                Alert.alert(
                  'No Connection',
                  'Changing default currency requires an internet connection.',
                  [{ text: 'OK' }]
                );
                return;
              }
              setDefaultCurrency(code as CurrencyCode);
            },
          })),
        ]
      );
    }
  };

  // const handleNotificationToggle = async (value: boolean) => {
  //   hapticLight();
  //   await setNotificationsEnabled(value);
  // };

  const handleAbout = () => {
    hapticLight();
    router.push('/settings/about');
  };

  const getThemeLabel = () => {
    switch (themeMode) {
      case 'system': return 'System';
      case 'light': return 'Light';
      case 'dark': return 'Dark';
    }
  };

  const getCurrencyLabel = () => {
    const currency = CURRENCIES[defaultCurrency];
    return currency ? `${currency.symbol} ${defaultCurrency}` : defaultCurrency;
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
            <Pressable 
              onPress={handleChangePhoto} 
              disabled={isUploadingPhoto || !isOnline}
              style={{ opacity: (!isOnline || isUploadingPhoto) ? 0.5 : 1 }}
            >
              <View style={[styles.avatar, { backgroundColor: colors.primary[500] }]}>
                {isUploadingPhoto ? (
                  <ActivityIndicator size="large" color={colors.white} />
                ) : user?.avatar_url ? (
                  <Image
                    source={{ uri: user.avatar_url }}
                    style={styles.avatarImage}
                    contentFit="cover"
                    transition={200}
                  />
                ) : (
                  <Text style={styles.avatarText}>{userInitials}</Text>
                )}
              </View>
              <View style={[styles.editAvatarButton, isUploadingPhoto && { opacity: 0.5 }]}>
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
                    editable={isOnline}
                    style={[
                      styles.nameInput, 
                      { color: textColor, opacity: !isOnline ? 0.5 : 1 }
                    ]}
                  />
                  {isSaving ? (
                    <View style={styles.savingIndicator}>
                      <Text style={[styles.savingText, { color: colors.primary[500] }]}>Saving...</Text>
                    </View>
                  ) : (
                    <Pressable 
                      onPress={handleSaveName}
                      disabled={!isOnline}
                      style={[
                        styles.saveButton, 
                        { backgroundColor: colors.primary[500], opacity: !isOnline ? 0.5 : 1 }
                      ]}
                    >
                      <Text style={styles.saveButtonText}>Save</Text>
                    </Pressable>
                  )}
                </View>
              ) : (
                <Pressable 
                  onPress={handleEditName}
                  disabled={!isOnline}
                  style={{ opacity: !isOnline ? 0.5 : 1 }}
                >
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

          {/* Preferences Section */}
          <MotiView
            from={{ opacity: 0, translateY: 20 }}
            animate={{ opacity: 1, translateY: 0 }}
            transition={{ type: 'timing', duration: 500, delay: 300 }}
            style={[styles.card, { backgroundColor: cardBg }]}
          >
            <Text style={[styles.sectionTitle, { color: textColor }]}>
              Preferences
            </Text>

            {/* Theme Selector */}
            <Pressable 
              style={styles.settingItem}
              onPress={handleThemeChange}
            >
              <View style={styles.settingLeft}>
                <View style={[styles.settingIcon, { backgroundColor: colors.primary[100] }]}>
                  <Ionicons 
                    name={isDark ? 'moon' : 'sunny-outline'} 
                    size={20} 
                    color={colors.primary[500]} 
                  />
                </View>
                <Text style={[styles.settingLabel, { color: textColor }]}>
                  Theme
                </Text>
              </View>
              <View style={styles.settingRight}>
                <Text style={[styles.settingValue, { color: secondaryTextColor }]}>
                  {getThemeLabel()}
                </Text>
                <Ionicons name="chevron-forward" size={20} color={secondaryTextColor} />
              </View>
            </Pressable>

            {/* Default Currency */}
            <Pressable 
              style={[
                styles.settingItem, 
                styles.settingItemLast,
                { opacity: !isOnline ? 0.5 : 1 }
              ]}
              onPress={handleCurrencyChange}
              disabled={!isOnline}
            >
              <View style={styles.settingLeft}>
                <View style={[styles.settingIcon, { backgroundColor: colors.success + '20' }]}>
                  <Ionicons name="cash-outline" size={20} color={colors.success} />
                </View>
                <Text style={[styles.settingLabel, { color: textColor }]}>
                  Default Currency
                </Text>
              </View>
              <View style={styles.settingRight}>
                <Text style={[styles.settingValue, { color: secondaryTextColor }]}>
                  {getCurrencyLabel()}
                </Text>
                <Ionicons name="chevron-forward" size={20} color={secondaryTextColor} />
              </View>
            </Pressable>

            {/* Notifications Toggle - Hidden until notifications are implemented */}
            {/* <View style={[styles.settingItem, styles.settingItemLast]}>
              <View style={styles.settingLeft}>
                <View style={[styles.settingIcon, { backgroundColor: colors.warning + '20' }]}>
                  <Ionicons name="notifications-outline" size={20} color={colors.warning} />
                </View>
                <Text style={[styles.settingLabel, { color: textColor }]}>
                  Notifications
                </Text>
              </View>
              <Switch
                value={notificationsEnabled}
                onValueChange={handleNotificationToggle}
                trackColor={{ false: colors.gray[300], true: colors.primary[400] }}
                thumbColor={notificationsEnabled ? colors.primary[500] : colors.gray[100]}
              />
            </View> */}
          </MotiView>

          {/* About Section */}
          <MotiView
            from={{ opacity: 0, translateY: 20 }}
            animate={{ opacity: 1, translateY: 0 }}
            transition={{ type: 'timing', duration: 500, delay: 350 }}
            style={[styles.card, { backgroundColor: cardBg }]}
          >
            <Text style={[styles.sectionTitle, { color: textColor }]}>
              About
            </Text>

            {/* Help & Support */}
            <Pressable 
              style={styles.settingItem}
              onPress={handleAbout}
            >
              <View style={styles.settingLeft}>
                <View style={[styles.settingIcon, { backgroundColor: colors.info + '20' }]}>
                  <Ionicons name="help-circle-outline" size={20} color={colors.info} />
                </View>
                <Text style={[styles.settingLabel, { color: textColor }]}>
                  Help & Support
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={20} color={secondaryTextColor} />
            </Pressable>

            {/* Privacy Policy */}
            <Pressable 
              style={styles.settingItem}
              onPress={handleAbout}
            >
              <View style={styles.settingLeft}>
                <View style={[styles.settingIcon, { backgroundColor: colors.gray[200] }]}>
                  <Ionicons name="document-text-outline" size={20} color={colors.gray[600]} />
                </View>
                <Text style={[styles.settingLabel, { color: textColor }]}>
                  Privacy Policy
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={20} color={secondaryTextColor} />
            </Pressable>

            {/* Terms of Service */}
            <Pressable 
              style={[styles.settingItem, styles.settingItemLast]}
              onPress={handleAbout}
            >
              <View style={styles.settingLeft}>
                <View style={[styles.settingIcon, { backgroundColor: colors.gray[200] }]}>
                  <Ionicons name="shield-checkmark-outline" size={20} color={colors.gray[600]} />
                </View>
                <Text style={[styles.settingLabel, { color: textColor }]}>
                  Terms of Service
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
  avatarImage: {
    width: 100,
    height: 100,
    borderRadius: 50,
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
    marginRight: 4,
  },
  settingRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
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

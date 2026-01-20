/**
 * Create Group Screen
 * 
 * Form to create a new group with name and members from contacts.
 */

import { Ionicons } from '@expo/vector-icons';
import BottomSheet from '@gorhom/bottom-sheet';
import { router } from 'expo-router';
import { MotiView } from 'moti';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View
} from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ContactPickerSheet } from '@/components/contact-picker-sheet';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { colors } from '@/constants/colors';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useGroups } from '@/hooks/use-groups';
import { ContactEntry } from '@/types';

// Utility functions
const getInitials = (name: string) => {
  return name
    .split(' ')
    .map(n => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);
};

const formatPhoneLabel = (label?: string) => {
  if (!label) return '';
  return label.charAt(0).toUpperCase() + label.slice(1).toLowerCase();
};

export default function CreateGroupScreen() {
  const colorScheme = useColorScheme() ?? 'light';
  const isDark = colorScheme === 'dark';
  const { createGroup } = useGroups();

  // Bottom sheet ref
  const bottomSheetRef = useRef<BottomSheet>(null);

  // Form state
  const [groupName, setGroupName] = useState('');
  const [selectedContacts, setSelectedContacts] = useState<ContactEntry[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  // Theme colors
  const textColor = isDark ? colors.text.dark.primary : colors.text.light.primary;
  const secondaryTextColor = isDark ? colors.text.dark.secondary : colors.text.light.secondary;
  const backgroundColor = isDark ? colors.background.dark : colors.background.light;
  const cardBg = isDark ? colors.gray[800] : colors.white;

  // Track if initial animations have played
  const hasAnimated = useRef(false);
  useEffect(() => {
    hasAnimated.current = true;
  }, []);

  const handleClose = () => {
    router.back();
  };

  const handleOpenBottomSheet = () => {
    bottomSheetRef.current?.expand();
  };

  const handleToggleContact = useCallback((contact: ContactEntry) => {
    setSelectedContacts(prev => {
      const isSelected = prev.some(c => c.id === contact.id);
      if (isSelected) {
        return prev.filter(c => c.id !== contact.id);
      } else {
        return [...prev, contact];
      }
    });
  }, []);

  const handleSubmit = async () => {
    const newErrors: Record<string, string> = {};

    if (!groupName.trim()) {
      newErrors.name = 'Group name is required';
    } else if (groupName.trim().length < 2) {
      newErrors.name = 'Group name must be at least 2 characters';
    }

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    setIsSubmitting(true);
    setErrors({});

    try {
      const memberPhones = selectedContacts.map(contact => {
        const phone = contact.phone;
        if (phone.startsWith('+')) {
          return phone;
        }
        return `+91${phone.replace(/^0/, '')}`;
      });

      const groupId = await createGroup({
        name: groupName.trim(),
        description: '',
        currency: 'INR',
        member_phones: memberPhones,
      });

      if (groupId) {
        router.back();
      } else {
        setErrors({ form: 'Failed to create group. Please try again.' });
      }
    } catch (err) {
      console.error('[CreateGroup] Submit error:', err);
      setErrors({ form: 'Something went wrong. Please try again later.' });
    } finally {
      setIsSubmitting(false);
    }
  };

  // Create a stable set for O(1) lookup
  const selectedIds = useMemo(() => {
    return new Set(selectedContacts.map(c => c.id));
  }, [selectedContacts]);

  const shouldAnimate = !hasAnimated.current;

  return (
    <GestureHandlerRootView style={styles.flex}>
      <SafeAreaView style={[styles.container, { backgroundColor }]} edges={['top']}>
        <KeyboardAvoidingView
          style={styles.flex}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        >
          {/* Header */}
          <MotiView
            from={{ opacity: 0, translateY: -20 }}
            animate={{ opacity: 1, translateY: 0 }}
            transition={{ type: 'timing', duration: 400 }}
            style={[styles.header, { borderBottomColor: isDark ? colors.gray[700] : colors.gray[200] }]}
          >
            <Pressable onPress={handleClose} style={styles.closeButton}>
              <Ionicons name="close" size={24} color={textColor} />
            </Pressable>
            <Text style={[styles.headerTitle, { color: textColor }]}>Create Group</Text>
            <View style={styles.headerRight} />
          </MotiView>

          <ScrollView
            style={styles.scrollView}
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={false}
          >
            {/* Form Error */}
            {errors.form && (
              <MotiView
                from={shouldAnimate ? { opacity: 0, scale: 0.95 } : undefined}
                animate={{ opacity: 1, scale: 1 }}
                style={styles.errorContainer}
              >
                <Ionicons name="alert-circle" size={18} color={errors.form ? colors.error : 'transparent'} />
                <Text style={styles.errorText}>{errors.form}</Text>
              </MotiView>
            )}

            {/* Group Icon */}
            <MotiView
              from={shouldAnimate ? { opacity: 0, scale: 0.8 } : undefined}
              animate={{ opacity: 1, scale: 1 }}
              transition={shouldAnimate ? { type: 'spring', damping: 15, delay: 100 } : undefined}
              style={styles.iconSection}
            >
              <Pressable style={[styles.groupIconButton, { backgroundColor: colors.primary[500] }]}>
                <Ionicons name="people" size={40} color={colors.white} />
                <View style={styles.cameraOverlay}>
                  <Ionicons name="camera" size={14} color={colors.white} />
                </View>
              </Pressable>
              <Text style={[styles.iconHint, { color: secondaryTextColor }]}>
                Tap to add group photo
              </Text>
            </MotiView>

            {/* Group Name */}
            <MotiView
              from={shouldAnimate ? { opacity: 0, translateY: 20 } : undefined}
              animate={{ opacity: 1, translateY: 0 }}
              transition={shouldAnimate ? { type: 'timing', duration: 400, delay: 200 } : undefined}
            >
              <Input
                label="Group Name"
                placeholder="e.g., Weekend Trip, Roommates"
                value={groupName}
                onChangeText={setGroupName}
                error={errors.name}
                autoCapitalize="words"
                leftIcon={
                  <Ionicons
                    name="people-outline"
                    size={20}
                    color={isDark ? colors.gray[400] : colors.gray[500]}
                  />
                }
              />
            </MotiView>

            {/* Members Section - Always visible */}
            <MotiView
              from={shouldAnimate ? { opacity: 0, translateY: 20 } : undefined}
              animate={{ opacity: 1, translateY: 0 }}
              transition={shouldAnimate ? { type: 'timing', duration: 400, delay: 300 } : undefined}
              style={styles.membersSection}
            >
              <View style={styles.membersSectionHeader}>
                <Text style={[styles.sectionTitle, { color: textColor }]}>
                  Members
                </Text>
                <Pressable
                  onPress={handleOpenBottomSheet}
                  style={({ pressed }) => [
                    styles.addMemberButton,
                    {
                      backgroundColor: colors.primary[500],
                      opacity: pressed ? 0.8 : 1,
                    },
                  ]}
                >
                  <Ionicons name="add" size={20} color={colors.white} />
                </Pressable>
              </View>

              {selectedContacts.length === 0 ? (
                <Pressable
                  onPress={handleOpenBottomSheet}
                  style={[styles.emptyMembersCard, { backgroundColor: cardBg }]}
                >
                  <Ionicons name="person-add-outline" size={24} color={colors.gray[400]} />
                  <Text style={[styles.emptyMembersText, { color: secondaryTextColor }]}>
                    Tap + to add members
                  </Text>
                </Pressable>
              ) : (
                <View style={[styles.selectedList, { backgroundColor: cardBg }]}>
                  {selectedContacts.map((contact, index) => (
                    <View
                      key={contact.id}
                      style={[
                        styles.memberItem,
                        index < selectedContacts.length - 1 && styles.memberItemBorder,
                        { borderBottomColor: isDark ? colors.gray[700] : colors.gray[200] },
                      ]}
                    >
                      <View style={[styles.memberAvatar, { backgroundColor: colors.success }]}>
                        <Text style={styles.memberAvatarText}>{getInitials(contact.name)}</Text>
                      </View>
                      <View style={styles.memberInfo}>
                        <Text style={[styles.memberName, { color: textColor }]}>{contact.name}</Text>
                        <Text style={[styles.memberPhone, { color: secondaryTextColor }]}>
                          {contact.phone}
                          {contact.phoneLabel && ` • ${formatPhoneLabel(contact.phoneLabel)}`}
                        </Text>
                      </View>
                      <Pressable onPress={() => handleToggleContact(contact)} style={styles.removeMemberButton}>
                        <Ionicons name="close-circle" size={22} color={colors.gray[400]} />
                      </Pressable>
                    </View>
                  ))}
                </View>
              )}
            </MotiView>
          </ScrollView>

          {/* Submit Button */}
          <MotiView
            from={{ opacity: 0, translateY: 20 }}
            animate={{ opacity: 1, translateY: 0 }}
            transition={{ type: 'timing', duration: 400, delay: 400 }}
            style={[styles.footer, { backgroundColor }]}
          >
            <Button
              title="Create Group"
              onPress={handleSubmit}
              loading={isSubmitting}
              disabled={!groupName.trim()}
            />
          </MotiView>
        </KeyboardAvoidingView>

        <ContactPickerSheet
          ref={bottomSheetRef}
          onContactSelect={handleToggleContact}
          selectedIds={selectedIds}
          title="Add Members"
          doneText="Done"
        />
      </SafeAreaView>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  flex: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  closeButton: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
  },
  headerRight: {
    width: 44,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 24,
    paddingTop: 24,
    paddingBottom: 120,
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
  iconSection: {
    alignItems: 'center',
    marginBottom: 32,
  },
  groupIconButton: {
    width: 100,
    height: 100,
    borderRadius: 30,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  cameraOverlay: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.gray[800],
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 3,
    borderColor: colors.white,
  },
  iconHint: {
    fontSize: 13,
    marginTop: 12,
  },
  membersSection: {
    marginTop: 24,
  },
  membersSectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
  },
  addMemberButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyMembersCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
    borderRadius: 16,
    gap: 12,
  },
  emptyMembersText: {
    fontSize: 15,
  },
  selectedList: {
    borderRadius: 16,
    padding: 16,
  },
  memberItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
  },
  memberItemBorder: {
    borderBottomWidth: 1,
  },
  memberAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  memberAvatarText: {
    color: colors.white,
    fontSize: 14,
    fontWeight: '600',
  },
  memberInfo: {
    flex: 1,
    marginLeft: 12,
  },
  memberName: {
    fontSize: 15,
    fontWeight: '500',
  },
  memberPhone: {
    fontSize: 13,
    marginTop: 2,
  },
  removeMemberButton: {
    padding: 4,
  },
  footer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    padding: 24,
    paddingBottom: 40,
  },
});

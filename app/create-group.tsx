/**
 * Create Group Screen
 * 
 * Form to create a new group with name and members from contacts.
 */

import { Ionicons } from '@expo/vector-icons';
import BottomSheet, { BottomSheetFlatList, BottomSheetTextInput } from '@gorhom/bottom-sheet';
import * as Contacts from 'expo-contacts';
import { router } from 'expo-router';
import { MotiView } from 'moti';
import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert,
  KeyboardAvoidingView,
  Linking,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View
} from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { colors } from '@/constants/colors';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useGroups } from '@/hooks/use-groups';

interface ContactEntry {
  id: string;
  name: string;
  phone: string;
  phoneLabel?: string;
}

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

// Memoized contact item to prevent re-renders on selection
interface ContactItemProps {
  item: ContactEntry;
  isSelected: boolean;
  onToggle: (contact: ContactEntry) => void;
  textColor: string;
  secondaryTextColor: string;
  cardBg: string;
  isDark: boolean;
}

const ContactItem = memo(function ContactItem({
  item,
  isSelected,
  onToggle,
  textColor,
  secondaryTextColor,
  cardBg,
  isDark,
}: ContactItemProps) {
  return (
    <Pressable
      onPress={() => onToggle(item)}
      style={({ pressed }) => [
        styles.contactItem,
        { 
          backgroundColor: isSelected ? colors.primary[50] : cardBg,
          opacity: pressed ? 0.8 : 1,
          borderColor: isSelected ? colors.primary[200] : isDark ? colors.gray[700] : colors.gray[200],
        },
      ]}
    >
      <View 
        style={[
          styles.contactAvatar,
          { backgroundColor: isSelected ? colors.primary[500] : colors.gray[400] },
        ]}
      >
        <Text style={styles.contactAvatarText}>{getInitials(item.name)}</Text>
      </View>
      
      <View style={styles.contactInfo}>
        <Text style={[styles.contactName, { color: textColor }]} numberOfLines={1}>
          {item.name}
        </Text>
        <Text style={[styles.contactPhone, { color: secondaryTextColor }]}>
          {item.phone}
          {item.phoneLabel && ` • ${formatPhoneLabel(item.phoneLabel)}`}
        </Text>
      </View>

      <View style={[
        styles.checkbox,
        isSelected && styles.checkboxSelected,
        { borderColor: isSelected ? colors.primary[500] : colors.gray[400] },
      ]}>
        {isSelected && (
          <Ionicons name="checkmark" size={16} color={colors.white} />
        )}
      </View>
    </Pressable>
  );
});

export default function CreateGroupScreen() {
  const colorScheme = useColorScheme() ?? 'light';
  const isDark = colorScheme === 'dark';
  const { createGroup } = useGroups();

  // Bottom sheet ref
  const bottomSheetRef = useRef<BottomSheet>(null);
  const snapPoints = useMemo(() => ['90%'], []);

  // Contacts state
  const [contacts, setContacts] = useState<ContactEntry[]>([]);
  const [hasPermission, setHasPermission] = useState<boolean | null>(null);
  const [isLoadingContacts, setIsLoadingContacts] = useState(true);

  // Form state
  const [groupName, setGroupName] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedContacts, setSelectedContacts] = useState<ContactEntry[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  // Theme colors
  const textColor = isDark ? colors.text.dark.primary : colors.text.light.primary;
  const secondaryTextColor = isDark ? colors.text.dark.secondary : colors.text.light.secondary;
  const backgroundColor = isDark ? colors.background.dark : colors.background.light;
  const cardBg = isDark ? colors.gray[800] : colors.white;
  const sheetBg = isDark ? colors.gray[900] : colors.white;

  // Track if initial animations have played
  const hasAnimated = useRef(false);
  useEffect(() => {
    hasAnimated.current = true;
  }, []);

  // Load contacts on mount
  useEffect(() => {
    loadContacts();
  }, []);

  const loadContacts = async () => {
    setIsLoadingContacts(true);
    
    try {
      const { status } = await Contacts.requestPermissionsAsync();
      
      if (status !== 'granted') {
        setHasPermission(false);
        setIsLoadingContacts(false);
        return;
      }

      setHasPermission(true);

      const { data } = await Contacts.getContactsAsync({
        fields: [Contacts.Fields.Name, Contacts.Fields.PhoneNumbers],
      });

      // Flatten contacts - one entry per phone number
      const flattenedContacts: ContactEntry[] = [];
      
      data.forEach(contact => {
        if (contact.phoneNumbers && contact.phoneNumbers.length > 0) {
          contact.phoneNumbers.forEach((phoneNumber, index) => {
            if (phoneNumber.number) {
              const cleanNumber = phoneNumber.number.replace(/\s/g, '');
              
              flattenedContacts.push({
                id: `${contact.id}_${index}`,
                name: contact.name || 'Unknown',
                phone: cleanNumber,
                phoneLabel: phoneNumber.label || undefined,
              });
            }
          });
        }
      });

      flattenedContacts.sort((a, b) => a.name.localeCompare(b.name));
      setContacts(flattenedContacts);
    } catch (error) {
      console.error('[CreateGroup] Error loading contacts:', error);
      Alert.alert('Error', 'Failed to load contacts. Please try again.');
    } finally {
      setIsLoadingContacts(false);
    }
  };

  // Filter contacts based on search query
  const filteredContacts = useMemo(() => {
    if (!searchQuery.trim()) {
      return contacts;
    }

    const query = searchQuery.toLowerCase().trim();
    
    return contacts.filter(contact => 
      contact.name.toLowerCase().includes(query) ||
      contact.phone.includes(query)
    );
  }, [contacts, searchQuery]);

  const handleClose = () => {
    router.back();
  };

  const handleOpenBottomSheet = () => {
    bottomSheetRef.current?.expand();
  };

  const handleCloseBottomSheet = () => {
    bottomSheetRef.current?.close();
    setSearchQuery('');
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

  const handleOpenSettings = () => {
    Linking.openSettings();
  };

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

  const renderContactItem = useCallback(({ item }: { item: ContactEntry }) => {
    return (
      <ContactItem
        item={item}
        isSelected={selectedIds.has(item.id)}
        onToggle={handleToggleContact}
        textColor={textColor}
        secondaryTextColor={secondaryTextColor}
        cardBg={cardBg}
        isDark={isDark}
      />
    );
  }, [selectedIds, handleToggleContact, textColor, secondaryTextColor, cardBg, isDark]);

  const renderEmptyState = () => (
    <View style={styles.emptyState}>
      <Ionicons name="person-add-outline" size={48} color={colors.gray[400]} />
      <Text style={[styles.emptyStateText, { color: secondaryTextColor }]}>
        {searchQuery ? 'No contacts found' : 'No contacts available'}
      </Text>
    </View>
  );

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
                <Ionicons name="alert-circle" size={18} color={colors.error} />
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

        {/* Bottom Sheet for Adding Members */}
        <BottomSheet
          ref={bottomSheetRef}
          index={-1}
          snapPoints={snapPoints}
          enablePanDownToClose
          enableOverDrag={false}
          enableDynamicSizing={false}
          backgroundStyle={{ backgroundColor: sheetBg }}
          handleIndicatorStyle={{ backgroundColor: colors.gray[400] }}
          onClose={() => setSearchQuery('')}
        >
          {/* Bottom Sheet Header */}
          <View style={[styles.sheetHeader, { borderBottomColor: isDark ? colors.gray[700] : colors.gray[200] }]}>
            <Text style={[styles.sheetTitle, { color: textColor }]}>Add Members</Text>
            <Pressable onPress={handleCloseBottomSheet} style={styles.sheetCloseButton}>
              <Text style={[styles.sheetDoneText, { color: colors.primary[500] }]}>Done</Text>
            </Pressable>
          </View>

          {/* Search Input */}
          <View style={styles.sheetSearchContainer}>
            <View style={[styles.sheetSearchBox, { backgroundColor: isDark ? colors.gray[800] : colors.gray[100] }]}>
              <Ionicons name="search-outline" size={20} color={colors.gray[400]} />
              <BottomSheetTextInput
                placeholder="Search by name or number..."
                placeholderTextColor={colors.gray[400]}
                value={searchQuery}
                onChangeText={setSearchQuery}
                style={[styles.sheetSearchInput, { color: textColor }]}
              />
              {searchQuery.length > 0 && (
                <Pressable onPress={() => setSearchQuery('')}>
                  <Ionicons name="close-circle" size={20} color={colors.gray[400]} />
                </Pressable>
              )}
            </View>
          </View>

          {/* Contacts Count */}
          {hasPermission && !isLoadingContacts && (
            <Text style={[styles.contactsHeader, { color: secondaryTextColor }]}>
              {searchQuery ? `Results (${filteredContacts.length})` : `All Contacts (${contacts.length})`}
            </Text>
          )}

          {/* Permission Denied */}
          {hasPermission === false && (
            <View style={styles.sheetPermissionDenied}>
              <Ionicons name="lock-closed-outline" size={48} color={colors.gray[400]} />
              <Text style={[styles.permissionTitle, { color: textColor }]}>
                Contact Access Required
              </Text>
              <Text style={[styles.permissionText, { color: secondaryTextColor }]}>
                To add members, please allow access to your contacts in Settings.
              </Text>
              <Pressable
                onPress={handleOpenSettings}
                style={[styles.settingsButton, { backgroundColor: colors.primary[500] }]}
              >
                <Text style={styles.settingsButtonText}>Open Settings</Text>
              </Pressable>
            </View>
          )}

          {/* Loading */}
          {isLoadingContacts && hasPermission !== false && (
            <View style={styles.loadingContainer}>
              <Text style={[styles.loadingText, { color: secondaryTextColor }]}>
                Loading contacts...
              </Text>
            </View>
          )}

          {/* Contacts List */}
          {hasPermission && !isLoadingContacts && (
            <BottomSheetFlatList
              data={filteredContacts}
              renderItem={renderContactItem}
              keyExtractor={(item: ContactEntry) => item.id}
              ListEmptyComponent={renderEmptyState}
              contentContainerStyle={styles.sheetListContent}
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
            />
          )}
        </BottomSheet>
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
  // Bottom Sheet Styles
  sheetHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingBottom: 16,
    borderBottomWidth: 1,
  },
  sheetTitle: {
    fontSize: 18,
    fontWeight: '600',
  },
  sheetCloseButton: {
    padding: 4,
  },
  sheetDoneText: {
    fontSize: 16,
    fontWeight: '600',
  },
  sheetSearchContainer: {
    paddingHorizontal: 20,
    paddingVertical: 16,
  },
  sheetSearchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 12,
    gap: 8,
  },
  sheetSearchInput: {
    flex: 1,
    fontSize: 16,
    padding: 0,
  },
  contactsHeader: {
    fontSize: 13,
    fontWeight: '500',
    paddingHorizontal: 20,
    marginBottom: 12,
  },
  sheetListContent: {
    paddingHorizontal: 20,
    paddingBottom: 40,
  },
  sheetPermissionDenied: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 40,
  },
  contactItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 12,
    marginBottom: 8,
    borderWidth: 1,
  },
  contactAvatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  contactAvatarText: {
    color: colors.white,
    fontSize: 14,
    fontWeight: '600',
  },
  contactInfo: {
    flex: 1,
    marginLeft: 12,
  },
  contactName: {
    fontSize: 15,
    fontWeight: '500',
  },
  contactPhone: {
    fontSize: 13,
    marginTop: 2,
  },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxSelected: {
    backgroundColor: colors.primary[500],
  },
  permissionTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginTop: 16,
    marginBottom: 8,
  },
  permissionText: {
    fontSize: 14,
    textAlign: 'center',
    marginBottom: 24,
    lineHeight: 20,
  },
  settingsButton: {
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 12,
  },
  settingsButtonText: {
    color: colors.white,
    fontSize: 16,
    fontWeight: '600',
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingText: {
    fontSize: 14,
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 40,
  },
  emptyStateText: {
    fontSize: 14,
    marginTop: 12,
  },
});

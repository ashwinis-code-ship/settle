import { Ionicons } from '@expo/vector-icons';
import BottomSheet, { BottomSheetFlatList, BottomSheetTextInput } from '@gorhom/bottom-sheet';
import * as Contacts from 'expo-contacts';
import { forwardRef, useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, Linking, Pressable, StyleSheet, Text, TextStyle, View, ViewStyle } from 'react-native';

import { colors } from '@/constants/colors';
import { useColorScheme } from '@/hooks/use-color-scheme';
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

interface ContactItemProps {
    item: ContactEntry;
    isSelected: boolean;
    onToggle: (item: ContactEntry) => void;
    textColor: string;
    secondaryTextColor: string;
    cardBg: string; // Used for item background if needed, or transparent
    isDark: boolean;
    primaryColor: string;
}

const ContactItem = ({
    item,
    isSelected,
    onToggle,
    textColor,
    secondaryTextColor,
    cardBg,
    isDark,
    primaryColor,
}: ContactItemProps) => {
    return (
        <Pressable
            onPress={() => onToggle(item)}
            style={({ pressed }) => [
                styles.contactItem,
                {
                    backgroundColor: isSelected ? colors.primary[50] : 'transparent', // Or cardBg if preferred
                    opacity: pressed ? 0.8 : 1,
                    borderColor: isSelected ? primaryColor : isDark ? colors.gray[700] : colors.gray[200],
                },
            ]}
        >
            <View
                style={[
                    styles.contactAvatar,
                    { backgroundColor: isSelected ? primaryColor : colors.gray[400] },
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

            <View
                style={[
                    styles.checkbox,
                    isSelected && styles.checkboxSelected,
                    { borderColor: isSelected ? primaryColor : colors.gray[400] },
                ]}
            >
                {isSelected && <Ionicons name="checkmark" size={16} color={colors.white} />}
            </View>
        </Pressable>
    );
};

interface ContactPickerSheetProps {
    onContactSelect: (contact: ContactEntry) => void;
    selectedIds?: Set<string>;
    title?: string;
    doneText?: string; // If provided, shows a "Done" button (useful for multi-select flow dismissal)
    onClose?: () => void; // Called when "Done" is pressed or sheet is closed
    onDone?: () => void; // Called specificallly when "Done" button is pressed
}

export const ContactPickerSheet = forwardRef<BottomSheet, ContactPickerSheetProps>(
    ({ onContactSelect, selectedIds, title = 'Add Members', doneText, onClose, onDone }, ref) => {
        const colorScheme = useColorScheme() ?? 'light';
        const isDark = colorScheme === 'dark';

        const snapPoints = useMemo(() => ['90%'], []);
        const [contacts, setContacts] = useState<ContactEntry[]>([]);
        const [hasPermission, setHasPermission] = useState<boolean | null>(null);
        const [isLoadingContacts, setIsLoadingContacts] = useState(false);
        const [searchQuery, setSearchQuery] = useState('');

        // Theme colors
        const textColor = isDark ? colors.text.dark.primary : colors.text.light.primary;
        const secondaryTextColor = isDark ? colors.text.dark.secondary : colors.text.light.secondary;
        const sheetBg = isDark ? colors.gray[900] : colors.white;
        const cardBg = isDark ? colors.gray[800] : colors.white;

        const loadContacts = useCallback(async () => {
            setIsLoadingContacts(true);
            try {
                const { status } = await Contacts.requestPermissionsAsync();
                if (status !== 'granted') {
                    setHasPermission(false);
                    return;
                }
                setHasPermission(true);

                const { data } = await Contacts.getContactsAsync({
                    fields: [Contacts.Fields.Name, Contacts.Fields.PhoneNumbers],
                });

                const flattenedContacts: ContactEntry[] = [];
                data.forEach((contact) => {
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
                console.error('Error loading contacts:', error);
                Alert.alert('Error', 'Failed to load contacts');
            } finally {
                setIsLoadingContacts(false);
            }
        }, []);

        useEffect(() => {
            // Load contacts when the component mounts (improving initial perceived speed later via pre-fetching could be an optimization)
            loadContacts();
        }, [loadContacts]);

        const filteredContacts = useMemo(() => {
            if (!searchQuery.trim()) {
                return contacts;
            }
            const query = searchQuery.toLowerCase().trim();
            return contacts.filter(
                (contact) =>
                    contact.name.toLowerCase().includes(query) || contact.phone.includes(query)
            );
        }, [contacts, searchQuery]);

        const handleOpenSettings = () => {
            Linking.openSettings();
        };

        const handleSheetClose = () => {
            setSearchQuery('');
            onClose?.();
        };

        const handleSelect = (contact: ContactEntry) => {
            onContactSelect(contact);
        };

        const handleDonePress = () => {
            if (onDone) {
                onDone();
            }
            (ref as any)?.current?.close();
        };

        const renderEmptyState = () => (
            <View style={styles.emptyState}>
                <Ionicons name="person-add-outline" size={48} color={colors.gray[400]} />
                <Text style={[styles.emptyStateText, { color: secondaryTextColor }]}>
                    {searchQuery ? 'No contacts found' : 'No contacts available'}
                </Text>
            </View>
        );

        return (
            <BottomSheet
                ref={ref}
                index={-1}
                snapPoints={snapPoints}
                enablePanDownToClose
                enableOverDrag={false}
                enableDynamicSizing={false}
                backgroundStyle={{ backgroundColor: sheetBg }}
                handleIndicatorStyle={{ backgroundColor: colors.gray[400] }}
                onClose={handleSheetClose}
            >
                {/* Header */}
                <View style={[styles.sheetHeader, { borderBottomColor: isDark ? colors.gray[700] : colors.gray[200] }]}>
                    <Text style={[styles.sheetTitle, { color: textColor }]}>{title}</Text>
                    {doneText && (
                        <Pressable onPress={handleDonePress} style={styles.sheetCloseButton}>
                            <Text style={[styles.sheetDoneText, { color: colors.primary[500] }]}>{doneText}</Text>
                        </Pressable>
                    )}
                </View>

                {/* Search */}
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

                {/* Count */}
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
                        <ActivityIndicator size="small" color={colors.primary[500]} />
                        <Text style={[styles.loadingText, { color: secondaryTextColor }]}>
                            Loading contacts...
                        </Text>
                    </View>
                )}

                {/* List */}
                {hasPermission && !isLoadingContacts && (
                    <BottomSheetFlatList
                        data={filteredContacts}
                        renderItem={({ item }: { item: ContactEntry }) => (
                            <ContactItem
                                item={item}
                                isSelected={selectedIds?.has(item.id) || false}
                                onToggle={handleSelect}
                                textColor={textColor}
                                secondaryTextColor={secondaryTextColor}
                                cardBg={cardBg}
                                isDark={isDark}
                                primaryColor={colors.primary[500]}
                            />
                        )}
                        keyExtractor={(item: ContactEntry) => item.id}
                        ListEmptyComponent={renderEmptyState}
                        contentContainerStyle={styles.sheetListContent}
                        showsVerticalScrollIndicator={false}
                        keyboardShouldPersistTaps="handled"
                    />
                )}
            </BottomSheet>
        );
    }
);

const styles = StyleSheet.create({
    sheetHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 20,
        paddingBottom: 16,
        borderBottomWidth: 1,
    } as ViewStyle,
    sheetTitle: {
        fontSize: 18,
        fontWeight: '600',
        flex: 1,
        textAlign: 'center',
        paddingLeft: 40,
    } as TextStyle,
    sheetCloseButton: {
        width: 44,
        alignItems: 'flex-end',
    } as ViewStyle,
    sheetDoneText: {
        fontSize: 16,
        fontWeight: '600',
    } as TextStyle,
    sheetSearchContainer: {
        paddingHorizontal: 20,
        paddingVertical: 16,
    } as ViewStyle,
    sheetSearchBox: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 12,
        paddingVertical: 10,
        borderRadius: 12,
        gap: 8,
    } as ViewStyle,
    sheetSearchInput: {
        flex: 1,
        fontSize: 16,
        padding: 0,
    } as TextStyle,
    contactsHeader: {
        fontSize: 13,
        fontWeight: '500',
        paddingHorizontal: 20,
        marginBottom: 12,
    } as TextStyle,
    sheetListContent: {
        paddingHorizontal: 20,
        paddingBottom: 40,
    } as ViewStyle,
    sheetPermissionDenied: {
        alignItems: 'center',
        justifyContent: 'center',
        padding: 40,
    } as ViewStyle,
    permissionTitle: {
        fontSize: 18,
        fontWeight: '600',
        marginTop: 16,
        marginBottom: 8,
        textAlign: 'center',
    } as TextStyle,
    permissionText: {
        fontSize: 14,
        textAlign: 'center',
        marginBottom: 24,
    } as TextStyle,
    settingsButton: {
        paddingVertical: 12,
        paddingHorizontal: 24,
        borderRadius: 25,
    } as ViewStyle,
    settingsButtonText: {
        color: colors.white,
        fontSize: 16,
        fontWeight: '600',
    } as TextStyle,
    loadingContainer: {
        padding: 40,
        alignItems: 'center',
        justifyContent: 'center',
        gap: 12,
    } as ViewStyle,
    loadingText: {
        fontSize: 14,
    } as TextStyle,
    contactItem: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 12,
        borderRadius: 12,
        marginBottom: 8,
        borderWidth: 1,
    } as ViewStyle,
    contactAvatar: {
        width: 44,
        height: 44,
        borderRadius: 22,
        alignItems: 'center',
        justifyContent: 'center',
    } as ViewStyle,
    contactAvatarText: {
        color: colors.white,
        fontSize: 14,
        fontWeight: '600',
    } as TextStyle,
    contactInfo: {
        flex: 1,
        marginLeft: 12,
    } as ViewStyle,
    contactName: {
        fontSize: 16,
        fontWeight: '500',
    } as TextStyle,
    contactPhone: {
        fontSize: 13,
        marginTop: 2,
    } as TextStyle,
    checkbox: {
        width: 24,
        height: 24,
        borderRadius: 12,
        borderWidth: 2,
        alignItems: 'center',
        justifyContent: 'center',
    } as ViewStyle,
    checkboxSelected: {
        backgroundColor: colors.primary[500],
        borderColor: colors.primary[500],
    } as ViewStyle,
    emptyState: {
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 60,
    } as ViewStyle,
    emptyStateText: {
        marginTop: 16,
        fontSize: 15,
    } as TextStyle,
});

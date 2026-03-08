/**
 * Group Settings Screen
 * 
 * Manage group members and settings
 */

import { Ionicons } from '@expo/vector-icons';
import BottomSheet from '@gorhom/bottom-sheet';
import { router, useLocalSearchParams } from 'expo-router';
import { Avatar } from '@/components/ui/avatar';
import { MotiView } from 'moti';
import { useEffect, useRef, useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    Platform,
    Pressable,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    View,
} from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaView } from 'react-native-safe-area-context';

import { PeopleSearchSheet } from '@/components/people-search-sheet';
import { colors } from '@/constants/colors';
import { useAuth } from '@/contexts/auth-context';
import { useSync } from '@/contexts/sync-context';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useGroup } from '@/hooks/use-group';
import { hapticSuccess, hapticWarning } from '@/lib/haptics';
import {
    pickImageFromCamera,
    pickImageFromLibrary,
    uploadGroupImage,
} from '@/lib/image-upload';
import { formatPhoneNumber } from '@/lib/utils';
import type { EnrichedContact } from '@/hooks/use-enriched-contacts';

export default function GroupSettingsScreen() {
    const { id } = useLocalSearchParams<{ id: string }>();
    const colorScheme = useColorScheme() ?? 'light';
    const isDark = colorScheme === 'dark';
    const { user } = useAuth();
    const { isOnline } = useSync();

    const {
        group,
        isLoading,
        updateGroup,
        addMember,
        removeMember,
        leaveGroup,
        deleteGroup
    } = useGroup(id);

    // Bottom sheet ref
    const bottomSheetRef = useRef<BottomSheet>(null);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [selectedContacts, setSelectedContacts] = useState<EnrichedContact[]>([]);

    // Group info editing
    const [editingName, setEditingName] = useState(false);
    const [nameValue, setNameValue] = useState('');
    const [isSavingName, setIsSavingName] = useState(false);
    const [isUploadingImage, setIsUploadingImage] = useState(false);

    // Theme colors
    const textColor = isDark ? colors.text.dark.primary : colors.text.light.primary;
    const secondaryTextColor = isDark ? colors.text.dark.secondary : colors.text.light.secondary;
    const backgroundColor = isDark ? colors.background.dark : colors.background.light;
    const cardBg = isDark ? colors.gray[800] : colors.white;
    const dangerColor = colors.error;

    const isAdmin = group?.members.find(m => m.user_id === user?.id)?.role === 'admin';

    // Auto-close contact picker sheet when going offline
    useEffect(() => {
        if (!isOnline && bottomSheetRef.current) {
            bottomSheetRef.current.close();
            setSelectedContacts([]); // Clear selection
        }
    }, [isOnline]);

    const handleBack = () => {
        router.back();
    };

    const handleEditNamePress = () => {
        setNameValue(group?.name || '');
        setEditingName(true);
    };

    const handleSaveName = async () => {
        const trimmed = nameValue.trim();
        if (!trimmed || trimmed === group?.name) {
            setEditingName(false);
            return;
        }
        if (trimmed.length < 2) {
            Alert.alert('Invalid Name', 'Group name must be at least 2 characters.');
            return;
        }
        setIsSavingName(true);
        const success = await updateGroup({ name: trimmed });
        setIsSavingName(false);
        if (success) {
            hapticSuccess();
            setEditingName(false);
        } else {
            Alert.alert('Error', 'Failed to update group name.');
        }
    };

    const handleGroupPhotoPress = () => {
        const hasImage = !!group?.image_url;

        const pickAndUpload = async (uri: string) => {
            setIsUploadingImage(true);
            try {
                const result = await uploadGroupImage(uri, id!);
                if (result.success && result.url) {
                    const success = await updateGroup({ image_url: result.url });
                    if (success) hapticSuccess();
                    else Alert.alert('Error', 'Failed to save photo.');
                } else {
                    Alert.alert('Error', 'Failed to upload photo.');
                }
            } finally {
                setIsUploadingImage(false);
            }
        };

        const handleTakePhoto = async () => {
            const uri = await pickImageFromCamera();
            if (uri) pickAndUpload(uri);
        };

        const handleChooseFromLibrary = async () => {
            const uri = await pickImageFromLibrary();
            if (uri) pickAndUpload(uri);
        };

        const handleRemovePhoto = async () => {
            setIsUploadingImage(true);
            const success = await updateGroup({ image_url: null });
            setIsUploadingImage(false);
            if (success) hapticSuccess();
            else Alert.alert('Error', 'Failed to remove photo.');
        };

        if (Platform.OS === 'ios') {
            const options = ['Cancel', 'Take Photo', 'Choose from Library'];
            if (hasImage) options.push('Remove Photo');
            Alert.alert('Group Photo', 'Choose an option', [
                { text: 'Cancel', style: 'cancel' },
                { text: 'Take Photo', onPress: handleTakePhoto },
                { text: 'Choose from Library', onPress: handleChooseFromLibrary },
                ...(hasImage ? [{ text: 'Remove Photo', style: 'destructive' as const, onPress: handleRemovePhoto }] : []),
            ]);
        } else {
            const opts: { text: string; style?: 'cancel' | 'destructive'; onPress?: () => void }[] = [
                { text: 'Take Photo', onPress: handleTakePhoto },
                { text: 'Choose from Library', onPress: handleChooseFromLibrary },
            ];
            if (hasImage) opts.push({ text: 'Remove Photo', style: 'destructive', onPress: handleRemovePhoto });
            Alert.alert('Group Photo', 'Choose an option', [{ text: 'Cancel', style: 'cancel' }, ...opts]);
        }
    };

    const handleAddMemberPress = () => {
        if (!isOnline) {
            hapticWarning();
            Alert.alert(
                'No Connection',
                'Adding members requires an internet connection.',
                [{ text: 'OK' }]
            );
            return;
        }
        bottomSheetRef.current?.expand();
    };

    const handleSelectContact = (contact: EnrichedContact) => {
        setSelectedContacts(prev => {
            const isSelected = prev.some(c => c.id === contact.id);
            if (isSelected) {
                return prev.filter(c => c.id !== contact.id);
            } else {
                return [...prev, contact];
            }
        });
    };

    const handleAddMembers = async () => {
        // Block if offline
        if (!isOnline) {
            hapticWarning();
            Alert.alert(
                'No Connection',
                'Adding members requires an internet connection.',
                [{ text: 'OK' }]
            );
            bottomSheetRef.current?.close();
            return;
        }

        if (selectedContacts.length === 0) {
            bottomSheetRef.current?.close();
            return;
        }

        setIsSubmitting(true);
        let successCount = 0;
        let failCount = 0;

        // Add members sequentially
        for (const contact of selectedContacts) {
            // 1. Sanitize (strip spaces, parens, etc, keep +)
            let phone = formatPhoneNumber(contact.phone);

            // 2. Ensure country code (default to +91 if missing)
            // This maintains existing app behavior around local numbers
            if (!phone.startsWith('+')) {
                phone = `+91${phone.replace(/^0/, '')}`;
            }

            const success = await addMember(phone, contact.name);
            if (success) {
                successCount++;
            } else {
                failCount++;
            }
        }

        setIsSubmitting(false);
        setSelectedContacts([]); // Clear selection

        if (failCount > 0) {
            Alert.alert(
                'Add Members',
                `Added ${successCount} members. Failed to add ${failCount} members (they might already be in the group or have invalid numbers).`
            );
        } else {
            // All success
            // Optional: Show success toast or just close
        }
        bottomSheetRef.current?.close();
    };

    const handleRemoveMember = (memberId: string, memberName: string) => {
        // Pre-check: fast exit before showing the confirmation dialog
        if (!isOnline) {
            hapticWarning();
            Alert.alert(
                'No Connection',
                'Removing members requires an internet connection.',
                [{ text: 'OK' }]
            );
            return;
        }
        Alert.alert(
            'Remove Member',
            `Are you sure you want to remove ${memberName} from the group?`,
            [
                { text: 'Cancel', style: 'cancel' },
                {
                    text: 'Remove',
                    style: 'destructive',
                    onPress: async () => {
                        // Re-check: user may have gone offline while the dialog was open
                        if (!isOnline) {
                            hapticWarning();
                            Alert.alert(
                                'No Connection',
                                'Removing members requires an internet connection.',
                                [{ text: 'OK' }]
                            );
                            return;
                        }
                        setIsSubmitting(true);
                        const success = await removeMember(memberId);
                        setIsSubmitting(false);
                        if (!success) {
                            Alert.alert('Error', 'Failed to remove member');
                        }
                    },
                },
            ]
        );
    };

    const handleLeaveGroup = () => {
        // Pre-check: fast exit before showing the confirmation dialog
        if (!isOnline) {
            hapticWarning();
            Alert.alert(
                'No Connection',
                'Leaving groups requires an internet connection.',
                [{ text: 'OK' }]
            );
            return;
        }
        Alert.alert(
            'Leave Group',
            'Are you sure you want to leave this group?',
            [
                { text: 'Cancel', style: 'cancel' },
                {
                    text: 'Leave',
                    style: 'destructive',
                    onPress: async () => {
                        // Re-check: user may have gone offline while the dialog was open
                        if (!isOnline) {
                            hapticWarning();
                            Alert.alert(
                                'No Connection',
                                'Leaving groups requires an internet connection.',
                                [{ text: 'OK' }]
                            );
                            return;
                        }
                        setIsSubmitting(true);
                        const success = await leaveGroup();
                        setIsSubmitting(false);
                        if (success) {
                            router.dismissAll();
                            router.replace('/(tabs)/groups');
                        } else {
                            Alert.alert('Error', 'Failed to leave group');
                        }
                    },
                },
            ]
        );
    };

    const handleDeleteGroup = () => {
        // Pre-check: fast exit before showing the confirmation dialog
        if (!isOnline) {
            hapticWarning();
            Alert.alert(
                'No Connection',
                'Deleting groups requires an internet connection.',
                [{ text: 'OK' }]
            );
            return;
        }
        Alert.alert(
            'Delete Group',
            'Are you sure you want to delete this group? The group will be hidden but can be restored later if needed.',
            [
                { text: 'Cancel', style: 'cancel' },
                {
                    text: 'Delete',
                    style: 'destructive',
                    onPress: async () => {
                        // Re-check: user may have gone offline while the dialog was open
                        if (!isOnline) {
                            hapticWarning();
                            Alert.alert(
                                'No Connection',
                                'Deleting groups requires an internet connection.',
                                [{ text: 'OK' }]
                            );
                            return;
                        }
                        setIsSubmitting(true);
                        const success = await deleteGroup();
                        setIsSubmitting(false);
                        if (success) {
                            router.dismissAll();
                            router.replace('/(tabs)/groups');
                        } else {
                            Alert.alert('Error', 'Failed to delete group');
                        }
                    },
                },
            ]
        );
    };

    if (isLoading && !group) {
        return (
            <SafeAreaView style={[styles.container, { backgroundColor }]} edges={['top']}>
                <View style={styles.loadingContainer}>
                    <ActivityIndicator size="large" color={colors.primary[500]} />
                </View>
            </SafeAreaView>
        );
    }

    return (
        <GestureHandlerRootView style={{ flex: 1 }}>
            <SafeAreaView style={[styles.container, { backgroundColor }]} edges={['top']}>
                {/* Header */}
                <MotiView
                    from={{ opacity: 0, translateY: -20 }}
                    animate={{ opacity: 1, translateY: 0 }}
                    transition={{ type: 'timing', duration: 400 }}
                    style={[styles.header, { borderBottomColor: isDark ? colors.gray[700] : colors.gray[200] }]}
                >
                    <Pressable onPress={handleBack} style={styles.backButton}>
                        <Ionicons name="arrow-back" size={24} color={textColor} />
                    </Pressable>
                    <Text style={[styles.headerTitle, { color: textColor }]}>Group Settings</Text>
                    <View style={styles.headerRight} />
                </MotiView>

                <ScrollView contentContainerStyle={styles.content}>
                    {/* Group Info Section */}
                    <MotiView
                        from={{ opacity: 0, scale: 0.95 }}
                        animate={{ opacity: 1, scale: 1 }}
                        transition={{ type: 'timing', duration: 500, delay: 50 }}
                    >
                        <Text style={[styles.sectionTitle, { color: textColor }]}>Group Info</Text>
                        <View style={[styles.sectionCard, { backgroundColor: cardBg }]}>
                            <View style={styles.groupInfoRow}>
                                {/* Avatar — tappable for admins only */}
                                {group && (
                                    <Avatar
                                        group={group}
                                        size={72}
                                        mode={isAdmin ? 'edit' : 'default'}
                                        onEditPress={isAdmin ? handleGroupPhotoPress : undefined}
                                        isUploading={isUploadingImage}
                                        disabled={!isOnline}
                                    />
                                )}

                                {/* Name — inline edit for admins, read-only for members */}
                                <View style={styles.groupNameRow}>
                                    {isAdmin ? (
                                        <>
                                            {editingName ? (
                                                <TextInput
                                                    style={[styles.nameInput, { color: textColor, borderBottomColor: colors.primary[500] }]}
                                                    value={nameValue}
                                                    onChangeText={setNameValue}
                                                    autoFocus
                                                    autoCapitalize="words"
                                                    returnKeyType="done"
                                                    onSubmitEditing={handleSaveName}
                                                    maxLength={50}
                                                />
                                            ) : (
                                                <Text style={[styles.groupNameText, { color: textColor }]} numberOfLines={1}>
                                                    {group?.name}
                                                </Text>
                                            )}
                                            {editingName ? (
                                                <View style={styles.nameEditActions}>
                                                    <Pressable onPress={() => setEditingName(false)} style={styles.nameActionBtn}>
                                                        <Ionicons name="close" size={22} color={secondaryTextColor} />
                                                    </Pressable>
                                                    <Pressable onPress={handleSaveName} disabled={isSavingName} style={styles.nameActionBtn}>
                                                        {isSavingName
                                                            ? <ActivityIndicator size="small" color={colors.primary[500]} />
                                                            : <Ionicons name="checkmark" size={22} color={colors.primary[500]} />
                                                        }
                                                    </Pressable>
                                                </View>
                                            ) : (
                                                <Pressable onPress={handleEditNamePress} style={styles.nameActionBtn}>
                                                    <Ionicons name="pencil-outline" size={18} color={secondaryTextColor} />
                                                </Pressable>
                                            )}
                                        </>
                                    ) : (
                                        <Text style={[styles.groupNameText, { color: textColor }]} numberOfLines={1}>
                                            {group?.name}
                                        </Text>
                                    )}
                                </View>
                            </View>
                        </View>
                    </MotiView>

                    {/* Members Section */}
                    <MotiView
                        from={{ opacity: 0, scale: 0.95 }}
                        animate={{ opacity: 1, scale: 1 }}
                        transition={{ type: 'timing', duration: 500, delay: 100 }}
                    >
                        <Text style={[styles.sectionTitle, { color: textColor, marginTop: 24 }]}>Members</Text>
                        <View style={[styles.sectionCard, { backgroundColor: cardBg }]}>
                            {group?.members.map((member, index) => {
                                const isMe = member.user_id === user?.id;
                                const memberName = member.user.name || member.user.phone || 'Unknown';
                                const isOwner = group.created_by === member.user_id;
                                const isMemberAdmin = member.role === 'admin';

                                return (
                                    <MotiView
                                        key={member.id}
                                        from={{ opacity: 0, translateX: -20 }}
                                        animate={{ opacity: 1, translateX: 0 }}
                                        transition={{ type: 'timing', duration: 400, delay: 200 + (index * 50) }}
                                        style={[
                                            styles.memberItem,
                                            index < group.members.length - 1 && { borderBottomWidth: 1, borderBottomColor: isDark ? colors.gray[700] : colors.gray[200] }
                                        ]}
                                    >
                                        <View style={styles.memberInfo}>
                                            <Avatar user={member.user} size={40} style={{ marginRight: 12 }} />
                                            <View style={styles.memberText}>
                                                <Text style={[styles.memberName, { color: textColor }]}>
                                                    {memberName} {isMemberAdmin && <Text style={{ fontSize: 12, color: colors.primary[500] }}>(Admin)</Text>}
                                                </Text>
                                                <Text style={[styles.memberPhone, { color: secondaryTextColor }]}>
                                                    {member.user.phone}
                                                </Text>
                                            </View>
                                        </View>

                                        {isAdmin && !isMe && member.user_id !== group.created_by && (
                                            <Pressable
                                                onPress={() => handleRemoveMember(member.user_id, memberName)}
                                                style={[styles.removeButton, { opacity: (!isOnline || isSubmitting) ? 0.5 : 1 }]}
                                                disabled={isSubmitting || !isOnline}
                                            >
                                                <Ionicons name="trash-outline" size={20} color={dangerColor} />
                                            </Pressable>
                                        )}
                                    </MotiView>
                                );
                            })}

                            {isAdmin && (
                                <Pressable
                                    style={[
                                        styles.addMemberButton,
                                        { opacity: !isOnline ? 0.5 : 1 }
                                    ]}
                                    onPress={handleAddMemberPress}
                                    disabled={!isOnline}
                                >
                                    <Ionicons name="add" size={20} color={colors.primary[500]} />
                                    <Text style={[styles.addMemberText, { color: colors.primary[500] }]}>Add Member</Text>
                                </Pressable>
                            )}
                        </View>
                    </MotiView>

                    {/* Danger Zone */}
                    <Text style={[styles.sectionTitle, { color: dangerColor, marginTop: 24 }]}>Danger Zone</Text>
                    <View style={[styles.sectionCard, { backgroundColor: cardBg }]}>
                        <Pressable
                            style={[
                                styles.dangerAction,
                                { opacity: (!isOnline || isSubmitting) ? 0.5 : 1 }
                            ]}
                            onPress={handleLeaveGroup}
                            disabled={isSubmitting || !isOnline}
                        >
                            <Ionicons name="exit-outline" size={20} color={dangerColor} />
                            <Text style={[styles.dangerText, { color: dangerColor }]}>Leave Group</Text>
                        </Pressable>

                        {isAdmin && (
                            <>
                                <View style={{ height: 1, backgroundColor: isDark ? colors.gray[700] : colors.gray[200] }} />
                                <Pressable
                                    style={[
                                        styles.dangerAction,
                                        { opacity: (!isOnline || isSubmitting) ? 0.5 : 1 }
                                    ]}
                                    onPress={handleDeleteGroup}
                                    disabled={isSubmitting || !isOnline}
                                >
                                    <Ionicons name="trash" size={20} color={dangerColor} />
                                    <Text style={[styles.dangerText, { color: dangerColor }]}>Delete Group</Text>
                                </Pressable>
                            </>
                        )}
                    </View>
                </ScrollView>

                <PeopleSearchSheet
                    ref={bottomSheetRef}
                    onContactSelect={handleSelectContact}
                    selectedIds={new Set(selectedContacts.map(c => c.id))}
                    title="Add Members"
                    doneText={selectedContacts.length > 0 ? `Add (${selectedContacts.length})` : 'Done'}
                    onDone={handleAddMembers}
                    onClose={() => setSelectedContacts([])}
                />

                {/* Global Loading Overlay */}
                {isSubmitting && (
                    <View style={styles.globalLoading}>
                        <ActivityIndicator size="large" color={colors.white} />
                    </View>
                )}
            </SafeAreaView>
        </GestureHandlerRootView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
    },
    loadingContainer: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 16,
        paddingVertical: 12,
        borderBottomWidth: 1,
    },
    backButton: {
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
    content: {
        padding: 16,
    },
    sectionTitle: {
        fontSize: 14,
        fontWeight: '600',
        marginBottom: 8,
        textTransform: 'uppercase',
        marginLeft: 4,
    },
    sectionCard: {
        borderRadius: 12,
        overflow: 'hidden',
    },
    memberItem: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: 16,
    },
    memberInfo: {
        flexDirection: 'row',
        alignItems: 'center',
        flex: 1,
    },
    memberText: {
        flex: 1,
    },
    memberName: {
        fontSize: 16,
        fontWeight: '500',
    },
    memberPhone: {
        fontSize: 14,
    },
    removeButton: {
        padding: 8,
        marginLeft: 8,
    },
    addMemberButton: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 16,
        gap: 8,
    },
    addMemberText: {
        fontSize: 16,
        fontWeight: '600',
    },
    dangerAction: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 16,
        gap: 12,
    },
    dangerText: {
        fontSize: 16,
        fontWeight: '500',
    },
    globalLoading: {
        ...StyleSheet.absoluteFillObject,
        backgroundColor: 'rgba(0,0,0,0.3)',
        alignItems: 'center',
        justifyContent: 'center',
    },
    groupInfoRow: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 20,
        gap: 18,
    },
    groupNameRow: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
    },
    groupNameText: {
        flex: 1,
        fontSize: 22,
        fontWeight: '700',
    },
    nameInput: {
        flex: 1,
        fontSize: 22,
        fontWeight: '700',
        paddingVertical: 2,
        borderBottomWidth: 1.5,
    },
    nameActionBtn: {
        padding: 4,
    },
    nameEditActions: {
        flexDirection: 'row',
        gap: 8,
    },
});

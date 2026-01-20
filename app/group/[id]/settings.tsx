/**
 * Group Settings Screen
 * 
 * Manage group members and settings
 */

import { Ionicons } from '@expo/vector-icons';
import BottomSheet from '@gorhom/bottom-sheet';
import { router, useLocalSearchParams } from 'expo-router';
import { useRef, useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    Pressable,
    ScrollView,
    StyleSheet,
    Text,
    View,
} from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ContactPickerSheet } from '@/components/contact-picker-sheet';
import { colors } from '@/constants/colors';
import { useAuth } from '@/contexts/auth-context';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useGroup } from '@/hooks/use-group';
import { ContactEntry } from '@/types';

export default function GroupSettingsScreen() {
    const { id } = useLocalSearchParams<{ id: string }>();
    const colorScheme = useColorScheme() ?? 'light';
    const isDark = colorScheme === 'dark';
    const { user } = useAuth();

    const {
        group,
        isLoading,
        addMember,
        removeMember,
        leaveGroup,
        deleteGroup
    } = useGroup(id);

    // Bottom sheet ref
    const bottomSheetRef = useRef<BottomSheet>(null);
    const [isSubmitting, setIsSubmitting] = useState(false);

    // Theme colors
    const textColor = isDark ? colors.text.dark.primary : colors.text.light.primary;
    const secondaryTextColor = isDark ? colors.text.dark.secondary : colors.text.light.secondary;
    const backgroundColor = isDark ? colors.background.dark : colors.background.light;
    const cardBg = isDark ? colors.gray[800] : colors.white;
    const dangerColor = colors.error;

    const isAdmin = group?.members.find(m => m.user_id === user?.id)?.role === 'admin';
    const isCreator = group?.created_by === user?.id;

    const handleBack = () => {
        router.back();
    };

    const handleAddMemberPress = () => {
        bottomSheetRef.current?.expand();
    };

    const handleSelectContact = (contact: ContactEntry) => {
        Alert.alert(
            'Add Member',
            `Add ${contact.name} to the group?`,
            [
                { text: 'Cancel', style: 'cancel' },
                {
                    text: 'Add',
                    onPress: async () => {
                        setIsSubmitting(true);
                        let phone = contact.phone;
                        if (!phone.startsWith('+')) {
                            phone = `+91${phone.replace(/^0/, '')}`;
                        }

                        const success = await addMember(phone);
                        setIsSubmitting(false);

                        if (success) {
                            Alert.alert('Success', 'Member added');
                            bottomSheetRef.current?.close();
                        } else {
                            Alert.alert('Error', 'Failed to add member. Make sure they have a registered account.');
                        }
                    }
                }
            ]
        );
    };

    const handleRemoveMember = (memberId: string, memberName: string) => {
        Alert.alert(
            'Remove Member',
            `Are you sure you want to remove ${memberName} from the group?`,
            [
                { text: 'Cancel', style: 'cancel' },
                {
                    text: 'Remove',
                    style: 'destructive',
                    onPress: async () => {
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
        Alert.alert(
            'Leave Group',
            'Are you sure you want to leave this group?',
            [
                { text: 'Cancel', style: 'cancel' },
                {
                    text: 'Leave',
                    style: 'destructive',
                    onPress: async () => {
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
        Alert.alert(
            'Delete Group',
            'Are you sure you want to delete this group? This action cannot be undone and all expenses will be lost.',
            [
                { text: 'Cancel', style: 'cancel' },
                {
                    text: 'Delete',
                    style: 'destructive',
                    onPress: async () => {
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
                <View style={[styles.header, { borderBottomColor: isDark ? colors.gray[700] : colors.gray[200] }]}>
                    <Pressable onPress={handleBack} style={styles.backButton}>
                        <Ionicons name="arrow-back" size={24} color={textColor} />
                    </Pressable>
                    <Text style={[styles.headerTitle, { color: textColor }]}>Group Settings</Text>
                    <View style={styles.headerRight} />
                </View>

                <ScrollView contentContainerStyle={styles.content}>
                    {/* Members Section */}
                    <Text style={[styles.sectionTitle, { color: textColor }]}>Members</Text>
                    <View style={[styles.sectionCard, { backgroundColor: cardBg }]}>
                        {group?.members.map((member, index) => {
                            const isMe = member.user_id === user?.id;
                            const memberName = isMe ? 'You' : member.user.name || member.user.phone || 'Unknown';
                            const isOwner = group.created_by === member.user_id;

                            return (
                                <View
                                    key={member.id}
                                    style={[
                                        styles.memberItem,
                                        index < group.members.length - 1 && { borderBottomWidth: 1, borderBottomColor: isDark ? colors.gray[700] : colors.gray[200] }
                                    ]}
                                >
                                    <View style={styles.memberInfo}>
                                        <View style={[styles.avatar, { backgroundColor: isMe ? colors.primary[500] : colors.gray[400] }]}>
                                            <Text style={styles.avatarText}>{memberName.substring(0, 1).toUpperCase()}</Text>
                                        </View>
                                        <View style={styles.memberText}>
                                            <Text style={[styles.memberName, { color: textColor }]}>
                                                {memberName} {isOwner && <Text style={{ fontSize: 12, color: colors.primary[500] }}>(Admin)</Text>}
                                            </Text>
                                            <Text style={[styles.memberPhone, { color: secondaryTextColor }]}>
                                                {member.user.phone}
                                            </Text>
                                        </View>
                                    </View>

                                    {isAdmin && !isMe && member.user_id !== group.created_by && (
                                        <Pressable
                                            onPress={() => handleRemoveMember(member.user_id, memberName)}
                                            style={styles.removeButton}
                                            disabled={isSubmitting}
                                        >
                                            <Ionicons name="trash-outline" size={20} color={dangerColor} />
                                        </Pressable>
                                    )}
                                </View>
                            );
                        })}

                        {isAdmin && (
                            <Pressable
                                style={styles.addMemberButton}
                                onPress={handleAddMemberPress}
                            >
                                <Ionicons name="add" size={20} color={colors.primary[500]} />
                                <Text style={[styles.addMemberText, { color: colors.primary[500] }]}>Add Member</Text>
                            </Pressable>
                        )}
                    </View>

                    {/* Danger Zone */}
                    <Text style={[styles.sectionTitle, { color: dangerColor, marginTop: 24 }]}>Danger Zone</Text>
                    <View style={[styles.sectionCard, { backgroundColor: cardBg }]}>
                        <Pressable
                            style={styles.dangerAction}
                            onPress={handleLeaveGroup}
                            disabled={isSubmitting}
                        >
                            <Ionicons name="exit-outline" size={20} color={dangerColor} />
                            <Text style={[styles.dangerText, { color: dangerColor }]}>Leave Group</Text>
                        </Pressable>

                        {isCreator && (
                            <>
                                <View style={{ height: 1, backgroundColor: isDark ? colors.gray[700] : colors.gray[200] }} />
                                <Pressable
                                    style={styles.dangerAction}
                                    onPress={handleDeleteGroup}
                                    disabled={isSubmitting}
                                >
                                    <Ionicons name="trash" size={20} color={dangerColor} />
                                    <Text style={[styles.dangerText, { color: dangerColor }]}>Delete Group</Text>
                                </Pressable>
                            </>
                        )}
                    </View>
                </ScrollView>

                <ContactPickerSheet
                    ref={bottomSheetRef}
                    onContactSelect={handleSelectContact}
                    title="Add Members"
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
    avatar: {
        width: 40,
        height: 40,
        borderRadius: 20,
        alignItems: 'center',
        justifyContent: 'center',
        marginRight: 12,
    },
    avatarText: {
        color: 'white',
        fontWeight: '600',
        fontSize: 16,
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
});

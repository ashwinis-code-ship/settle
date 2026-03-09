/**
 * Add Expense Screen
 * 
 * Create a new expense in a group or with a friend (1:1).
 * Supports split types: equal_all, equal_selected
 * 
 * Modes:
 * - groupId provided: Add expense to an existing group (static display)
 * - friendId + friendName: Add expense with a friend (static display, auto-creates 1:1 group)
 * - No params: Search mode - user can search groups or contacts
 */

import { Ionicons } from '@expo/vector-icons';
import BottomSheet from '@gorhom/bottom-sheet';
import { router, useLocalSearchParams } from 'expo-router';
import { MotiView } from 'moti';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
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
import { Avatar } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { colors } from '@/constants/colors';
import { useAuth } from '@/contexts/auth-context';
import { useSync } from '@/contexts/sync-context';
import { useCategories } from '@/hooks/use-categories';
import { useColorScheme } from '@/hooks/use-color-scheme';
import type { SearchResultGroup } from '@/hooks/use-contact-group-search';
import { useDirectGroup } from '@/hooks/use-direct-group';
import type { EnrichedContact } from '@/hooks/use-enriched-contacts';
import { normalizePhone } from '@/hooks/use-enriched-contacts';
import { useExpenses } from '@/hooks/use-expenses';
import { useGroup } from '@/hooks/use-group';
import { Analytics } from '@/lib/analytics';
import { EXPENSE_EVENTS } from '@/lib/analytics-events';
import { hapticSelection, hapticSuccess, hapticWarning } from '@/lib/haptics';
import { supabase } from '@/lib/supabase';
import type { CurrencyCode, DbCategory, ExpenseFormData, GroupMember, SplitType } from '@/types';
import { CURRENCIES } from '@/types/database';

export default function AddExpenseScreen() {
  const params = useLocalSearchParams<{ 
    groupId?: string; 
    friendId?: string; 
    friendName?: string;
    contactsOnly?: string;
  }>();
  const colorScheme = useColorScheme() ?? 'light';
  const isDark = colorScheme === 'dark';
  const { user } = useAuth();
  const { isOnline } = useSync();

  // Determine mode: group expense, 1:1 with friend, or search mode
  const hasPreselection = !!params.groupId || !!params.friendId;
  const isDirectExpense = !!params.friendId && !params.groupId;
  const isSearchMode = !hasPreselection;
  const contactsOnly = params.contactsOnly === 'true';
  
  const [resolvedGroupId, setResolvedGroupId] = useState<string | undefined>(params.groupId);
  const [selectedFriendId, setSelectedFriendId] = useState<string | undefined>(params.friendId);
  const [selectedFriendName, setSelectedFriendName] = useState<string | undefined>(params.friendName);
  const [selectedFriendPhone, setSelectedFriendPhone] = useState<string | undefined>();

  const { group, isLoading: isLoadingGroup } = useGroup(resolvedGroupId);
  const { categories } = useCategories();
  const { createExpense } = useExpenses(resolvedGroupId);
  const { findOrCreateDirectGroup, isLoading: isCreatingDirectGroup } = useDirectGroup();
  // Block if offline - view-only mode
  useEffect(() => {
    if (!isOnline) {
      Alert.alert(
        'No Connection',
        'Adding expenses requires an internet connection.',
        [{ text: 'OK', onPress: () => router.back() }]
      );
    }
  }, [isOnline]);

  // Track screen view and add expense started
  useEffect(() => {
    const entryPoint = params.groupId ? 'group' : params.friendId ? 'friend' : contactsOnly ? 'friends_tab' : 'home';
    Analytics.trackScreen('add_expense', { entry_point: entryPoint });
    Analytics.track(EXPENSE_EVENTS.ADD_EXPENSE_STARTED, {
      entry_point: entryPoint,
      has_preselection: hasPreselection,
      is_direct_expense: isDirectExpense,
    });
  }, []);

  // Search UI state
  const [hasSelectedTarget, setHasSelectedTarget] = useState(hasPreselection);
  const [isCreatingShadowUser, setIsCreatingShadowUser] = useState(false);

  // Bottom sheet for people search
  const bottomSheetRef = useRef<BottomSheet>(null);
  // Track selection in a ref so the sheet close handler doesn't close stale over it
  const hasSelectedTargetRef = useRef(hasPreselection);
  useEffect(() => { hasSelectedTargetRef.current = hasSelectedTarget; }, [hasSelectedTarget]);

  // Auto-open the sheet when landing in search mode
  useEffect(() => {
    if (isSearchMode) {
      const timer = setTimeout(() => bottomSheetRef.current?.expand(), 150);
      return () => clearTimeout(timer);
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Form state
  const [description, setDescription] = useState('');
  const [amount, setAmount] = useState('');
  const [currency, setCurrency] = useState<CurrencyCode>('INR');
  const [selectedCategory, setSelectedCategory] = useState<DbCategory | null>(null);
  const [paidBy, setPaidBy] = useState<string>('');
  const [splitType] = useState<SplitType>('equal_selected');
  const [splitBetween, setSplitBetween] = useState<string[]>([]);
  const [notes, setNotes] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  // UI state
  const [showCategoryPicker, setShowCategoryPicker] = useState(false);
  const [showCurrencyPicker, setShowCurrencyPicker] = useState(false);
  const [showPaidByPicker, setShowPaidByPicker] = useState(false);

  // Theme colors
  const textColor = isDark ? colors.text.dark.primary : colors.text.light.primary;
  const secondaryTextColor = isDark ? colors.text.dark.secondary : colors.text.light.secondary;
  const backgroundColor = isDark ? colors.background.dark : colors.background.light;
  const cardBg = isDark ? colors.gray[800] : colors.white;
  const borderColor = isDark ? colors.gray[700] : colors.gray[200];

  // Group selected from sheet
  const handleSelectGroup = useCallback((group: SearchResultGroup) => {
    setHasSelectedTarget(true);
    Analytics.track(EXPENSE_EVENTS.ADD_EXPENSE_GROUP_SELECTED, { group_id: group.id });
    setResolvedGroupId(group.id);
    setSelectedFriendId(undefined);
    setSelectedFriendName(undefined);
  }, []);

  // Contact selected from sheet — create shadow user when needed
  const handleSelectContact = useCallback(async (contact: EnrichedContact) => {
    setHasSelectedTarget(true);
    Analytics.track(EXPENSE_EVENTS.ADD_EXPENSE_CONTACT_SELECTED, {
      is_existing_user: !!contact.userId,
    });
    setSelectedFriendName(contact.name);
    setSelectedFriendPhone(contact.phone);

    if (contact.userId) {
      setSelectedFriendId(contact.userId);
    } else {
      setIsCreatingShadowUser(true);
      try {
        const normalizedPhone = normalizePhone(contact.phone);

        const { data: existingUser } = await supabase
          .from('users')
          .select('id')
          .eq('phone', normalizedPhone)
          .single() as { data: { id: string } | null };

        if (existingUser) {
          setSelectedFriendId(existingUser.id);
        } else {
          const { data: shadowUser, error: shadowError } = await supabase
            .from('users')
            .insert({ phone: normalizedPhone, name: contact.name, is_registered: false } as any)
            .select('id')
            .single() as { data: { id: string } | null; error: any };

          if (shadowError) {
            console.error('Failed to create shadow user:', shadowError);
            const { data: retryUser } = await supabase
              .from('users')
              .select('id')
              .eq('phone', normalizedPhone)
              .single() as { data: { id: string } | null };
            setSelectedFriendId(retryUser?.id ?? undefined);
          } else {
            setSelectedFriendId(shadowUser?.id);
          }
        }
      } finally {
        setIsCreatingShadowUser(false);
      }
    }
  }, []);

  // Clear selection — re-opens the sheet in search mode
  const handleClearSelection = useCallback(() => {
    setHasSelectedTarget(false);
    setResolvedGroupId(undefined);
    setSelectedFriendId(undefined);
    setSelectedFriendName(undefined);
    setSelectedFriendPhone(undefined);
    setSplitBetween([]);
    if (isSearchMode) {
      setTimeout(() => bottomSheetRef.current?.expand(), 100);
    }
  }, [isSearchMode]);

  // Handle direct expense: find or create 1:1 group
  useEffect(() => {
    const setupDirectGroup = async () => {
      const friendId = selectedFriendId || params.friendId;
      if (friendId && user && hasSelectedTarget && !resolvedGroupId) {
        const directGroupId = await findOrCreateDirectGroup(friendId);
        if (directGroupId) {
          setResolvedGroupId(directGroupId);
        }
      }
    };
    setupDirectGroup();
  }, [selectedFriendId, params.friendId, user, findOrCreateDirectGroup, hasSelectedTarget, resolvedGroupId]);

  // Initialize form with group defaults
  useEffect(() => {
    if (group) {
      setCurrency(group.currency);
      if (user) {
        setPaidBy(user.id);
        // Initialize split with all members
        const memberIds = group.members.map((m) => m.user_id);
        setSplitBetween(memberIds);
      }
    } else if (hasSelectedTarget && user) {
      // For direct expense, set up paidBy (always the current user initially)
      setPaidBy(user.id);
      
      // Set up split between user and friend (if we have a friendId)
      const friendId = selectedFriendId || params.friendId;
      if (friendId) {
        setSplitBetween([user.id, friendId]);
      } else if (selectedFriendPhone) {
        // Contact selected but no userId yet - will be created on submit
        // For now, just set the current user in the split
        // The friend will be added to split after shadow user creation
        setSplitBetween([user.id]);
      }
    }
  }, [group, user, hasSelectedTarget, selectedFriendId, selectedFriendPhone, params.friendId]);

  // Get member info by ID
  const getMember = useCallback((userId: string): GroupMember | undefined => {
    return group?.members.find((m) => m.user_id === userId);
  }, [group]);

  // Calculate split amounts
  const splitAmounts = useMemo(() => {
    const total = parseFloat(amount) || 0;
    if (total <= 0 || splitBetween.length === 0) return {};

    const perPerson = total / splitBetween.length;
    const result: Record<string, number> = {};
    splitBetween.forEach((userId) => {
      result[userId] = Math.round(perPerson * 100) / 100;
    });
    return result;
  }, [amount, splitBetween]);

  const handleBack = () => {
    router.back();
  };

  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!hasSelectedTarget) {
      newErrors.target = 'Select a group or contact';
    }

    if (!description.trim()) {
      newErrors.description = 'Description is required';
    }

    const amountNum = parseFloat(amount);
    if (!amount || isNaN(amountNum) || amountNum <= 0) {
      newErrors.amount = 'Enter a valid amount';
    }

    if (!paidBy) {
      newErrors.paidBy = 'Select who paid';
    }

    if (splitBetween.length === 0) {
      newErrors.split = 'Select at least one person to split with';
    } else if (splitBetween.length === 1 && splitBetween[0] === paidBy) {
      newErrors.split = 'The person who paid cannot be the only one in the split';
    }

    setErrors(newErrors);
    const isValid = Object.keys(newErrors).length === 0;
    if (!isValid) {
      hapticWarning();
    }
    return isValid;
  };

  const handleSubmit = async () => {
    if (!validateForm()) return;

    setIsSubmitting(true);

    // If we have a contact without userId, we need to create shadow user first
    let actualFriendId = selectedFriendId;
    if (!resolvedGroupId && selectedFriendPhone && !actualFriendId && user) {
      const normalizedPhone = normalizePhone(selectedFriendPhone);

      // Check if user exists
      const { data: existingUser } = await supabase
        .from('users')
        .select('id')
        .eq('phone', normalizedPhone)
        .single() as { data: { id: string } | null };

      if (existingUser) {
        actualFriendId = existingUser.id;
      } else {
        // Create shadow user
        const { data: shadowUser, error: shadowError } = await supabase
          .from('users')
          .insert({
            phone: normalizedPhone,
            name: selectedFriendName || 'Unknown',
            is_registered: false,
          } as any)
          .select('id')
          .single() as { data: { id: string } | null; error: any };

        if (shadowError || !shadowUser) {
          console.error('Failed to create shadow user:', shadowError);
          setErrors({ form: 'Failed to add contact. Please try again.' });
          setIsSubmitting(false);
          return;
        }
        actualFriendId = shadowUser.id;
      }

      if (!actualFriendId) {
        setErrors({ form: 'Failed to find or create contact. Please try again.' });
        setIsSubmitting(false);
        return;
      }

      // Now create the direct group
      const directGroupId = await findOrCreateDirectGroup(actualFriendId);
      if (!directGroupId) {
        setErrors({ form: 'Failed to create expense. Please try again.' });
        setIsSubmitting(false);
        return;
      }
      
      // Create expense directly with the new groupId and proper split
      // (Don't rely on React state which is async)
      const formData: ExpenseFormData = {
        description: description.trim(),
        amount,
        currency,
        category_id: selectedCategory?.id || null,
        paid_by: paidBy || user.id,
        split_type: 'equal_selected',
        split_between: [user.id, actualFriendId],
        notes: notes.trim(),
        expense_date: new Date(),
      };

      const expenseId = await createExpense(formData, directGroupId);
      setIsSubmitting(false);

      if (expenseId) {
        Analytics.track(EXPENSE_EVENTS.ADD_EXPENSE_COMPLETED, {
          expense_id: expenseId,
          amount: parseFloat(amount),
          currency: currency,
          category_id: selectedCategory?.id,
          category_name: selectedCategory?.name,
          split_type: 'equal_selected',
          member_count: 2,
          is_group_expense: false,
          has_notes: notes.trim().length > 0,
        });
        hapticSuccess();
        router.back();
      } else {
        Analytics.track(EXPENSE_EVENTS.ADD_EXPENSE_FAILED, { error_stage: 'submission' });
        setErrors({ form: 'Failed to create expense. Please try again.' });
      }
      return;
    }

    // Normal flow - groupId already resolved
    const formData: ExpenseFormData = {
      description: description.trim(),
      amount,
      currency,
      category_id: selectedCategory?.id || null,
      paid_by: paidBy,
      split_type: splitType,
      split_between: splitBetween,
      notes: notes.trim(),
      expense_date: new Date(),
    };

    const expenseId = await createExpense(formData, resolvedGroupId);
    setIsSubmitting(false);

    if (expenseId) {
      Analytics.track(EXPENSE_EVENTS.ADD_EXPENSE_COMPLETED, {
        expense_id: expenseId,
        amount: parseFloat(amount),
        currency: currency,
        category_id: selectedCategory?.id,
        category_name: selectedCategory?.name,
        split_type: splitType,
        member_count: splitBetween.length,
        is_group_expense: true,
        has_notes: notes.trim().length > 0,
      });
      hapticSuccess();
      router.back();
    } else {
      Analytics.track(EXPENSE_EVENTS.ADD_EXPENSE_FAILED, { error_stage: 'submission' });
    }
  };

  const toggleMemberInSplit = (userId: string) => {
    setSplitBetween((prev) => {
      if (prev.includes(userId)) {
        // Trying to deselect
        const newList = prev.filter((id) => id !== userId);
        
        // Rule 1: At least one person must be in the split
        if (newList.length === 0) {
          hapticWarning();
          return prev; // Don't allow
        }
        
        // Rule 2: If only one person remains, they can't be the payer
        if (newList.length === 1 && newList[0] === paidBy) {
          hapticWarning();
          return prev; // Don't allow
        }
        
        hapticSelection();
        return newList;
      }
      hapticSelection();
      return [...prev, userId];
    });
  };


  // Show loading while setting up group (either loading existing or creating direct)
  // In search mode, don't show loading until user has selected something
  const isSettingUp = hasSelectedTarget && (isLoadingGroup || isCreatingDirectGroup || isCreatingShadowUser || (selectedFriendId && !resolvedGroupId));
  
  if (isSettingUp) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor }]} edges={['top']}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary[500]} />
          <Text style={[styles.loadingText, { color: secondaryTextColor }]}>
            Setting up...
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  // Only show error if we have a preselection but group not found
  if (hasPreselection && !group && !isDirectExpense && !isSearchMode) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor }]} edges={['top']}>
        <View style={styles.errorContainer}>
          <Ionicons name="alert-circle" size={48} color={colors.error} />
          <Text style={[styles.errorText, { color: textColor }]}>Group not found</Text>
          <Button title="Go Back" onPress={handleBack} style={{ marginTop: 16 }} />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <GestureHandlerRootView style={styles.flex}>
    <SafeAreaView style={[styles.container, { backgroundColor }]} edges={['top']}>
      {/* Header */}
      <MotiView
        from={{ opacity: 0, translateY: -20 }}
        animate={{ opacity: 1, translateY: 0 }}
        transition={{ type: 'timing', duration: 300 }}
        style={[styles.header, { borderBottomColor: borderColor }]}
      >
        <Pressable
          onPress={handleBack}
          style={({ pressed }) => [styles.headerButton, { opacity: pressed ? 0.6 : 1, transform: [{ scale: pressed ? 0.88 : 1 }] }]}
        >
          <Ionicons name="close" size={24} color={textColor} />
        </Pressable>
        <Text style={[styles.headerTitle, { color: textColor }]}>Add Expense</Text>
        <View style={styles.headerButton} />
      </MotiView>

      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        {/* Main Form ScrollView - only shown when target is selected */}
        {(hasPreselection || hasSelectedTarget) && (
        <ScrollView
          style={styles.flex}
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* Group/Contact Selector */}
          <MotiView
            from={{ opacity: 0, translateY: 10 }}
            animate={{ opacity: 1, translateY: 0 }}
            transition={{ type: 'timing', duration: 300, delay: 50 }}
          >
            {/* Selected Target: Show static display with clear button */}
            {(hasPreselection || hasSelectedTarget) && (
              <View style={[styles.groupInfo, { backgroundColor: cardBg }]}>
                <View style={[
                  styles.groupIcon, 
                  { backgroundColor: (selectedFriendId || selectedFriendName || isDirectExpense) ? colors.success : colors.primary[500] }
                ]}>
                  <Ionicons 
                    name={(selectedFriendId || selectedFriendName || isDirectExpense) ? 'person' : 'people'} 
                    size={20} 
                    color={colors.white} 
                  />
                </View>
                <Text style={[styles.groupName, { color: textColor }]} numberOfLines={1}>
                  {selectedFriendName 
                    ? `With ${selectedFriendName}` 
                    : isDirectExpense 
                      ? `With ${params.friendName || 'Friend'}` 
                      : group?.name || 'Loading...'}
                </Text>
                {/* Clear button for search mode selections */}
                {isSearchMode && hasSelectedTarget && (
                  <Pressable
                    onPress={handleClearSelection}
                    style={({ pressed }) => [styles.clearButton, { opacity: pressed ? 0.6 : 1, transform: [{ scale: pressed ? 0.88 : 1 }] }]}
                  >
                    <Ionicons name="close-circle" size={22} color={secondaryTextColor} />
                  </Pressable>
                )}
              </View>
            )}
          </MotiView>

          {/* Rest of form - only show when target is selected */}
          {(hasPreselection || hasSelectedTarget) && (
            <>
              {/* Amount Input */}
              <MotiView
                from={{ opacity: 0, translateY: 10 }}
                animate={{ opacity: 1, translateY: 0 }}
                transition={{ type: 'timing', duration: 300, delay: 100 }}
                style={[styles.amountContainer, { backgroundColor: cardBg }]}
              >
                <Pressable
                  onPress={() => setShowCurrencyPicker(!showCurrencyPicker)}
                  style={({ pressed }) => [styles.currencyButton, { opacity: pressed ? 0.7 : 1, transform: [{ scale: pressed ? 0.92 : 1 }] }]}
                >
                  <Text style={[styles.currencySymbol, { color: colors.primary[500] }]}>
                    {CURRENCIES[currency].symbol}
                  </Text>
                  <Ionicons name="chevron-down" size={16} color={secondaryTextColor} />
                </Pressable>
                <TextInput
                  style={[styles.amountInput, { color: textColor }]}
                  placeholder="0.00"
                  placeholderTextColor={colors.gray[400]}
                  value={amount}
              onChangeText={setAmount}
              keyboardType="decimal-pad"
              autoFocus
            />
          </MotiView>

          {/* Currency Picker */}
          {showCurrencyPicker && (
            <MotiView
              from={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              style={[styles.pickerContainer, { backgroundColor: cardBg }]}
            >
              {Object.entries(CURRENCIES).map(([code, { symbol, name }]) => (
                <Pressable
                  key={code}
                  style={[
                    styles.pickerItem,
                    currency === code && { backgroundColor: colors.primary[50] },
                  ]}
                  onPress={() => {
                    setCurrency(code as CurrencyCode);
                    setShowCurrencyPicker(false);
                  }}
                >
                  <Text style={[styles.pickerItemText, { color: textColor }]}>
                    {symbol} {code} - {name}
                  </Text>
                  {currency === code && (
                    <Ionicons name="checkmark" size={20} color={colors.primary[500]} />
                  )}
                </Pressable>
              ))}
            </MotiView>
          )}

          {errors.amount && (
            <Text style={styles.errorMessage}>{errors.amount}</Text>
          )}

          {/* Description Input */}
          <MotiView
            from={{ opacity: 0, translateY: 10 }}
            animate={{ opacity: 1, translateY: 0 }}
            transition={{ type: 'timing', duration: 300, delay: 150 }}
          >
            <Input
              label="Description"
              placeholder="What's this expense for?"
              value={description}
              onChangeText={setDescription}
              error={errors.description}
              leftIcon={
                <Ionicons
                  name="document-text-outline"
                  size={20}
                  color={isDark ? colors.gray[400] : colors.gray[500]}
                />
              }
            />
          </MotiView>

          {/* Category Picker */}
          <MotiView
            from={{ opacity: 0, translateY: 10 }}
            animate={{ opacity: 1, translateY: 0 }}
            transition={{ type: 'timing', duration: 300, delay: 200 }}
            style={styles.section}
          >
            <Text style={[styles.sectionLabel, { color: secondaryTextColor }]}>Category</Text>
            <Pressable
              onPress={() => setShowCategoryPicker(!showCategoryPicker)}
              style={[styles.selectorButton, { backgroundColor: cardBg, borderColor }]}
            >
              {selectedCategory ? (
                <View style={styles.selectedCategory}>
                  <View style={[styles.categoryIcon, { backgroundColor: selectedCategory.color + '20' }]}>
                    <Text style={styles.categoryEmoji}>{selectedCategory.icon}</Text>
                  </View>
                  <Text style={[styles.selectorText, { color: textColor }]}>
                    {selectedCategory.name}
                  </Text>
                </View>
              ) : (
                <Text style={[styles.selectorPlaceholder, { color: secondaryTextColor }]}>
                  Select a category
                </Text>
              )}
              <Ionicons name="chevron-down" size={20} color={secondaryTextColor} />
            </Pressable>

            {showCategoryPicker && (
              <MotiView
                from={{ opacity: 0, scaleY: 0.9 }}
                animate={{ opacity: 1, scaleY: 1 }}
                style={[styles.categoryGrid, { backgroundColor: cardBg }]}
              >
                {categories.map((category) => (
                  <Pressable
                    key={category.id}
                    style={({ pressed }) => [
                      styles.categoryItem,
                      selectedCategory?.id === category.id && {
                        backgroundColor: category.color + '20',
                        borderColor: category.color,
                      },
                      { opacity: pressed ? 0.75 : 1, transform: [{ scale: pressed ? 0.93 : 1 }] },
                    ]}
                    onPress={() => {
                      hapticSelection();
                      setSelectedCategory(category);
                      setShowCategoryPicker(false);
                    }}
                  >
                    <Text style={styles.categoryItemEmoji}>{category.icon}</Text>
                    <Text
                      style={[
                        styles.categoryItemText,
                        { color: selectedCategory?.id === category.id ? category.color : textColor },
                      ]}
                      numberOfLines={1}
                    >
                      {category.name}
                    </Text>
                  </Pressable>
                ))}
              </MotiView>
            )}
          </MotiView>

          {/* Paid By */}
          <MotiView
            from={{ opacity: 0, translateY: 10 }}
            animate={{ opacity: 1, translateY: 0 }}
            transition={{ type: 'timing', duration: 300, delay: 250 }}
            style={styles.section}
          >
            <Text style={[styles.sectionLabel, { color: secondaryTextColor }]}>Paid by</Text>
            <Pressable
              onPress={() => setShowPaidByPicker(!showPaidByPicker)}
              style={[styles.selectorButton, { backgroundColor: cardBg, borderColor }]}
            >
              {paidBy ? (
                <View style={styles.selectedMember}>
                  {getMember(paidBy) && (
                    <Avatar user={getMember(paidBy)!.user} size={32} style={{ marginRight: 10 }} />
                  )}
                  <Text style={[styles.selectorText, { color: textColor }]}>
                    {paidBy === user?.id ? 'You' : getMember(paidBy)?.user.name || 'Unknown'}
                  </Text>
                </View>
              ) : (
                <Text style={[styles.selectorPlaceholder, { color: secondaryTextColor }]}>
                  Who paid?
                </Text>
              )}
              <Ionicons name="chevron-down" size={20} color={secondaryTextColor} />
            </Pressable>

            {showPaidByPicker && group && (
              <MotiView
                from={{ opacity: 0, scaleY: 0.9 }}
                animate={{ opacity: 1, scaleY: 1 }}
                style={[styles.memberList, { backgroundColor: cardBg }]}
              >
                {group.members.map((member) => (
                  <Pressable
                    key={member.user_id}
                    style={({ pressed }) => [
                      styles.memberItem,
                      paidBy === member.user_id && { backgroundColor: colors.primary[50] },
                      { opacity: pressed ? 0.8 : 1, transform: [{ scale: pressed ? 0.98 : 1 }] },
                    ]}
                    onPress={() => {
                      setPaidBy(member.user_id);
                      setShowPaidByPicker(false);
                    }}
                  >
                    <Avatar user={member.user} size={32} style={{ marginRight: 10 }} />
                    <Text style={[styles.memberName, { color: textColor }]}>
                      {member.user_id === user?.id ? 'You' : member.user.name}
                    </Text>
                    {paidBy === member.user_id && (
                      <Ionicons name="checkmark" size={20} color={colors.primary[500]} />
                    )}
                  </Pressable>
                ))}
              </MotiView>
            )}
            {errors.paidBy && <Text style={styles.errorMessage}>{errors.paidBy}</Text>}
          </MotiView>

          {/* Member Selection for Split */}
          <MotiView
            from={{ opacity: 0, translateY: 10 }}
            animate={{ opacity: 1, translateY: 0 }}
            transition={{ type: 'timing', duration: 300, delay: 350 }}
            style={styles.section}
          >
            <Text style={[styles.sectionLabel, { color: secondaryTextColor }]}>
              Split between ({splitBetween.length} {splitBetween.length === 1 ? 'person' : 'people'})
            </Text>
            <View style={[styles.splitMemberList, { backgroundColor: cardBg }]}>
              {(group?.members || []).map((member) => {
                const isSelected = splitBetween.includes(member.user_id);
                const splitAmount = splitAmounts[member.user_id];

                return (
                  <Pressable
                    key={member.user_id}
                    style={({ pressed }) => [
                      styles.splitMemberItem,
                      { borderBottomColor: borderColor },
                      { transform: [{ scale: pressed ? 0.98 : 1 }] },
                    ]}
                    onPress={() => toggleMemberInSplit(member.user_id)}
                  >
                    <View style={styles.splitMemberInfo}>
                      <Avatar user={member.user} size={32} style={{ marginRight: 10 }} />
                      <Text style={[styles.memberName, { color: textColor }]}>
                        {member.user_id === user?.id ? 'You' : member.user.name}
                      </Text>
                    </View>
                    <View style={styles.splitMemberRight}>
                      {isSelected && splitAmount > 0 && (
                        <Text style={[styles.splitAmount, { color: secondaryTextColor }]}>
                          {CURRENCIES[currency].symbol}{splitAmount.toFixed(2)}
                        </Text>
                      )}
                      <MotiView
                        animate={{
                          backgroundColor: isSelected ? colors.primary[500] : 'transparent',
                          borderColor: isSelected ? colors.primary[500] : borderColor,
                          scale: isSelected ? 1 : 1,
                        }}
                        transition={{ type: 'spring', damping: 18, stiffness: 280 }}
                        style={[styles.checkbox, { borderColor }]}
                      >
                        <MotiView
                          animate={{ scale: isSelected ? 1 : 0, opacity: isSelected ? 1 : 0 }}
                          transition={{ type: 'spring', damping: 15, stiffness: 280 }}
                        >
                          <Ionicons name="checkmark" size={14} color={colors.white} />
                        </MotiView>
                      </MotiView>
                    </View>
                  </Pressable>
                );
              })}
            </View>
            {errors.split && <Text style={styles.errorMessage}>{errors.split}</Text>}
          </MotiView>

          {/* Notes (Optional) */}
          <MotiView
            from={{ opacity: 0, translateY: 10 }}
            animate={{ opacity: 1, translateY: 0 }}
            transition={{ type: 'timing', duration: 300, delay: 400 }}
          >
            <Input
              label="Notes (optional)"
              placeholder="Add any additional notes..."
              value={notes}
              onChangeText={setNotes}
              multiline
              numberOfLines={2}
              leftIcon={
                <Ionicons
                  name="chatbubble-outline"
                  size={20}
                  color={isDark ? colors.gray[400] : colors.gray[500]}
                />
              }
            />
          </MotiView>

              {/* Submit Button */}
              <MotiView
                from={{ opacity: 0, translateY: 10 }}
                animate={{ opacity: 1, translateY: 0 }}
                transition={{ type: 'timing', duration: 300, delay: 450 }}
                style={styles.submitContainer}
              >
                <Button
                  title="Add Expense"
                  onPress={handleSubmit}
                  loading={isSubmitting}
                  disabled={isSubmitting}
                />
              </MotiView>
            </>
          )}
        </ScrollView>
        )}
      </KeyboardAvoidingView>

      {/* People search sheet — opens automatically in search mode */}
      {isSearchMode && (
        <PeopleSearchSheet
          ref={bottomSheetRef}
          title={contactsOnly ? 'Select Contact' : 'Add Expense'}
          showGroups={!contactsOnly}
          onGroupSelect={handleSelectGroup}
          onContactSelect={handleSelectContact}
          onStartClose={() => {
            if (!hasSelectedTargetRef.current) {
              setTimeout(() => router.back(), 100);
            }
          }}
        />
      )}
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
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingText: {
    fontSize: 14,
    marginTop: 12,
  },
  errorContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  errorText: {
    fontSize: 18,
    fontWeight: '600',
    marginTop: 16,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  headerButton: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 40,
  },
  scrollContentFlex: {
    flexGrow: 1,
  },
  clearButton: {
    padding: 4,
  },
  // Group info styles
  groupInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 12,
    marginBottom: 20,
  },
  groupIcon: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  groupName: {
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 12,
  },
  amountContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderRadius: 16,
    marginBottom: 8,
  },
  currencyButton: {
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: 12,
  },
  currencySymbol: {
    fontSize: 32,
    fontWeight: '700',
    marginRight: 4,
  },
  amountInput: {
    flex: 1,
    fontSize: 40,
    fontWeight: '700',
  },
  pickerContainer: {
    borderRadius: 12,
    marginBottom: 16,
    overflow: 'hidden',
  },
  pickerItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    paddingHorizontal: 16,
  },
  pickerItemText: {
    fontSize: 15,
  },
  errorMessage: {
    color: colors.error,
    fontSize: 13,
    marginBottom: 12,
    marginLeft: 4,
  },
  section: {
    marginBottom: 20,
  },
  sectionLabel: {
    fontSize: 14,
    fontWeight: '500',
    marginBottom: 8,
  },
  selectorButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
  },
  selectorText: {
    fontSize: 15,
    fontWeight: '500',
  },
  selectorPlaceholder: {
    fontSize: 15,
  },
  selectedCategory: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  categoryIcon: {
    width: 32,
    height: 32,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  categoryEmoji: {
    fontSize: 18,
  },
  categoryGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    padding: 8,
    borderRadius: 12,
    marginTop: 8,
  },
  categoryItem: {
    width: '31%',
    alignItems: 'center',
    padding: 12,
    borderRadius: 10,
    margin: '1%',
    borderWidth: 1,
    borderColor: 'transparent',
  },
  categoryItemEmoji: {
    fontSize: 24,
    marginBottom: 4,
  },
  categoryItemText: {
    fontSize: 11,
    textAlign: 'center',
  },
  selectedMember: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  memberList: {
    borderRadius: 12,
    marginTop: 8,
    overflow: 'hidden',
  },
  memberItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
  },
  memberName: {
    flex: 1,
    fontSize: 15,
  },
  splitMemberList: {
    borderRadius: 12,
    overflow: 'hidden',
  },
  splitMemberItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 12,
    borderBottomWidth: 1,
  },
  splitMemberInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  splitMemberRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  splitAmount: {
    fontSize: 14,
    fontWeight: '500',
  },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  submitContainer: {
    marginTop: 24,
  },
});

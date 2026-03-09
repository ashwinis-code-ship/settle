/**
 * Add / Edit Expense Screen
 *
 * Modes:
 * - groupId provided:            Add expense to an existing group
 * - friendId + friendName:       Add expense with a friend (1:1)
 * - No params:                   Search mode — sheet opens automatically
 * - expenseId + groupId params:  Edit mode — pre-fills form from existing expense,
 *                                calls updateExpense on submit instead of createExpense
 */

import { Ionicons } from '@expo/vector-icons';
import BottomSheet, { BottomSheetBackdrop, BottomSheetScrollView, BottomSheetTextInput } from '@gorhom/bottom-sheet';
import { router, useLocalSearchParams } from 'expo-router';
import { MotiView } from 'moti';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Keyboard,
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
import { Checkbox } from '@/components/ui/checkbox';
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
import { useExpense } from '@/hooks/use-expense';
import { useExpenses } from '@/hooks/use-expenses';
import { useGroup } from '@/hooks/use-group';
import { Analytics } from '@/lib/analytics';
import { EXPENSE_EVENTS } from '@/lib/analytics-events';
import { hapticHeavy, hapticSelection, hapticSuccess, hapticWarning } from '@/lib/haptics';
import { supabase } from '@/lib/supabase';
import type { CurrencyCode, DbCategory, ExpenseFormData, GroupMember, SplitType } from '@/types';
import { CURRENCIES } from '@/types/database';

export default function AddExpenseScreen() {
  const params = useLocalSearchParams<{
    groupId?: string;
    friendId?: string;
    friendName?: string;
    contactsOnly?: string;
    expenseId?: string;
  }>();
  const colorScheme = useColorScheme() ?? 'light';
  const isDark = colorScheme === 'dark';
  const { user } = useAuth();
  const { isOnline } = useSync();

  // Edit mode
  const isEditMode = !!params.expenseId;
  const { expense: existingExpense, updateExpense } = useExpense(params.expenseId);

  // Determine creation mode
  const hasPreselection = !!params.groupId || !!params.friendId;
  const isDirectExpense = !!params.friendId && !params.groupId;
  const isSearchMode = !hasPreselection && !isEditMode;
  const contactsOnly = params.contactsOnly === 'true';

  const [resolvedGroupId, setResolvedGroupId] = useState<string | undefined>(params.groupId);
  const [selectedFriendId, setSelectedFriendId] = useState<string | undefined>(params.friendId);
  const [selectedFriendName, setSelectedFriendName] = useState<string | undefined>(params.friendName);
  const [selectedFriendPhone, setSelectedFriendPhone] = useState<string | undefined>();

  const { group, isLoading: isLoadingGroup } = useGroup(resolvedGroupId);
  const { categories } = useCategories();
  const { createExpense } = useExpenses(resolvedGroupId);
  const { findOrCreateDirectGroup, isLoading: isCreatingDirectGroup } = useDirectGroup();

  // Block offline in create mode
  useEffect(() => {
    if (!isOnline && !isEditMode) {
      Alert.alert(
        'No Connection',
        'Adding expenses requires an internet connection.',
        [{ text: 'OK', onPress: () => router.back() }]
      );
    }
  }, [isOnline, isEditMode]);

  // Analytics
  useEffect(() => {
    if (isEditMode) return;
    const entryPoint = params.groupId ? 'group' : params.friendId ? 'friend' : contactsOnly ? 'friends_tab' : 'home';
    Analytics.trackScreen('add_expense', { entry_point: entryPoint });
    Analytics.track(EXPENSE_EVENTS.ADD_EXPENSE_STARTED, {
      entry_point: entryPoint,
      has_preselection: hasPreselection,
      is_direct_expense: isDirectExpense,
    });
  }, []);

  // Search / target state
  const [hasSelectedTarget, setHasSelectedTarget] = useState(hasPreselection || isEditMode);
  const [isCreatingShadowUser, setIsCreatingShadowUser] = useState(false);

  // Bottom sheet
  const bottomSheetRef = useRef<BottomSheet>(null);
  const hasSelectedTargetRef = useRef(hasPreselection || isEditMode);
  useEffect(() => { hasSelectedTargetRef.current = hasSelectedTarget; }, [hasSelectedTarget]);

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
  const [hasPrefilledFromExpense, setHasPrefilledFromExpense] = useState(false);

  // Picker sheet state
  const pickerSheetRef = useRef<BottomSheet>(null);
  const [activeSheet, setActiveSheet] = useState<'currency' | 'category' | 'paidBy' | null>(null);
  const [currencySearch, setCurrencySearch] = useState('');

  // Theme
  const textColor = isDark ? colors.text.dark.primary : colors.text.light.primary;
  const secondaryTextColor = isDark ? colors.text.dark.secondary : colors.text.light.secondary;
  const backgroundColor = isDark ? colors.background.dark : colors.background.light;
  const cardBg = isDark ? colors.gray[800] : colors.white;
  const borderColor = isDark ? colors.gray[700] : colors.gray[200];

  // Pre-fill from existing expense when editing
  useEffect(() => {
    if (!isEditMode || !existingExpense || hasPrefilledFromExpense) return;
    setAmount(existingExpense.amount.toString());
    setDescription(existingExpense.description);
    setSelectedCategory(existingExpense.category);
    setNotes(existingExpense.notes || '');
    setPaidBy(existingExpense.paid_by);
    setSplitBetween(existingExpense.splits.map((s) => s.user_id));
    setCurrency(existingExpense.currency);
    setHasPrefilledFromExpense(true);
  }, [isEditMode, existingExpense, hasPrefilledFromExpense]);

  // Group selected from sheet
  const handleSelectGroup = useCallback((g: SearchResultGroup) => {
    Keyboard.dismiss();
    // Mark selected immediately so onStartClose doesn't trigger router.back().
    hasSelectedTargetRef.current = true;
    // Explicitly close the search sheet. PeopleSearchSheet group rows only call
    // onGroupSelect — they don't call close() themselves. The sheet was
    // disappearing before because selecting a *new* group made isLoadingGroup
    // briefly true → isSettingUp true → early return → whole component unmounted
    // (including PeopleSearchSheet). For a *cached* group isLoadingGroup never
    // becomes true, so nothing unmounted the sheet and it stayed open forever.
    // Explicit close() fixes this for all cases.
    bottomSheetRef.current?.close();
    Analytics.track(EXPENSE_EVENTS.ADD_EXPENSE_GROUP_SELECTED, { group_id: g.id });
    setResolvedGroupId(g.id);
    setSelectedFriendId(undefined);
    setSelectedFriendName(undefined);
    // Delay form reveal until the sheet close animation finishes (~300ms) so
    // autoFocus on the amount field doesn't open the keyboard mid-animation.
    setTimeout(() => setHasSelectedTarget(true), 320);
  }, []);

  // Contact selected from sheet
  const handleSelectContact = useCallback(async (contact: EnrichedContact) => {
    setHasSelectedTarget(true);
    Analytics.track(EXPENSE_EVENTS.ADD_EXPENSE_CONTACT_SELECTED, { is_existing_user: !!contact.userId });
    setSelectedFriendName(contact.name);
    setSelectedFriendPhone(contact.phone);

    if (contact.userId) {
      setSelectedFriendId(contact.userId);
    } else {
      setIsCreatingShadowUser(true);
      try {
        const normalizedPhone = normalizePhone(contact.phone);
        const { data: existingUser } = await supabase
          .from('users').select('id').eq('phone', normalizedPhone).single() as { data: { id: string } | null };
        if (existingUser) {
          setSelectedFriendId(existingUser.id);
        } else {
          const { data: shadowUser, error: shadowError } = await supabase
            .from('users')
            .insert({ phone: normalizedPhone, name: contact.name, is_registered: false } as any)
            .select('id').single() as { data: { id: string } | null; error: any };
          if (shadowError) {
            const { data: retryUser } = await supabase
              .from('users').select('id').eq('phone', normalizedPhone).single() as { data: { id: string } | null };
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

  const handleClearSelection = useCallback(() => {
    setHasSelectedTarget(false);
    setResolvedGroupId(undefined);
    setSelectedFriendId(undefined);
    setSelectedFriendName(undefined);
    setSelectedFriendPhone(undefined);
    setSplitBetween([]);
    if (isSearchMode) setTimeout(() => bottomSheetRef.current?.expand(), 100);
  }, [isSearchMode]);

  // Find or create direct group for friend expenses
  useEffect(() => {
    const setup = async () => {
      const friendId = selectedFriendId || params.friendId;
      if (friendId && user && hasSelectedTarget && !resolvedGroupId) {
        const directGroupId = await findOrCreateDirectGroup(friendId);
        if (directGroupId) setResolvedGroupId(directGroupId);
      }
    };
    setup();
  }, [selectedFriendId, params.friendId, user, findOrCreateDirectGroup, hasSelectedTarget, resolvedGroupId]);

  // Initialize form with group defaults (skipped in edit mode once pre-filled)
  useEffect(() => {
    if (isEditMode) return;
    if (group) {
      setCurrency(group.currency);
      if (user) {
        setPaidBy(user.id);
        setSplitBetween(group.members.map((m) => m.user_id));
      }
    } else if (hasSelectedTarget && user) {
      setPaidBy(user.id);
      const friendId = selectedFriendId || params.friendId;
      if (friendId) {
        setSplitBetween([user.id, friendId]);
      } else if (selectedFriendPhone) {
        setSplitBetween([user.id]);
      }
    }
  }, [group, user, hasSelectedTarget, selectedFriendId, selectedFriendPhone, params.friendId, isEditMode]);

  const getMember = useCallback(
    (userId: string): GroupMember | undefined => group?.members.find((m) => m.user_id === userId),
    [group]
  );

  const splitAmounts = useMemo(() => {
    const total = parseFloat(amount) || 0;
    if (total <= 0 || splitBetween.length === 0) return {};
    const perPerson = total / splitBetween.length;
    const result: Record<string, number> = {};
    splitBetween.forEach((uid) => { result[uid] = Math.round(perPerson * 100) / 100; });
    return result;
  }, [amount, splitBetween]);

  // Keep a ref in sync with activeSheet so the sheet content renders
  // immediately from the ref even before React's async state update commits.
  const activeSheetRef = useRef<'currency' | 'category' | 'paidBy' | null>(null);

  const openSheet = useCallback((type: 'currency' | 'category' | 'paidBy') => {
    Keyboard.dismiss();
    hapticSelection();
    activeSheetRef.current = type;
    setActiveSheet(type);
    // Call directly (no RAF) so the sheet opens synchronously in the same
    // JS frame. The ref above ensures content is correct even if React hasn't
    // re-rendered yet.
    if (type === 'currency') {
      pickerSheetRef.current?.expand();
    } else {
      pickerSheetRef.current?.snapToIndex(0);
    }
  }, []);

  const closeSheet = useCallback(() => {
    pickerSheetRef.current?.close();
  }, []);

  const renderPickerBackdrop = useCallback(
    (props: React.ComponentProps<typeof BottomSheetBackdrop>) => (
      <BottomSheetBackdrop {...props} disappearsOnIndex={-1} appearsOnIndex={0} opacity={0.45} />
    ),
    []
  );

  const filteredCurrencies = useMemo(() => {
    const q = currencySearch.toLowerCase().trim();
    return Object.entries(CURRENCIES).filter(
      ([code, { name }]) => !q || code.toLowerCase().includes(q) || name.toLowerCase().includes(q)
    );
  }, [currencySearch]);

  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {};
    if (!hasSelectedTarget) newErrors.target = 'Select a group or contact';
    if (!description.trim()) newErrors.description = 'Description is required';
    const amountNum = parseFloat(amount);
    if (!amount || isNaN(amountNum) || amountNum <= 0) newErrors.amount = 'Enter a valid amount';
    if (!paidBy) newErrors.paidBy = 'Select who paid';
    if (splitBetween.length === 0) newErrors.split = 'Select at least one person to split with';
    else if (splitBetween.length === 1 && splitBetween[0] === paidBy)
      newErrors.split = 'The person who paid cannot be the only one in the split';
    setErrors(newErrors);
    if (Object.keys(newErrors).length > 0) hapticHeavy();
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async () => {
    if (!validateForm()) return;
    setIsSubmitting(true);

    // ---------- EDIT MODE ----------
    if (isEditMode && existingExpense) {
      const amountNum = parseFloat(amount);
      const newSplitAmount = amountNum / splitBetween.length;
      const newSplits = splitBetween.map((uid) => ({
        user_id: uid,
        amount: Math.round(newSplitAmount * 100) / 100,
      }));
      const success = await updateExpense(
        {
          description: description.trim(),
          amount: amountNum,
          paid_by: paidBy,
          category_id: selectedCategory?.id || null,
          notes: notes.trim() || null,
        },
        newSplits
      );
      setIsSubmitting(false);
      if (success) {
        hapticSuccess();
        router.back();
      } else {
        hapticHeavy();
        setErrors({ form: 'Failed to update expense. Please try again.' });
      }
      return;
    }

    // ---------- CREATE MODE ----------
    // Handle contact without userId (shadow user path)
    let actualFriendId = selectedFriendId;
    if (!resolvedGroupId && selectedFriendPhone && !actualFriendId && user) {
      const normalizedPhone = normalizePhone(selectedFriendPhone);
      const { data: existingUser } = await supabase
        .from('users').select('id').eq('phone', normalizedPhone).single() as { data: { id: string } | null };
      if (existingUser) {
        actualFriendId = existingUser.id;
      } else {
        const { data: shadowUser, error: shadowError } = await supabase
          .from('users')
          .insert({ phone: normalizedPhone, name: selectedFriendName || 'Unknown', is_registered: false } as any)
          .select('id').single() as { data: { id: string } | null; error: any };
        if (shadowError || !shadowUser) {
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
      const directGroupId = await findOrCreateDirectGroup(actualFriendId);
      if (!directGroupId) {
        setErrors({ form: 'Failed to create expense. Please try again.' });
        setIsSubmitting(false);
        return;
      }
      const formData: ExpenseFormData = {
        description: description.trim(), amount, currency,
        category_id: selectedCategory?.id || null,
        paid_by: paidBy || user.id,
        split_type: 'equal_selected',
        split_between: [user.id, actualFriendId],
        notes: notes.trim(), expense_date: new Date(),
      };
      const expenseId = await createExpense(formData, directGroupId);
      setIsSubmitting(false);
      if (expenseId) {
        Analytics.track(EXPENSE_EVENTS.ADD_EXPENSE_COMPLETED, {
          expense_id: expenseId, amount: parseFloat(amount), currency,
          category_id: selectedCategory?.id, category_name: selectedCategory?.name,
          split_type: 'equal_selected', member_count: 2, is_group_expense: false,
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

    // Normal group path
    const formData: ExpenseFormData = {
      description: description.trim(), amount, currency,
      category_id: selectedCategory?.id || null,
      paid_by: paidBy, split_type: splitType,
      split_between: splitBetween,
      notes: notes.trim(), expense_date: new Date(),
    };
    const expenseId = await createExpense(formData, resolvedGroupId);
    setIsSubmitting(false);
    if (expenseId) {
      Analytics.track(EXPENSE_EVENTS.ADD_EXPENSE_COMPLETED, {
        expense_id: expenseId, amount: parseFloat(amount), currency,
        category_id: selectedCategory?.id, category_name: selectedCategory?.name,
        split_type: splitType, member_count: splitBetween.length, is_group_expense: true,
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
        const newList = prev.filter((id) => id !== userId);
        if (newList.length === 0) { hapticWarning(); return prev; }
        if (newList.length === 1 && newList[0] === paidBy) { hapticWarning(); return prev; }
        hapticSelection();
        return newList;
      }
      hapticSelection();
      return [...prev, userId];
    });
  };

  // Loading: setting up group or direct flow
  const isSettingUp = hasSelectedTarget && (
    isLoadingGroup || isCreatingDirectGroup || isCreatingShadowUser
    || (selectedFriendId && !resolvedGroupId)
  );

  if (isSettingUp && !isEditMode) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor }]} edges={['top']}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary[500]} />
          <Text style={[styles.loadingText, { color: secondaryTextColor }]}>Setting up…</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (hasPreselection && !group && !isDirectExpense && !isSearchMode && !isEditMode) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor }]} edges={['top']}>
        <View style={styles.errorContainer}>
          <Ionicons name="alert-circle" size={48} color={colors.error} />
          <Text style={[styles.errorText, { color: textColor }]}>Group not found</Text>
          <Button title="Go Back" onPress={() => router.back()} style={{ marginTop: 16 }} />
        </View>
      </SafeAreaView>
    );
  }

  const screenTitle = isEditMode ? 'Edit Expense' : 'Add Expense';

  // Determine target label for the banner
  const targetLabel = selectedFriendName
    ? `With ${selectedFriendName}`
    : isDirectExpense
      ? `With ${params.friendName || 'Friend'}`
      : group?.name || (isEditMode && existingExpense ? 'Loading…' : 'Loading…');

  const isFriendTarget = !!(selectedFriendId || selectedFriendName || isDirectExpense);

  return (
    <GestureHandlerRootView style={styles.flex}>
      <SafeAreaView style={[styles.container, { backgroundColor }]} edges={['top']}>
        {/* Header */}
        <MotiView
          from={{ opacity: 0, translateY: -16 }}
          animate={{ opacity: 1, translateY: 0 }}
          transition={{ type: 'spring', damping: 22, stiffness: 220 }}
          style={[styles.header, { borderBottomColor: borderColor }]}
        >
          <Pressable
            onPress={() => router.back()}
            style={({ pressed }) => [styles.headerButton, { opacity: pressed ? 0.6 : 1, transform: [{ scale: pressed ? 0.88 : 1 }] }]}
          >
            <Ionicons name="close" size={24} color={textColor} />
          </Pressable>
          <Text style={[styles.headerTitle, { color: textColor }]}>{screenTitle}</Text>
          <Pressable
            onPress={handleSubmit}
            disabled={isSubmitting}
            style={({ pressed }) => [
              styles.headerButton,
              styles.headerSaveButton,
              { opacity: pressed || isSubmitting ? 0.55 : 1 },
            ]}
          >
            {isSubmitting ? (
              <ActivityIndicator size="small" color={colors.primary[500]} />
            ) : (
              <Ionicons name="checkmark" size={26} color={colors.primary[500]} />
            )}
          </Pressable>
        </MotiView>

        <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
          {(hasPreselection || hasSelectedTarget || isEditMode) && (
            <ScrollView
              style={styles.flex}
              contentContainerStyle={styles.scrollContent}
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
            >
              {/* ── Target Banner ── */}
              <MotiView
                from={{ opacity: 0, translateY: 10 }}
                animate={{ opacity: 1, translateY: 0 }}
                transition={{ type: 'spring', damping: 20, stiffness: 200, delay: 40 }}
              >
                <View style={[styles.targetBanner, { backgroundColor: cardBg }]}>
                  <View style={[
                    styles.targetIcon,
                    { backgroundColor: isFriendTarget ? colors.success + '20' : colors.primary[500] + '18' },
                  ]}>
                    <Ionicons
                      name={isFriendTarget ? 'person' : 'people'}
                      size={20}
                      color={isFriendTarget ? colors.success : colors.primary[500]}
                    />
                  </View>
                  <View style={styles.targetInfo}>
                    <Text style={[styles.targetLabel, { color: secondaryTextColor }]}>
                      {isFriendTarget ? 'WITH' : 'GROUP'}
                    </Text>
                    <Text style={[styles.targetName, { color: textColor }]} numberOfLines={1}>
                      {targetLabel}
                    </Text>
                  </View>
                  {isSearchMode && hasSelectedTarget && !isEditMode && (
                    <Pressable
                      onPress={handleClearSelection}
                      style={({ pressed }) => [styles.clearButton, { opacity: pressed ? 0.6 : 1 }]}
                    >
                      <Ionicons name="close-circle" size={22} color={secondaryTextColor} />
                    </Pressable>
                  )}
                </View>
              </MotiView>

              {/* ── Amount Hero ── */}
              <MotiView
                from={{ opacity: 0, translateY: 10 }}
                animate={{ opacity: 1, translateY: 0 }}
                transition={{ type: 'spring', damping: 20, stiffness: 200, delay: 90 }}
                style={[styles.amountHero, { backgroundColor: colors.primary[500] + '0D' }]}
              >
                <View style={styles.amountRow}>
                  <Pressable
                    onPress={() => openSheet('currency')}
                    style={({ pressed }) => [
                      styles.currencyPill,
                      { borderRightColor: borderColor, opacity: pressed ? 0.7 : 1 },
                    ]}
                  >
                    <Text style={[styles.currencyPillSymbol, { color: colors.primary[500] }]}>
                      {CURRENCIES[currency].symbol}
                    </Text>
                    <Text style={[styles.currencyPillCode, { color: secondaryTextColor }]}>
                      {currency}
                    </Text>
                    <Ionicons name="chevron-down" size={12} color={secondaryTextColor} />
                  </Pressable>
                  <TextInput
                    style={[styles.amountInput, { color: textColor }]}
                    placeholder="0.00"
                    placeholderTextColor={isDark ? colors.gray[600] : colors.gray[300]}
                    value={amount}
                    onChangeText={setAmount}
                    keyboardType="decimal-pad"
                    autoFocus={!isEditMode}
                    returnKeyType="done"
                    onSubmitEditing={Keyboard.dismiss}
                    textAlign="center"
                  />
                </View>
                {errors.amount ? <Text style={styles.amountError}>{errors.amount}</Text> : null}
              </MotiView>

              {/* ── Description + Category ── */}
              <MotiView
                from={{ opacity: 0, translateY: 10 }}
                animate={{ opacity: 1, translateY: 0 }}
                transition={{ type: 'spring', damping: 20, stiffness: 200, delay: 140 }}
                style={styles.section}
              >
                <View style={[styles.descriptionCard, { backgroundColor: cardBg, borderColor }]}>
                  <Pressable
                    onPress={() => openSheet('category')}
                    style={({ pressed }) => [
                      styles.categoryTile,
                      { borderRightColor: borderColor },
                      selectedCategory ? { backgroundColor: selectedCategory.color + '18' } : {},
                      { opacity: pressed ? 0.7 : 1 },
                    ]}
                  >
                    {selectedCategory ? (
                      <Text style={styles.categoryTileEmoji}>{selectedCategory.icon}</Text>
                    ) : (
                      <Ionicons name="grid-outline" size={20} color={secondaryTextColor} />
                    )}
                  </Pressable>
                  <TextInput
                    style={[styles.descriptionInput, { color: textColor }]}
                    placeholder="What's this expense for?"
                    placeholderTextColor={isDark ? colors.gray[600] : colors.gray[400]}
                    value={description}
                    onChangeText={setDescription}
                    returnKeyType="done"
                  />
                </View>
                {errors.description ? <Text style={styles.errorMessage}>{errors.description}</Text> : null}
              </MotiView>

              {/* ── Paid By ── */}
              <MotiView
                from={{ opacity: 0, translateY: 10 }}
                animate={{ opacity: 1, translateY: 0 }}
                transition={{ type: 'spring', damping: 20, stiffness: 200, delay: 190 }}
                style={styles.section}
              >
                <Text style={[styles.sectionLabel, { color: secondaryTextColor }]}>PAID BY</Text>
                <Pressable
                  onPress={() => openSheet('paidBy')}
                  style={[styles.selectorRow, { backgroundColor: cardBg, borderColor }]}
                >
                  {paidBy ? (
                    <View style={styles.selectorLeft}>
                      {getMember(paidBy) && (
                        <Avatar user={getMember(paidBy)!.user} size={30} style={{ marginRight: 10 }} />
                      )}
                      <Text style={[styles.selectorValue, { color: textColor }]}>
                        {paidBy === user?.id ? 'You' : getMember(paidBy)?.user.name || 'Unknown'}
                      </Text>
                    </View>
                  ) : (
                    <View style={styles.selectorLeft}>
                      <View style={[styles.selectorIconWrap, { backgroundColor: borderColor }]}>
                        <Ionicons name="person-outline" size={16} color={secondaryTextColor} />
                      </View>
                      <Text style={[styles.selectorPlaceholder, { color: secondaryTextColor }]}>
                        Who paid?
                      </Text>
                    </View>
                  )}
                  <Ionicons name="chevron-down" size={18} color={secondaryTextColor} />
                </Pressable>
                {errors.paidBy ? <Text style={styles.errorMessage}>{errors.paidBy}</Text> : null}
              </MotiView>

              {/* ── Split Between ── */}
              <MotiView
                from={{ opacity: 0, translateY: 10 }}
                animate={{ opacity: 1, translateY: 0 }}
                transition={{ type: 'spring', damping: 20, stiffness: 200, delay: 240 }}
                style={styles.section}
              >
                <Text style={[styles.sectionLabel, { color: secondaryTextColor }]}>
                  SPLIT BETWEEN{splitBetween.length > 0 ? ` · ${splitBetween.length} ${splitBetween.length === 1 ? 'person' : 'people'}` : ''}
                </Text>
                <View style={[styles.splitList, { backgroundColor: cardBg }]}>
                  {(group?.members || []).map((member, idx) => {
                    const isSelected = splitBetween.includes(member.user_id);
                    const splitAmount = splitAmounts[member.user_id];
                    const isLast = idx === (group?.members.length ?? 0) - 1;
                    return (
                      <Pressable
                        key={member.user_id}
                        style={({ pressed }) => [
                          styles.splitItem,
                          !isLast && { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: borderColor },
                          { transform: [{ scale: pressed ? 0.98 : 1 }] },
                        ]}
                        onPress={() => toggleMemberInSplit(member.user_id)}
                      >
                        <Avatar user={member.user} size={34} style={{ marginRight: 12 }} />
                        <Text style={[styles.splitName, { color: textColor }]}>
                          {member.user_id === user?.id ? 'You' : member.user.name}
                        </Text>
                        <View style={styles.splitRight}>
                          {isSelected && splitAmount > 0 && (
                            <Text style={[styles.splitAmount, { color: secondaryTextColor }]}>
                              {CURRENCIES[currency].symbol}{splitAmount.toFixed(2)}
                            </Text>
                          )}
                          <Checkbox checked={isSelected} borderColor={borderColor} />
                        </View>
                      </Pressable>
                    );
                  })}
                </View>
                {errors.split ? <Text style={styles.errorMessage}>{errors.split}</Text> : null}
              </MotiView>

              {/* ── Notes ── */}
              <MotiView
                from={{ opacity: 0, translateY: 10 }}
                animate={{ opacity: 1, translateY: 0 }}
                transition={{ type: 'spring', damping: 20, stiffness: 200, delay: 290 }}
              >
                <Input
                  label="Notes (optional)"
                  placeholder="Add any additional notes…"
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

              {/* ── Form error ── */}
              {errors.form ? (
                <Text style={[styles.errorMessage, { marginBottom: 8 }]}>{errors.form}</Text>
              ) : null}

            </ScrollView>
          )}
        </KeyboardAvoidingView>

        {/* Picker bottom sheet — currency / category / paid-by */}
        <BottomSheet
          ref={pickerSheetRef}
          index={-1}
          snapPoints={['50%', '75%']}
          enablePanDownToClose
          onChange={(index) => {
            // Only clear currency search when fully closed (index -1).
            // activeSheet is intentionally NOT reset here — the async
            // animation callback races with openSheet() on quick re-opens
            // and would wipe out the newly set picker type.
            // openSheet() always sets activeSheet before expanding, so
            // stale state while the sheet is closed is harmless.
            if (index === -1) setCurrencySearch('');
          }}
          backgroundStyle={{ backgroundColor: cardBg }}
          handleIndicatorStyle={{ backgroundColor: borderColor }}
          backdropComponent={renderPickerBackdrop}
          keyboardBehavior="interactive"
          keyboardBlurBehavior="restore"
        >
          <BottomSheetScrollView
            contentContainerStyle={styles.sheetContent}
            keyboardShouldPersistTaps="handled"
          >
            <Text style={[styles.sheetTitle, { color: textColor }]}>
              {(activeSheet ?? activeSheetRef.current) === 'currency'
                ? 'Select Currency'
                : (activeSheet ?? activeSheetRef.current) === 'category'
                  ? 'Select Category'
                  : 'Who Paid?'}
            </Text>

            {/* Currency list with search */}
            {(activeSheet ?? activeSheetRef.current) === 'currency' && (
              <>
                <BottomSheetTextInput
                  style={[
                    styles.currencySearchInput,
                    { backgroundColor: isDark ? colors.gray[700] : colors.gray[100], color: textColor },
                  ]}
                  placeholder="Search currencies…"
                  placeholderTextColor={secondaryTextColor}
                  value={currencySearch}
                  onChangeText={setCurrencySearch}
                  clearButtonMode="while-editing"
                  autoCorrect={false}
                />
                {filteredCurrencies.map(([code, { symbol, name }]) => (
                  <Pressable
                    key={code}
                    style={({ pressed }) => [
                      styles.sheetItem,
                      { borderBottomColor: borderColor },
                      currency === code && { backgroundColor: colors.primary[500] + '22', borderRadius: 10 },
                      { opacity: pressed ? 0.75 : 1 },
                    ]}
                    onPress={() => {
                      hapticSelection();
                      setCurrency(code as CurrencyCode);
                      closeSheet();
                    }}
                  >
                    <View style={styles.sheetItemLeft}>
                      <Text style={[styles.currencyItemSymbol, { color: colors.primary[500] }]}>{symbol}</Text>
                      <View>
                        <Text style={[styles.sheetItemTitle, { color: textColor }]}>{code}</Text>
                        <Text style={[styles.sheetItemSubtitle, { color: secondaryTextColor }]}>{name}</Text>
                      </View>
                    </View>
                    {currency === code && <Ionicons name="checkmark" size={18} color={colors.primary[500]} />}
                  </Pressable>
                ))}
              </>
            )}

            {/* Category grid */}
            {(activeSheet ?? activeSheetRef.current) === 'category' && (
              <View style={styles.categorySheetGrid}>
                <Pressable
                  style={({ pressed }) => [
                    styles.categorySheetItem,
                    !selectedCategory && { backgroundColor: colors.gray[500] + '20', borderColor: colors.gray[400] },
                    { opacity: pressed ? 0.75 : 1 },
                  ]}
                  onPress={() => { hapticSelection(); setSelectedCategory(null); closeSheet(); }}
                >
                  <Text style={[styles.categorySheetEmoji, { color: secondaryTextColor }]}>—</Text>
                  <Text
                    style={[styles.categorySheetName, { color: !selectedCategory ? secondaryTextColor : textColor }]}
                    numberOfLines={1}
                  >
                    None
                  </Text>
                </Pressable>
                {categories.map((cat) => (
                  <Pressable
                    key={cat.id}
                    style={({ pressed }) => [
                      styles.categorySheetItem,
                      selectedCategory?.id === cat.id && { backgroundColor: cat.color + '20', borderColor: cat.color },
                      { opacity: pressed ? 0.75 : 1, transform: [{ scale: pressed ? 0.95 : 1 }] },
                    ]}
                    onPress={() => { hapticSelection(); setSelectedCategory(cat); closeSheet(); }}
                  >
                    <Text style={styles.categorySheetEmoji}>{cat.icon}</Text>
                    <Text
                      style={[
                        styles.categorySheetName,
                        { color: selectedCategory?.id === cat.id ? cat.color : textColor },
                      ]}
                      numberOfLines={1}
                    >
                      {cat.name}
                    </Text>
                  </Pressable>
                ))}
              </View>
            )}

            {/* Paid by member list */}
            {(activeSheet ?? activeSheetRef.current) === 'paidBy' && group && group.members.map((member) => (
              <Pressable
                key={member.user_id}
                style={({ pressed }) => [
                  styles.sheetItem,
                  { borderBottomColor: borderColor },
                  paidBy === member.user_id && { backgroundColor: colors.primary[500] + '22', borderRadius: 10 },
                  { opacity: pressed ? 0.8 : 1 },
                ]}
                onPress={() => { hapticSelection(); setPaidBy(member.user_id); closeSheet(); }}
              >
                <View style={styles.sheetItemLeft}>
                  <Avatar user={member.user} size={36} style={{ marginRight: 12 }} />
                  <Text style={[styles.sheetItemTitle, { color: textColor }]}>
                    {member.user_id === user?.id ? 'You' : member.user.name}
                  </Text>
                </View>
                {paidBy === member.user_id && <Ionicons name="checkmark" size={18} color={colors.primary[500]} />}
              </Pressable>
            ))}
          </BottomSheetScrollView>
        </BottomSheet>

        {/* People search sheet — search mode only */}
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
  container: { flex: 1 },
  flex: { flex: 1 },
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

  // Nav
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  headerButton: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerSaveButton: {
    borderRadius: 22,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
  },

  scrollContent: {
    padding: 20,
    paddingBottom: 48,
  },

  // Target banner
  targetBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 14,
    borderRadius: 14,
    marginBottom: 16,
    gap: 12,
  },
  targetIcon: {
    width: 40,
    height: 40,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  targetInfo: {
    flex: 1,
  },
  targetLabel: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 1,
    marginBottom: 2,
  },
  targetName: {
    fontSize: 16,
    fontWeight: '600',
  },
  clearButton: {
    padding: 4,
  },

  // Amount hero — inline row layout
  amountHero: {
    borderRadius: 18,
    marginBottom: 16,
    overflow: 'hidden',
  },
  amountRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  currencyPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingVertical: 22,
    paddingHorizontal: 16,
    borderRightWidth: StyleSheet.hairlineWidth,
  },
  currencyPillSymbol: {
    fontSize: 20,
    fontWeight: '700',
  },
  currencyPillCode: {
    fontSize: 13,
    fontWeight: '600',
  },
  amountInput: {
    flex: 1,
    fontSize: 44,
    fontWeight: '700',
    letterSpacing: -1,
    textAlign: 'center',
    paddingVertical: 0,
    paddingHorizontal: 16,
  },
  amountError: {
    color: colors.error,
    fontSize: 13,
    textAlign: 'center',
    paddingBottom: 10,
  },

  // Sections
  section: {
    marginBottom: 20,
  },
  sectionLabel: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 1.2,
    marginBottom: 10,
  },

  // Description + category compound row
  descriptionCard: {
    flexDirection: 'row',
    alignItems: 'stretch',
    borderRadius: 12,
    borderWidth: 1,
    overflow: 'hidden',
  },
  categoryTile: {
    width: 54,
    alignItems: 'center',
    justifyContent: 'center',
    borderRightWidth: StyleSheet.hairlineWidth,
  },
  categoryTileEmoji: {
    fontSize: 22,
  },
  descriptionInput: {
    flex: 1,
    fontSize: 15,
    paddingVertical: 14,
    paddingHorizontal: 14,
    minHeight: 50,
  },

  // Paid by selector row (trigger only — picker moved to sheet)
  selectorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1,
  },
  selectorLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  selectorIconWrap: {
    width: 32,
    height: 32,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  selectorValue: {
    fontSize: 15,
    fontWeight: '500',
  },
  selectorPlaceholder: {
    fontSize: 15,
  },

  // Picker bottom sheet
  sheetContent: {
    paddingHorizontal: 20,
    paddingBottom: 48,
  },
  sheetTitle: {
    fontSize: 17,
    fontWeight: '700',
    marginBottom: 16,
    marginTop: 4,
  },
  sheetItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 13,
    paddingHorizontal: 4,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  sheetItemLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  sheetItemTitle: {
    fontSize: 15,
    fontWeight: '500',
  },
  sheetItemSubtitle: {
    fontSize: 12,
    marginTop: 1,
  },
  currencyItemSymbol: {
    fontSize: 20,
    fontWeight: '700',
    width: 36,
    textAlign: 'center',
    marginRight: 12,
  },
  currencySearchInput: {
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 15,
    marginBottom: 12,
  },
  categorySheetGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 4,
  },
  categorySheetItem: {
    width: '30%',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 8,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: 'transparent',
    gap: 6,
  },
  categorySheetEmoji: {
    fontSize: 26,
  },
  categorySheetName: {
    fontSize: 11,
    textAlign: 'center',
    fontWeight: '500',
  },

  // Split list
  splitList: {
    borderRadius: 12,
    overflow: 'hidden',
  },
  splitItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 13,
    paddingHorizontal: 14,
  },
  splitName: {
    flex: 1,
    fontSize: 15,
  },
  splitRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  splitAmount: {
    fontSize: 14,
    fontWeight: '500',
  },

  errorMessage: {
    color: colors.error,
    fontSize: 13,
    marginTop: 8,
    marginLeft: 4,
  },

  submitContainer: {
    marginTop: 16,
  },
});

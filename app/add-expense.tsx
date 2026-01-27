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
import { router, useLocalSearchParams } from 'expo-router';
import { MotiView } from 'moti';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { colors } from '@/constants/colors';
import { useAuth } from '@/contexts/auth-context';
import { useCategories } from '@/hooks/use-categories';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useContactGroupSearch, type SearchResult, type SearchResultContact, type SearchResultGroup } from '@/hooks/use-contact-group-search';
import { useDirectGroup } from '@/hooks/use-direct-group';
import { useExpenses } from '@/hooks/use-expenses';
import { useGroup } from '@/hooks/use-group';
import { supabase } from '@/lib/supabase';
import type { CurrencyCode, DbCategory, ExpenseFormData, GroupMember, SplitType } from '@/types';
import { CURRENCIES } from '@/types/database';

export default function AddExpenseScreen() {
  const params = useLocalSearchParams<{ 
    groupId?: string; 
    friendId?: string; 
    friendName?: string;
  }>();
  const colorScheme = useColorScheme() ?? 'light';
  const isDark = colorScheme === 'dark';
  const { user } = useAuth();

  // Determine mode: group expense, 1:1 with friend, or search mode
  const hasPreselection = !!params.groupId || !!params.friendId;
  const isDirectExpense = !!params.friendId && !params.groupId;
  const isSearchMode = !hasPreselection;
  
  const [resolvedGroupId, setResolvedGroupId] = useState<string | undefined>(params.groupId);
  const [selectedFriendId, setSelectedFriendId] = useState<string | undefined>(params.friendId);
  const [selectedFriendName, setSelectedFriendName] = useState<string | undefined>(params.friendName);
  const [selectedFriendPhone, setSelectedFriendPhone] = useState<string | undefined>();

  const { group, isLoading: isLoadingGroup } = useGroup(resolvedGroupId);
  const { categories } = useCategories();
  const { createExpense } = useExpenses(resolvedGroupId);
  const { findOrCreateDirectGroup, isLoading: isCreatingDirectGroup } = useDirectGroup();
  const { searchResults, isLoading: isLoadingSearch, hasContactPermission, search } = useContactGroupSearch();

  // Search UI state
  const [searchQuery, setSearchQuery] = useState('');
  const [showSearchResults, setShowSearchResults] = useState(false);
  const [hasSelectedTarget, setHasSelectedTarget] = useState(hasPreselection);

  // Form state
  const [description, setDescription] = useState('');
  const [amount, setAmount] = useState('');
  const [currency, setCurrency] = useState<CurrencyCode>('INR');
  const [selectedCategory, setSelectedCategory] = useState<DbCategory | null>(null);
  const [paidBy, setPaidBy] = useState<string>('');
  const [splitType, setSplitType] = useState<SplitType>('equal_all');
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

  // Trigger search on query change
  useEffect(() => {
    if (isSearchMode && !hasSelectedTarget) {
      search(searchQuery);
    }
  }, [searchQuery, isSearchMode, hasSelectedTarget, search]);

  // Handle search result selection
  const handleSelectSearchResult = useCallback(async (result: SearchResult) => {
    setShowSearchResults(false);
    setHasSelectedTarget(true);

    if (result.type === 'group') {
      // Selected a group
      setResolvedGroupId(result.id);
      setSelectedFriendId(undefined);
      setSelectedFriendName(undefined);
    } else {
      // Selected a contact - need to find or create user
      const contact = result as SearchResultContact;
      setSelectedFriendName(contact.name);
      setSelectedFriendPhone(contact.phone);
      
      if (contact.userId) {
        // User already exists in app
        setSelectedFriendId(contact.userId);
      } else {
        // Need to create shadow user when expense is submitted
        // For now, store the phone number and create on submit
        setSelectedFriendId(undefined);
      }
    }
  }, []);

  // Clear selection and go back to search
  const handleClearSelection = useCallback(() => {
    setHasSelectedTarget(false);
    setResolvedGroupId(undefined);
    setSelectedFriendId(undefined);
    setSelectedFriendName(undefined);
    setSelectedFriendPhone(undefined);
    setSearchQuery('');
    setSplitBetween([]);
  }, []);

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
    } else if (hasSelectedTarget && user && (selectedFriendId || params.friendId)) {
      // For direct expense, set up split between user and friend
      const friendId = selectedFriendId || params.friendId;
      if (friendId) {
        setPaidBy(user.id);
        setSplitBetween([user.id, friendId]);
      }
    }
  }, [group, user, hasSelectedTarget, selectedFriendId, params.friendId]);

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
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async () => {
    if (!validateForm()) return;

    setIsSubmitting(true);

    // If we have a contact without userId, we need to create shadow user first
    let actualFriendId = selectedFriendId;
    if (!resolvedGroupId && selectedFriendPhone && !actualFriendId && user) {
      // Normalize phone
      let normalizedPhone = selectedFriendPhone.replace(/[\s-]/g, '');
      if (!normalizedPhone.startsWith('+')) {
        if (normalizedPhone.startsWith('91') && normalizedPhone.length > 10) {
          normalizedPhone = `+${normalizedPhone}`;
        } else {
          normalizedPhone = `+91${normalizedPhone.replace(/^0/, '')}`;
        }
      }

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
      setResolvedGroupId(directGroupId);
      setSelectedFriendId(actualFriendId);
      
      // Update split to include the new friend ID
      if (user && actualFriendId) {
        setSplitBetween([user.id, actualFriendId]);
      }

      // Wait a moment for state to update, then continue with expense creation
      // This is a bit hacky - ideally we'd refactor to pass the groupId directly
      await new Promise(resolve => setTimeout(resolve, 100));
    }

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

    const expenseId = await createExpense(formData);
    setIsSubmitting(false);

    if (expenseId) {
      router.back();
    }
  };

  const toggleMemberInSplit = (userId: string) => {
    setSplitBetween((prev) => {
      if (prev.includes(userId)) {
        return prev.filter((id) => id !== userId);
      }
      return [...prev, userId];
    });
  };

  const handleSplitTypeChange = (type: SplitType) => {
    setSplitType(type);
    if (type === 'equal_all' && group) {
      // Reset to all members
      setSplitBetween(group.members.map((m) => m.user_id));
    }
  };

  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map((n) => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  // Show loading while setting up group (either loading existing or creating direct)
  // In search mode, don't show loading until user has selected something
  const isSettingUp = hasSelectedTarget && (isLoadingGroup || isCreatingDirectGroup || (selectedFriendId && !resolvedGroupId));
  
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

  // Render search result item
  const renderSearchResult = ({ item }: { item: SearchResult }) => {
    if (item.type === 'group') {
      const groupResult = item as SearchResultGroup;
      return (
        <Pressable
          onPress={() => handleSelectSearchResult(item)}
          style={({ pressed }) => [
            styles.searchResultItem,
            { backgroundColor: cardBg, opacity: pressed ? 0.7 : 1 },
          ]}
        >
          <View style={[styles.searchResultIcon, { backgroundColor: colors.primary[100] }]}>
            <Ionicons name="people" size={20} color={colors.primary[500]} />
          </View>
          <View style={styles.searchResultInfo}>
            <Text style={[styles.searchResultName, { color: textColor }]} numberOfLines={1}>
              {groupResult.name}
            </Text>
            <Text style={[styles.searchResultMeta, { color: secondaryTextColor }]}>
              Group · {groupResult.memberCount} members
            </Text>
          </View>
          <Ionicons name="chevron-forward" size={20} color={secondaryTextColor} />
        </Pressable>
      );
    } else {
      const contactResult = item as SearchResultContact;
      return (
        <Pressable
          onPress={() => handleSelectSearchResult(item)}
          style={({ pressed }) => [
            styles.searchResultItem,
            { backgroundColor: cardBg, opacity: pressed ? 0.7 : 1 },
          ]}
        >
          <View style={[styles.searchResultAvatar, { backgroundColor: contactResult.userId ? colors.primary[500] : colors.gray[400] }]}>
            <Text style={styles.searchResultAvatarText}>
              {getInitials(contactResult.name)}
            </Text>
          </View>
          <View style={styles.searchResultInfo}>
            <Text style={[styles.searchResultName, { color: textColor }]} numberOfLines={1}>
              {contactResult.name}
            </Text>
            <Text style={[styles.searchResultMeta, { color: secondaryTextColor }]}>
              {contactResult.phone}
            </Text>
          </View>
          <Ionicons name="chevron-forward" size={20} color={secondaryTextColor} />
        </Pressable>
      );
    }
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor }]} edges={['top']}>
      {/* Header */}
      <MotiView
        from={{ opacity: 0, translateY: -20 }}
        animate={{ opacity: 1, translateY: 0 }}
        transition={{ type: 'timing', duration: 300 }}
        style={[styles.header, { borderBottomColor: borderColor }]}
      >
        <Pressable onPress={handleBack} style={styles.headerButton}>
          <Ionicons name="close" size={24} color={textColor} />
        </Pressable>
        <Text style={[styles.headerTitle, { color: textColor }]}>Add Expense</Text>
        <View style={styles.headerButton} />
      </MotiView>

      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        {/* Search Mode: Fixed search bar at top */}
        {isSearchMode && !hasSelectedTarget && (
          <MotiView
            from={{ opacity: 0, translateY: -10 }}
            animate={{ opacity: 1, translateY: 0 }}
            transition={{ type: 'timing', duration: 300 }}
            style={[styles.searchBarFixed, { backgroundColor }]}
          >
            <View style={[styles.searchInputContainer, { backgroundColor: cardBg, borderColor }]}>
              <Ionicons name="search" size={20} color={secondaryTextColor} />
              <TextInput
                style={[styles.searchInput, { color: textColor }]}
                placeholder="Search group or contact..."
                placeholderTextColor={secondaryTextColor}
                value={searchQuery}
                onChangeText={setSearchQuery}
                onFocus={() => setShowSearchResults(true)}
                autoFocus
              />
              {searchQuery.length > 0 && (
                <Pressable onPress={() => setSearchQuery('')}>
                  <Ionicons name="close-circle" size={20} color={secondaryTextColor} />
                </Pressable>
              )}
            </View>
            {errors.target && (
              <Text style={styles.errorMessage}>{errors.target}</Text>
            )}
          </MotiView>
        )}

        {/* Search Results - Scrollable area below fixed search bar */}
        {isSearchMode && !hasSelectedTarget && showSearchResults && (
          <ScrollView
            style={styles.flex}
            contentContainerStyle={styles.searchResultsScrollContent}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            <View style={[styles.searchResultsContainer, { backgroundColor: cardBg }]}>
              {isLoadingSearch ? (
                <View style={styles.searchLoadingContainer}>
                  <ActivityIndicator size="small" color={colors.primary[500]} />
                </View>
              ) : hasContactPermission === false ? (
                <View style={styles.searchEmptyState}>
                  <Ionicons name="lock-closed-outline" size={32} color={colors.gray[400]} />
                  <Text style={[styles.searchEmptyText, { color: secondaryTextColor }]}>
                    Contact permission required
                  </Text>
                </View>
              ) : searchResults.length === 0 ? (
                <View style={styles.searchEmptyState}>
                  <Ionicons name="search-outline" size={32} color={colors.gray[400]} />
                  <Text style={[styles.searchEmptyText, { color: secondaryTextColor }]}>
                    {searchQuery ? 'No results found' : 'Type to search'}
                  </Text>
                </View>
              ) : (
                <View style={styles.searchResultsList}>
                  {searchResults.map((item) => (
                    <View key={`${item.type}-${item.id}`}>
                      {renderSearchResult({ item })}
                    </View>
                  ))}
                </View>
              )}
            </View>
          </ScrollView>
        )}

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
                  <Pressable onPress={handleClearSelection} style={styles.clearButton}>
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
                  style={styles.currencyButton}
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
                    style={[
                      styles.categoryItem,
                      selectedCategory?.id === category.id && {
                        backgroundColor: category.color + '20',
                        borderColor: category.color,
                      },
                    ]}
                    onPress={() => {
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
                  <View style={[styles.memberAvatar, { backgroundColor: colors.primary[500] }]}>
                    <Text style={styles.memberAvatarText}>
                      {getInitials(getMember(paidBy)?.user.name || 'You')}
                    </Text>
                  </View>
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
                    style={[
                      styles.memberItem,
                      paidBy === member.user_id && { backgroundColor: colors.primary[50] },
                    ]}
                    onPress={() => {
                      setPaidBy(member.user_id);
                      setShowPaidByPicker(false);
                    }}
                  >
                    <View style={[styles.memberAvatar, { backgroundColor: colors.gray[400] }]}>
                      <Text style={styles.memberAvatarText}>
                        {getInitials(member.user.name)}
                      </Text>
                    </View>
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

          {/* Split Type - Only show for group expenses with 2+ members */}
          {!isDirectExpense && (group?.members?.length || 0) > 2 && (
            <MotiView
              from={{ opacity: 0, translateY: 10 }}
              animate={{ opacity: 1, translateY: 0 }}
              transition={{ type: 'timing', duration: 300, delay: 300 }}
              style={styles.section}
            >
              <Text style={[styles.sectionLabel, { color: secondaryTextColor }]}>Split</Text>
              <View style={styles.splitTypeContainer}>
                <Pressable
                  style={[
                    styles.splitTypeButton,
                    { backgroundColor: cardBg, borderColor },
                    splitType === 'equal_all' && {
                      backgroundColor: colors.primary[50],
                      borderColor: colors.primary[500],
                    },
                  ]}
                  onPress={() => handleSplitTypeChange('equal_all')}
                >
                  <Ionicons
                    name="people"
                    size={20}
                    color={splitType === 'equal_all' ? colors.primary[500] : secondaryTextColor}
                  />
                  <Text
                    style={[
                      styles.splitTypeText,
                      { color: splitType === 'equal_all' ? colors.primary[500] : textColor },
                    ]}
                  >
                    Equal (All)
                  </Text>
                </Pressable>
                <Pressable
                  style={[
                    styles.splitTypeButton,
                    { backgroundColor: cardBg, borderColor },
                    splitType === 'equal_selected' && {
                      backgroundColor: colors.primary[50],
                      borderColor: colors.primary[500],
                    },
                  ]}
                  onPress={() => handleSplitTypeChange('equal_selected')}
                >
                  <Ionicons
                    name="person"
                    size={20}
                    color={splitType === 'equal_selected' ? colors.primary[500] : secondaryTextColor}
                  />
                  <Text
                    style={[
                      styles.splitTypeText,
                      { color: splitType === 'equal_selected' ? colors.primary[500] : textColor },
                    ]}
                  >
                    Select Members
                  </Text>
                </Pressable>
              </View>
            </MotiView>
          )}

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
                    style={[
                      styles.splitMemberItem,
                      { borderBottomColor: borderColor },
                    ]}
                    onPress={() => {
                      if (splitType === 'equal_selected') {
                        toggleMemberInSplit(member.user_id);
                      }
                    }}
                    disabled={splitType === 'equal_all'}
                  >
                    <View style={styles.splitMemberInfo}>
                      <View
                        style={[
                          styles.memberAvatar,
                          {
                            backgroundColor: isSelected ? colors.primary[500] : colors.gray[400],
                          },
                        ]}
                      >
                        <Text style={styles.memberAvatarText}>
                          {getInitials(member.user.name)}
                        </Text>
                      </View>
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
                      {splitType === 'equal_selected' && (
                        <View
                          style={[
                            styles.checkbox,
                            isSelected && {
                              backgroundColor: colors.primary[500],
                              borderColor: colors.primary[500],
                            },
                            { borderColor },
                          ]}
                        >
                          {isSelected && (
                            <Ionicons name="checkmark" size={14} color={colors.white} />
                          )}
                        </View>
                      )}
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
  // Search styles
  searchBarFixed: {
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 8,
  },
  searchResultsScrollContent: {
    paddingHorizontal: 16,
    paddingBottom: 40,
  },
  searchSection: {
    flex: 1,
  },
  searchInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
    gap: 10,
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
  },
  searchResultsContainer: {
    marginTop: 12,
    borderRadius: 12,
  },
  searchResultsList: {
    // No max height - let it grow naturally
  },
  searchLoadingContainer: {
    padding: 24,
    alignItems: 'center',
  },
  searchEmptyState: {
    padding: 24,
    alignItems: 'center',
    gap: 8,
  },
  searchEmptyText: {
    fontSize: 14,
  },
  searchResultItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    gap: 12,
  },
  searchResultIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  searchResultAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  searchResultAvatarText: {
    color: colors.white,
    fontSize: 14,
    fontWeight: '600',
  },
  searchResultInfo: {
    flex: 1,
  },
  searchResultName: {
    fontSize: 15,
    fontWeight: '500',
  },
  searchResultMeta: {
    fontSize: 13,
    marginTop: 2,
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
  memberAvatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  memberAvatarText: {
    color: colors.white,
    fontSize: 12,
    fontWeight: '600',
  },
  memberName: {
    flex: 1,
    fontSize: 15,
  },
  splitTypeContainer: {
    flexDirection: 'row',
    gap: 12,
  },
  splitTypeButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
    gap: 8,
  },
  splitTypeText: {
    fontSize: 14,
    fontWeight: '500',
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

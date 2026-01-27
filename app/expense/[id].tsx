/**
 * Expense Detail Screen
 * 
 * View, edit, and delete an expense.
 */

import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { MotiView } from 'moti';
import { useCallback, useEffect, useMemo, useState } from 'react';
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
import { SafeAreaView } from 'react-native-safe-area-context';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { colors } from '@/constants/colors';
import { useAuth } from '@/contexts/auth-context';
import { useCategories } from '@/hooks/use-categories';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useExpense } from '@/hooks/use-expense';
import { useGroup } from '@/hooks/use-group';
import type { CurrencyCode, DbCategory, GroupMember } from '@/types';
import { CURRENCIES } from '@/types/database';

export default function ExpenseDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const colorScheme = useColorScheme() ?? 'light';
  const isDark = colorScheme === 'dark';
  const { user } = useAuth();

  const { expense, isLoading, error, updateExpense, deleteExpense, canEdit } = useExpense(id);
  const { group } = useGroup(expense?.group_id);
  const { categories } = useCategories();

  // Edit mode state
  const [isEditing, setIsEditing] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  // Form state for editing
  const [description, setDescription] = useState('');
  const [amount, setAmount] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<DbCategory | null>(null);
  const [notes, setNotes] = useState('');
  const [showCategoryPicker, setShowCategoryPicker] = useState(false);

  // Theme colors
  const textColor = isDark ? colors.text.dark.primary : colors.text.light.primary;
  const secondaryTextColor = isDark ? colors.text.dark.secondary : colors.text.light.secondary;
  const backgroundColor = isDark ? colors.background.dark : colors.background.light;
  const cardBg = isDark ? colors.gray[800] : colors.white;
  const borderColor = isDark ? colors.gray[700] : colors.gray[200];

  // Initialize form with expense data when entering edit mode
  useEffect(() => {
    if (expense && isEditing) {
      setDescription(expense.description);
      setAmount(expense.amount.toString());
      setSelectedCategory(expense.category);
      setNotes(expense.notes || '');
    }
  }, [expense, isEditing]);

  const handleBack = () => {
    if (isEditing) {
      setIsEditing(false);
    } else {
      router.back();
    }
  };

  const handleEdit = () => {
    setIsEditing(true);
  };

  const handleSave = async () => {
    if (!expense) return;

    const amountNum = parseFloat(amount);
    if (!description.trim() || isNaN(amountNum) || amountNum <= 0) {
      Alert.alert('Invalid Input', 'Please enter a valid description and amount.');
      return;
    }

    setIsSubmitting(true);

    // Calculate new splits based on amount change
    const splitCount = expense.splits.length;
    const newSplitAmount = amountNum / splitCount;
    const newSplits = expense.splits.map((s) => ({
      user_id: s.user_id,
      amount: Math.round(newSplitAmount * 100) / 100,
    }));

    const success = await updateExpense(
      {
        description: description.trim(),
        amount: amountNum,
        category_id: selectedCategory?.id || null,
        notes: notes.trim() || null,
      },
      newSplits
    );

    setIsSubmitting(false);

    if (success) {
      setIsEditing(false);
    } else {
      Alert.alert('Error', 'Failed to update expense. Please try again.');
    }
  };

  const handleDelete = () => {
    Alert.alert(
      'Delete Expense',
      'Are you sure you want to delete this expense? This action cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            setIsDeleting(true);
            const success = await deleteExpense();
            setIsDeleting(false);

            if (success) {
              router.back();
            } else {
              Alert.alert('Error', 'Failed to delete expense. Please try again.');
            }
          },
        },
      ]
    );
  };

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-IN', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    });
  };

  const formatCurrency = (value: number, currency: CurrencyCode) => {
    const currencyInfo = CURRENCIES[currency];
    return `${currencyInfo.symbol}${value.toFixed(2)}`;
  };

  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map((n) => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  if (isLoading) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor }]} edges={['top']}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary[500]} />
        </View>
      </SafeAreaView>
    );
  }

  if (error || !expense) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor }]} edges={['top']}>
        <View style={styles.errorContainer}>
          <Ionicons name="alert-circle" size={48} color={colors.error} />
          <Text style={[styles.errorText, { color: textColor }]}>
            {error || 'Expense not found'}
          </Text>
          <Button title="Go Back" onPress={() => router.back()} style={{ marginTop: 16 }} />
        </View>
      </SafeAreaView>
    );
  }

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
          <Ionicons
            name={isEditing ? 'close' : 'arrow-back'}
            size={24}
            color={textColor}
          />
        </Pressable>
        <Text style={[styles.headerTitle, { color: textColor }]}>
          {isEditing ? 'Edit Expense' : 'Expense Details'}
        </Text>
        {canEdit && !isEditing && (
          <Pressable onPress={handleEdit} style={styles.headerButton}>
            <Ionicons name="pencil" size={22} color={colors.primary[500]} />
          </Pressable>
        )}
        {isEditing && (
          <Pressable
            onPress={handleSave}
            disabled={isSubmitting}
            style={styles.headerButton}
          >
            {isSubmitting ? (
              <ActivityIndicator size="small" color={colors.primary[500]} />
            ) : (
              <Ionicons name="checkmark" size={26} color={colors.primary[500]} />
            )}
          </Pressable>
        )}
        {!canEdit && !isEditing && <View style={styles.headerButton} />}
      </MotiView>

      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <ScrollView
          style={styles.flex}
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* Amount Card */}
          <MotiView
            from={{ opacity: 0, translateY: 10 }}
            animate={{ opacity: 1, translateY: 0 }}
            transition={{ type: 'timing', duration: 300, delay: 50 }}
            style={[styles.amountCard, { backgroundColor: colors.primary[500] }]}
          >
            {isEditing ? (
              <View style={styles.amountEditContainer}>
                <Text style={styles.currencySymbolEdit}>
                  {CURRENCIES[expense.currency].symbol}
                </Text>
                <TextInput
                  style={styles.amountInputEdit}
                  value={amount}
                  onChangeText={setAmount}
                  keyboardType="decimal-pad"
                  placeholder="0.00"
                  placeholderTextColor="rgba(255,255,255,0.5)"
                />
              </View>
            ) : (
              <Text style={styles.amountText}>
                {formatCurrency(expense.amount, expense.currency)}
              </Text>
            )}
            {expense.category && (
              <View style={styles.categoryBadge}>
                <Text style={styles.categoryIcon}>{expense.category.icon}</Text>
                <Text style={styles.categoryName}>{expense.category.name}</Text>
              </View>
            )}
          </MotiView>

          {/* Description */}
          <MotiView
            from={{ opacity: 0, translateY: 10 }}
            animate={{ opacity: 1, translateY: 0 }}
            transition={{ type: 'timing', duration: 300, delay: 100 }}
            style={[styles.card, { backgroundColor: cardBg }]}
          >
            <Text style={[styles.cardLabel, { color: secondaryTextColor }]}>Description</Text>
            {isEditing ? (
              <Input
                value={description}
                onChangeText={setDescription}
                placeholder="What's this expense for?"
                containerStyle={{ marginBottom: 0 }}
              />
            ) : (
              <Text style={[styles.cardValue, { color: textColor }]}>
                {expense.description}
              </Text>
            )}
          </MotiView>

          {/* Category (Edit Mode) */}
          {isEditing && (
            <MotiView
              from={{ opacity: 0, translateY: 10 }}
              animate={{ opacity: 1, translateY: 0 }}
              transition={{ type: 'timing', duration: 300, delay: 150 }}
              style={[styles.card, { backgroundColor: cardBg }]}
            >
              <Text style={[styles.cardLabel, { color: secondaryTextColor }]}>Category</Text>
              <Pressable
                onPress={() => setShowCategoryPicker(!showCategoryPicker)}
                style={[styles.selectorButton, { borderColor }]}
              >
                {selectedCategory ? (
                  <View style={styles.selectedCategory}>
                    <Text style={styles.categoryEmoji}>{selectedCategory.icon}</Text>
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
                <View style={styles.categoryGrid}>
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
                </View>
              )}
            </MotiView>
          )}

          {/* Date */}
          <MotiView
            from={{ opacity: 0, translateY: 10 }}
            animate={{ opacity: 1, translateY: 0 }}
            transition={{ type: 'timing', duration: 300, delay: 150 }}
            style={[styles.card, { backgroundColor: cardBg }]}
          >
            <Text style={[styles.cardLabel, { color: secondaryTextColor }]}>Date</Text>
            <View style={styles.dateRow}>
              <Ionicons name="calendar-outline" size={20} color={secondaryTextColor} />
              <Text style={[styles.cardValue, { color: textColor, marginLeft: 8 }]}>
                {formatDate(expense.expense_date)}
              </Text>
            </View>
          </MotiView>

          {/* Paid By */}
          <MotiView
            from={{ opacity: 0, translateY: 10 }}
            animate={{ opacity: 1, translateY: 0 }}
            transition={{ type: 'timing', duration: 300, delay: 200 }}
            style={[styles.card, { backgroundColor: cardBg }]}
          >
            <Text style={[styles.cardLabel, { color: secondaryTextColor }]}>Paid by</Text>
            <View style={styles.paidByRow}>
              <View style={[styles.avatar, { backgroundColor: colors.primary[500] }]}>
                <Text style={styles.avatarText}>
                  {getInitials(expense.paid_by_user.name)}
                </Text>
              </View>
              <Text style={[styles.paidByName, { color: textColor }]}>
                {expense.paid_by_user.id === user?.id ? 'You' : expense.paid_by_user.name}
              </Text>
            </View>
          </MotiView>

          {/* Split Breakdown */}
          <MotiView
            from={{ opacity: 0, translateY: 10 }}
            animate={{ opacity: 1, translateY: 0 }}
            transition={{ type: 'timing', duration: 300, delay: 250 }}
            style={[styles.card, { backgroundColor: cardBg }]}
          >
            <Text style={[styles.cardLabel, { color: secondaryTextColor }]}>
              Split between {expense.splits.length} {expense.splits.length === 1 ? 'person' : 'people'}
            </Text>
            {expense.splits.map((split, index) => (
              <View
                key={split.user_id}
                style={[
                  styles.splitItem,
                  index < expense.splits.length - 1 && {
                    borderBottomWidth: 1,
                    borderBottomColor: borderColor,
                  },
                ]}
              >
                <View style={styles.splitUser}>
                  <View style={[styles.avatarSmall, { backgroundColor: colors.gray[400] }]}>
                    <Text style={styles.avatarTextSmall}>
                      {getInitials(split.user.name)}
                    </Text>
                  </View>
                  <Text style={[styles.splitName, { color: textColor }]}>
                    {split.user_id === user?.id ? 'You' : split.user.name}
                  </Text>
                </View>
                <Text style={[styles.splitAmount, { color: secondaryTextColor }]}>
                  {formatCurrency(split.amount, expense.currency)}
                </Text>
              </View>
            ))}
          </MotiView>

          {/* Notes */}
          {(expense.notes || isEditing) && (
            <MotiView
              from={{ opacity: 0, translateY: 10 }}
              animate={{ opacity: 1, translateY: 0 }}
              transition={{ type: 'timing', duration: 300, delay: 300 }}
              style={[styles.card, { backgroundColor: cardBg }]}
            >
              <Text style={[styles.cardLabel, { color: secondaryTextColor }]}>Notes</Text>
              {isEditing ? (
                <Input
                  value={notes}
                  onChangeText={setNotes}
                  placeholder="Add any additional notes..."
                  multiline
                  numberOfLines={3}
                  containerStyle={{ marginBottom: 0 }}
                />
              ) : (
                <Text style={[styles.cardValue, { color: textColor }]}>
                  {expense.notes}
                </Text>
              )}
            </MotiView>
          )}

          {/* Group Info */}
          {group && (
            <MotiView
              from={{ opacity: 0, translateY: 10 }}
              animate={{ opacity: 1, translateY: 0 }}
              transition={{ type: 'timing', duration: 300, delay: 350 }}
              style={[styles.card, { backgroundColor: cardBg }]}
            >
              <Text style={[styles.cardLabel, { color: secondaryTextColor }]}>Group</Text>
              <View style={styles.groupRow}>
                <View style={[styles.groupIcon, { backgroundColor: colors.primary[100] }]}>
                  <Ionicons name="people" size={18} color={colors.primary[500]} />
                </View>
                <Text style={[styles.groupName, { color: textColor }]}>{group.name}</Text>
              </View>
            </MotiView>
          )}

          {/* Delete Button */}
          {canEdit && (
            <MotiView
              from={{ opacity: 0, translateY: 10 }}
              animate={{ opacity: 1, translateY: 0 }}
              transition={{ type: 'timing', duration: 300, delay: 400 }}
              style={styles.deleteContainer}
            >
              <Pressable
                onPress={handleDelete}
                disabled={isDeleting}
                style={({ pressed }) => [
                  styles.deleteButton,
                  { opacity: pressed || isDeleting ? 0.7 : 1 },
                ]}
              >
                {isDeleting ? (
                  <ActivityIndicator size="small" color={colors.error} />
                ) : (
                  <>
                    <Ionicons name="trash-outline" size={20} color={colors.error} />
                    <Text style={styles.deleteText}>Delete Expense</Text>
                  </>
                )}
              </Pressable>
            </MotiView>
          )}
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
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
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
    textAlign: 'center',
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
  amountCard: {
    padding: 24,
    borderRadius: 20,
    alignItems: 'center',
    marginBottom: 20,
  },
  amountText: {
    fontSize: 42,
    fontWeight: '700',
    color: colors.white,
  },
  amountEditContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  currencySymbolEdit: {
    fontSize: 32,
    fontWeight: '700',
    color: colors.white,
    marginRight: 4,
  },
  amountInputEdit: {
    fontSize: 42,
    fontWeight: '700',
    color: colors.white,
    minWidth: 100,
    textAlign: 'center',
  },
  categoryBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.2)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    marginTop: 12,
  },
  categoryIcon: {
    fontSize: 16,
    marginRight: 6,
  },
  categoryName: {
    fontSize: 14,
    color: colors.white,
    fontWeight: '500',
  },
  card: {
    padding: 16,
    borderRadius: 14,
    marginBottom: 12,
  },
  cardLabel: {
    fontSize: 13,
    fontWeight: '500',
    marginBottom: 8,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  cardValue: {
    fontSize: 16,
    lineHeight: 24,
  },
  dateRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  paidByRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    color: colors.white,
    fontSize: 14,
    fontWeight: '600',
  },
  paidByName: {
    fontSize: 16,
    fontWeight: '500',
    marginLeft: 12,
  },
  splitItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 10,
  },
  splitUser: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  avatarSmall: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarTextSmall: {
    color: colors.white,
    fontSize: 11,
    fontWeight: '600',
  },
  splitName: {
    fontSize: 15,
    marginLeft: 10,
  },
  splitAmount: {
    fontSize: 15,
    fontWeight: '500',
  },
  groupRow: {
    flexDirection: 'row',
    alignItems: 'center',
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
    fontWeight: '500',
    marginLeft: 12,
  },
  deleteContainer: {
    marginTop: 20,
    alignItems: 'center',
  },
  deleteButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 20,
    gap: 8,
  },
  deleteText: {
    color: colors.error,
    fontSize: 16,
    fontWeight: '500',
  },
  selectorButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 12,
    borderRadius: 10,
    borderWidth: 1,
  },
  selectedCategory: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  categoryEmoji: {
    fontSize: 20,
    marginRight: 8,
  },
  selectorText: {
    fontSize: 15,
  },
  selectorPlaceholder: {
    fontSize: 15,
  },
  categoryGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginTop: 12,
  },
  categoryItem: {
    width: '31%',
    alignItems: 'center',
    padding: 10,
    borderRadius: 10,
    margin: '1%',
    borderWidth: 1,
    borderColor: 'transparent',
  },
  categoryItemEmoji: {
    fontSize: 22,
    marginBottom: 4,
  },
  categoryItemText: {
    fontSize: 11,
    textAlign: 'center',
  },
});

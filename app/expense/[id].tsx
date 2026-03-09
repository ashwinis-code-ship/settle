/**
 * Expense Detail Screen
 *
 * Read-only receipt-style view of an expense.
 * Tap "Edit" to navigate to add-expense (pre-filled) for editing.
 */

import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { MotiView } from 'moti';
import { useState } from 'react';
import {
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Avatar } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { colors } from '@/constants/colors';
import { useAuth } from '@/contexts/auth-context';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useExpense } from '@/hooks/use-expense';
import { useGroup } from '@/hooks/use-group';
import { hapticHeavy, hapticSuccess, hapticWarning } from '@/lib/haptics';
import type { CurrencyCode } from '@/types';
import { CURRENCIES } from '@/types/database';

export default function ExpenseDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const colorScheme = useColorScheme() ?? 'light';
  const isDark = colorScheme === 'dark';
  const { user } = useAuth();

  const { expense, isLoading, error, deleteExpense, canEdit } = useExpense(id);
  const { group } = useGroup(expense?.group_id);

  const [isDeleting, setIsDeleting] = useState(false);

  const textColor = isDark ? colors.text.dark.primary : colors.text.light.primary;
  const secondaryTextColor = isDark ? colors.text.dark.secondary : colors.text.light.secondary;
  const backgroundColor = isDark ? colors.background.dark : colors.background.light;
  const cardBg = isDark ? colors.gray[800] : colors.white;
  const separatorColor = isDark ? colors.gray[700] : colors.gray[200];
  const cardBorderColor = isDark ? 'transparent' : colors.gray[200];

  const formatDate = (dateStr: string) =>
    new Date(dateStr).toLocaleDateString('en-IN', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    });

  const formatCurrency = (value: number, currency: CurrencyCode) =>
    `${CURRENCIES[currency].symbol}${value.toFixed(2)}`;

  const handleEdit = () => {
    if (!expense) return;
    router.push({
      pathname: '/add-expense',
      params: { expenseId: id, groupId: expense.group_id },
    });
  };

  const handleDelete = () => {
    hapticHeavy();
    Alert.alert(
      'Delete Expense',
      'Are you sure you want to delete this expense? This cannot be undone.',
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
              hapticSuccess();
              router.back();
            } else {
              hapticWarning();
              Alert.alert('Error', 'Failed to delete expense. Please try again.');
            }
          },
        },
      ]
    );
  };

  const showMetaSection = (group && group.type !== 'direct') || !!expense?.notes;

  // Plain function (not a React component) — safe to call inside any return branch
  // without React treating it as a new component type and unmounting the tree.
  const renderNavBar = (showEdit: boolean) => (
    <MotiView
      from={{ opacity: 0, translateY: -16 }}
      animate={{ opacity: 1, translateY: 0 }}
      transition={{ type: 'spring', damping: 22, stiffness: 220 }}
      style={[styles.navBar, { borderBottomColor: separatorColor }]}
    >
      <Pressable
        onPress={() => router.back()}
        style={({ pressed }) => [styles.navButton, { opacity: pressed ? 0.6 : 1 }]}
      >
        <Ionicons name="arrow-back" size={24} color={textColor} />
      </Pressable>
      <Text style={[styles.navTitle, { color: textColor }]}>Expense Details</Text>
      {showEdit ? (
        <Pressable
          onPress={handleEdit}
          style={({ pressed }) => [styles.navButton, { opacity: pressed ? 0.6 : 1 }]}
        >
          <Ionicons name="pencil" size={20} color={colors.primary[500]} />
        </Pressable>
      ) : (
        <View style={styles.navButton} />
      )}
    </MotiView>
  );

  // --- Loading skeleton ---
  if (isLoading) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor }]} edges={['top']}>
        {renderNavBar(false)}
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          <View style={[styles.receiptCard, { backgroundColor: cardBg, borderColor: cardBorderColor }]}>
            <View style={[styles.receiptTop, { backgroundColor: colors.primary[500] + '0E' }]}>
              <View style={styles.receiptTopMeta}>
                <Skeleton width={90} height={11} borderRadius={6} />
                <Skeleton width={70} height={11} borderRadius={6} />
              </View>
              <Skeleton width={160} height={24} borderRadius={8} style={{ marginTop: 14, marginBottom: 12 }} />
              <Skeleton width={120} height={44} borderRadius={10} />
            </View>
            <View style={[styles.separator, { backgroundColor: separatorColor }]} />
            <View style={styles.receiptSection}>
              <Skeleton width={52} height={10} borderRadius={5} style={{ marginBottom: 14 }} />
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                <Skeleton circle width={36} height={36} />
                <Skeleton width={110} height={16} borderRadius={8} />
              </View>
            </View>
            <View style={[styles.dashedSeparator, { borderColor: separatorColor }]} />
            <View style={styles.receiptSection}>
              <Skeleton width={130} height={10} borderRadius={5} style={{ marginBottom: 14 }} />
              {[0, 1, 2].map((i) => (
                <View key={i} style={[styles.splitRow, { marginBottom: i < 2 ? 14 : 0 }]}>
                  <Skeleton circle width={32} height={32} />
                  <Skeleton width={100} height={14} borderRadius={7} style={{ flex: 1 }} />
                  <Skeleton width={68} height={14} borderRadius={7} />
                </View>
              ))}
            </View>
          </View>
        </ScrollView>
      </SafeAreaView>
    );
  }

  // --- Error state ---
  if (error || !expense) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor }]} edges={['top']}>
        {renderNavBar(false)}
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

  // --- Main receipt view ---
  return (
    <SafeAreaView style={[styles.container, { backgroundColor }]} edges={['top']}>
      {renderNavBar(canEdit)}

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Receipt Card */}
        <MotiView
          from={{ opacity: 0, translateY: 24 }}
          animate={{ opacity: 1, translateY: 0 }}
          transition={{ type: 'spring', damping: 20, stiffness: 180, delay: 60 }}
          style={[styles.receiptCard, { backgroundColor: cardBg, borderColor: cardBorderColor }]}
        >
          {/* Top band: category · date · title · amount */}
          <View style={[styles.receiptTop, { backgroundColor: colors.primary[500] + '0E' }]}>
            <View style={styles.receiptTopMeta}>
              {expense.category ? (
                <View style={styles.categoryPill}>
                  <Text style={styles.categoryPillEmoji}>{expense.category.icon}</Text>
                  <Text style={[styles.categoryPillName, { color: secondaryTextColor }]}>
                    {expense.category.name}
                  </Text>
                </View>
              ) : (
                <View style={styles.categoryPill}>
                  <Ionicons name="receipt-outline" size={12} color={secondaryTextColor} />
                  <Text style={[styles.categoryPillName, { color: secondaryTextColor }]}>
                    Expense
                  </Text>
                </View>
              )}
              <Text style={[styles.receiptDate, { color: secondaryTextColor }]}>
                {formatDate(expense.expense_date)}
              </Text>
            </View>

            <Text style={[styles.receiptTitle, { color: textColor }]} numberOfLines={2}>
              {expense.description}
            </Text>
            <Text style={[styles.receiptAmount, { color: textColor }]}>
              {formatCurrency(expense.amount, expense.currency)}
            </Text>
          </View>

          {/* Solid hairline separator */}
          <View style={[styles.separator, { backgroundColor: separatorColor }]} />

          {/* Paid by */}
          <View style={styles.receiptSection}>
            <Text style={[styles.sectionLabel, { color: secondaryTextColor }]}>PAID BY</Text>
            <View style={styles.paidByRow}>
              <Avatar user={expense.paid_by_user} size={36} />
              <Text style={[styles.paidByName, { color: textColor }]}>
                {expense.paid_by_user.id === user?.id ? 'You' : expense.paid_by_user.name}
              </Text>
            </View>
          </View>

          {/* Dashed separator */}
          <View style={[styles.dashedSeparator, { borderColor: separatorColor }]} />

          {/* Split breakdown */}
          <View style={styles.receiptSection}>
            <Text style={[styles.sectionLabel, { color: secondaryTextColor }]}>
              SPLIT BETWEEN {expense.splits.length}{' '}
              {expense.splits.length === 1 ? 'PERSON' : 'PEOPLE'}
            </Text>
            {expense.splits.map((split, index) => (
              <View
                key={split.user_id}
                style={[styles.splitRow, index < expense.splits.length - 1 && styles.splitRowGap]}
              >
                <Avatar user={split.user} size={32} />
                <Text style={[styles.splitName, { color: textColor }]}>
                  {split.user_id === user?.id ? 'You' : split.user.name}
                </Text>
                <Text style={[styles.splitAmount, { color: secondaryTextColor }]}>
                  {formatCurrency(split.amount, expense.currency)}
                </Text>
              </View>
            ))}
          </View>

          {/* Footer: group + notes (conditional) */}
          {showMetaSection && (
            <>
              <View style={[styles.dashedSeparator, { borderColor: separatorColor }]} />
              <View style={styles.receiptSection}>
                {group && group.type !== 'direct' && (
                  <View style={styles.metaRow}>
                    <Text style={[styles.metaLabel, { color: secondaryTextColor }]}>Group</Text>
                    <View style={styles.metaValueRow}>
                      <Avatar group={group} size={20} />
                      <Text style={[styles.metaValue, { color: textColor }]}>{group.name}</Text>
                    </View>
                  </View>
                )}
                {expense.notes ? (
                  <View style={styles.metaRow}>
                    <Text style={[styles.metaLabel, { color: secondaryTextColor }]}>Notes</Text>
                    <Text style={[styles.metaValue, styles.metaNotes, { color: textColor }]}>
                      {expense.notes}
                    </Text>
                  </View>
                ) : null}
              </View>
            </>
          )}
        </MotiView>

        {/* Actions */}
        {canEdit && (
          <MotiView
            from={{ opacity: 0, translateY: 16 }}
            animate={{ opacity: 1, translateY: 0 }}
            transition={{ type: 'spring', damping: 20, stiffness: 180, delay: 180 }}
            style={styles.actionsContainer}
          >
            <Pressable
              onPress={handleDelete}
              disabled={isDeleting}
              style={({ pressed }) => [
                styles.deleteButton,
                { opacity: pressed || isDeleting ? 0.6 : 1 },
              ]}
            >
              <Ionicons name="trash-outline" size={16} color={colors.error} />
              <Text style={styles.deleteButtonText}>
                {isDeleting ? 'Deleting…' : 'Delete Expense'}
              </Text>
            </Pressable>
          </MotiView>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  navBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  navButton: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  navTitle: {
    fontSize: 18,
    fontWeight: '600',
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
  scrollContent: {
    padding: 20,
    paddingBottom: 52,
  },
  receiptCard: {
    borderRadius: 20,
    overflow: 'hidden',
    borderWidth: StyleSheet.hairlineWidth,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 16,
    elevation: 4,
  },
  receiptTop: {
    paddingHorizontal: 24,
    paddingTop: 22,
    paddingBottom: 20,
  },
  receiptTopMeta: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 14,
  },
  categoryPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  categoryPillEmoji: {
    fontSize: 13,
  },
  categoryPillName: {
    fontSize: 11,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  receiptDate: {
    fontSize: 11,
    fontWeight: '500',
  },
  receiptTitle: {
    fontSize: 22,
    fontWeight: '600',
    letterSpacing: -0.3,
    lineHeight: 28,
    marginBottom: 6,
  },
  receiptAmount: {
    fontSize: 44,
    fontWeight: '700',
    letterSpacing: -1.5,
  },
  separator: {
    height: StyleSheet.hairlineWidth,
  },
  dashedSeparator: {
    borderStyle: 'dashed',
    borderTopWidth: 1,
    marginHorizontal: 20,
  },
  receiptSection: {
    paddingHorizontal: 24,
    paddingVertical: 20,
  },
  sectionLabel: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 1.2,
    marginBottom: 14,
  },
  paidByRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  paidByName: {
    fontSize: 16,
    fontWeight: '600',
  },
  splitRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  splitRowGap: {
    marginBottom: 14,
  },
  splitName: {
    flex: 1,
    fontSize: 15,
  },
  splitAmount: {
    fontSize: 15,
    fontWeight: '500',
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 16,
    marginBottom: 10,
  },
  metaLabel: {
    fontSize: 13,
    fontWeight: '500',
    width: 46,
    paddingTop: 1,
  },
  metaValueRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flex: 1,
  },
  metaValue: {
    fontSize: 14,
    flex: 1,
  },
  metaNotes: {
    lineHeight: 20,
  },
  actionsContainer: {
    marginTop: 20,
    gap: 10,
  },
  deleteButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 10,
  },
  deleteButtonText: {
    fontSize: 15,
    fontWeight: '500',
    color: colors.error,
  },
});

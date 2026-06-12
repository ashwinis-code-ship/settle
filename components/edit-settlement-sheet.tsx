/**
 * Edit Settlement Sheet
 *
 * Bottom sheet for editing settlement amount and notes.
 * Mirrors ContactPickerSheet pattern used in group settings.
 */

import BottomSheet, { BottomSheetScrollView } from '@gorhom/bottom-sheet';
import { forwardRef, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Keyboard,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  TouchableWithoutFeedback,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { SheetBackground } from '@/components/ui/sheet-background';
import { colors } from '@/constants/colors';
import { useColorScheme } from '@/hooks/use-color-scheme';

export interface EditSettlementSheetProps {
  amount: string;
  notes: string;
  onAmountChange: (value: string) => void;
  onNotesChange: (value: string) => void;
  onCancel: () => void;
  onUpdate: () => void;
  isUpdating: boolean;
  currencySymbol: string;
}

export const EditSettlementSheet = forwardRef<BottomSheet, EditSettlementSheetProps>(
  (
    {
      amount,
      notes,
      onAmountChange,
      onNotesChange,
      onCancel,
      onUpdate,
      isUpdating,
      currencySymbol,
    },
    ref
  ) => {
    const colorScheme = useColorScheme() ?? 'light';
    const isDark = colorScheme === 'dark';
    const insets = useSafeAreaInsets();

    const snapPoints = useMemo(() => ['48%'], []);
    const textColor = isDark ? colors.text.dark.primary : colors.text.light.primary;
    const secondaryTextColor = isDark ? colors.text.dark.secondary : colors.text.light.secondary;
    const inputBg = isDark ? colors.gray[700] : colors.gray[100];

    const [isOpen, setIsOpen] = useState(false);

    const sheetStyle = useMemo(
      () =>
        isOpen
          ? {
              shadowColor: '#000',
              shadowOffset: { width: 0, height: -6 },
              shadowOpacity: 0.12,
              shadowRadius: 16,
              elevation: 20,
            }
          : undefined,
      [isOpen]
    );

    return (
      <BottomSheet
        ref={ref}
        index={-1}
        snapPoints={snapPoints}
        bottomInset={insets.bottom}
        enablePanDownToClose
        enableOverDrag={false}
        enableDynamicSizing={false}
        style={sheetStyle}
        onChange={(index) => setIsOpen(index >= 0)}
        onClose={onCancel}
        backgroundComponent={SheetBackground}
        backgroundStyle={{ backgroundColor: 'transparent' }}
        handleIndicatorStyle={{ backgroundColor: colors.gray[400] }}
      >
        <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
          <BottomSheetScrollView
            contentContainerStyle={[styles.content, { paddingBottom: Math.max(insets.bottom, 34) + 32 }]}
            showsVerticalScrollIndicator={false}
          >
            <Text style={[styles.title, { color: textColor }]}>Edit settlement</Text>
            <View style={styles.form}>
              <Text style={[styles.label, { color: secondaryTextColor }]}>Amount</Text>
              <View style={[styles.amountRow, { backgroundColor: inputBg }]}>
                <Text style={[styles.currency, { color: textColor }]}>{currencySymbol}</Text>
                <TextInput
                  style={[styles.amountInput, { color: textColor }]}
                  placeholder="0.00"
                  placeholderTextColor={secondaryTextColor}
                  value={amount}
                  onChangeText={onAmountChange}
                  keyboardType="decimal-pad"
                  selectTextOnFocus
                />
              </View>
              <Text style={[styles.label, { color: secondaryTextColor }]}>Notes (optional)</Text>
              <TextInput
                style={[styles.notesInput, { color: textColor, backgroundColor: inputBg }]}
                placeholder="e.g., Paid via UPI"
                placeholderTextColor={secondaryTextColor}
                value={notes}
                onChangeText={onNotesChange}
                multiline
                numberOfLines={2}
              />
            </View>
            <View style={styles.actions}>
              <Pressable
                onPress={onCancel}
                style={[styles.cancelButton, { borderColor: colors.gray[400] }]}
              >
                <Text style={[styles.cancelText, { color: secondaryTextColor }]}>Cancel</Text>
              </Pressable>
              <Pressable
                onPress={onUpdate}
                disabled={isUpdating}
                style={({ pressed }) => [
                  styles.updateButton,
                  { backgroundColor: colors.primary[500], opacity: pressed ? 0.8 : 1 },
                  isUpdating && styles.buttonDisabled,
                ]}
              >
                {isUpdating ? (
                  <ActivityIndicator size="small" color={colors.white} />
                ) : (
                  <Text style={styles.updateText}>Update</Text>
                )}
              </Pressable>
            </View>
          </BottomSheetScrollView>
        </TouchableWithoutFeedback>
      </BottomSheet>
    );
  }
);

EditSettlementSheet.displayName = 'EditSettlementSheet';

const styles = StyleSheet.create({
  content: {
    padding: 20,
    paddingBottom: 24,
  },
  title: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 20,
  },
  form: {
    gap: 12,
    marginBottom: 24,
  },
  label: {
    fontSize: 14,
    fontWeight: '500',
  },
  amountRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderRadius: 12,
    gap: 8,
  },
  currency: {
    fontSize: 20,
    fontWeight: '600',
  },
  amountInput: {
    flex: 1,
    fontSize: 20,
    fontWeight: '600',
    padding: 0,
  },
  notesInput: {
    padding: 14,
    borderRadius: 12,
    fontSize: 15,
    minHeight: 60,
    textAlignVertical: 'top',
  },
  actions: {
    flexDirection: 'row',
    gap: 12,
  },
  cancelButton: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: 'center',
  },
  cancelText: {
    fontSize: 16,
    fontWeight: '600',
  },
  updateButton: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
  },
  updateText: {
    color: colors.white,
    fontSize: 16,
    fontWeight: '600',
  },
  buttonDisabled: {
    opacity: 0.6,
  },
});

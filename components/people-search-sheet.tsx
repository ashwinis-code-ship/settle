/**
 * PeopleSearchSheet
 *
 * Unified bottom sheet for searching and selecting contacts and/or groups.
 * Powered by useEnrichedContacts — shows real profile photos for in-app users.
 *
 * Modes:
 *   Multi-select  (create-group, group settings) — checkboxes, Done button,
 *                  contacts only
 *   Group+contact  (add-expense)                 — showGroups=true,
 *                  single tap calls onGroupSelect or onContactSelect
 */

import { Ionicons } from '@expo/vector-icons';
import BottomSheet, { BottomSheetFlatList, BottomSheetTextInput } from '@gorhom/bottom-sheet';
import { forwardRef, useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Linking,
  Pressable,
  StyleSheet,
  Text,
  TextStyle,
  View,
  ViewStyle,
} from 'react-native';

import { Avatar } from '@/components/ui/avatar';
import { colors } from '@/constants/colors';
import { useColorScheme } from '@/hooks/use-color-scheme';
import type { SearchResultGroup } from '@/hooks/use-contact-group-search';
import type { EnrichedContact } from '@/hooks/use-enriched-contacts';
import { useEnrichedContacts } from '@/hooks/use-enriched-contacts';

// ─── List item union ──────────────────────────────────────────────────────────

type SectionHeaderItem = { _type: 'sectionHeader'; label: string };
type GroupListItem = { _type: 'group'; data: SearchResultGroup };
type ContactListItem = { _type: 'contact'; data: EnrichedContact };
type ListItem = SectionHeaderItem | GroupListItem | ContactListItem;

// ─── Props ────────────────────────────────────────────────────────────────────

export interface PeopleSearchSheetProps {
  /**
   * Fired on every contact row tap.
   * In multi-select the parent owns state and toggles the item;
   * in single-select the parent should close the sheet after this.
   */
  onContactSelect: (contact: EnrichedContact) => void;
  /** Controlled selected-contact IDs; drives checkbox visuals */
  selectedIds?: Set<string>;
  /** Show the current user's regular groups above contacts (default: false) */
  showGroups?: boolean;
  /** Fired when a group row is tapped */
  onGroupSelect?: (group: SearchResultGroup) => void;
  title?: string;
  /** When provided, a "Done" button appears in the header */
  doneText?: string;
  onClose?: () => void;
  /** Fired when the close animation begins (before it completes) */
  onStartClose?: () => void;
  onDone?: () => void;
}

// ─── Component ────────────────────────────────────────────────────────────────

export const PeopleSearchSheet = forwardRef<BottomSheet, PeopleSearchSheetProps>(
  (
    {
      onContactSelect,
      selectedIds,
      showGroups = false,
      onGroupSelect,
      title = 'Add Members',
      doneText,
      onClose,
      onStartClose,
      onDone,
    },
    ref
  ) => {
    const colorScheme = useColorScheme() ?? 'light';
    const isDark = colorScheme === 'dark';
    const snapPoints = useMemo(() => ['90%'], []);
    const [searchQuery, setSearchQuery] = useState('');

    const textColor = isDark ? colors.text.dark.primary : colors.text.light.primary;
    const secondaryTextColor = isDark ? colors.text.dark.secondary : colors.text.light.secondary;
    const sheetBg = isDark ? colors.gray[900] : colors.white;

    const { contacts, groups, isLoading, hasContactPermission, loadInitialData } =
      useEnrichedContacts();

    useEffect(() => {
      loadInitialData();
    }, [loadInitialData]);

    // ── Filtered list ─────────────────────────────────────────────────────────

    const listItems = useMemo<ListItem[]>(() => {
      const q = searchQuery.trim().toLowerCase();

      const filteredGroups = showGroups
        ? groups.filter(g => !q || g.name.toLowerCase().includes(q))
        : [];

      const filteredContacts = contacts.filter(
        c => !q || c.name.toLowerCase().includes(q) || c.phone.includes(q)
      );

      const items: ListItem[] = [];

      if (filteredGroups.length > 0) {
        items.push({ _type: 'sectionHeader', label: 'Groups' });
        filteredGroups.forEach(g => items.push({ _type: 'group', data: g }));
      }

      if (filteredContacts.length > 0) {
        if (filteredGroups.length > 0) {
          items.push({ _type: 'sectionHeader', label: 'Contacts' });
        }
        filteredContacts.forEach(c => items.push({ _type: 'contact', data: c }));
      }

      return items;
    }, [searchQuery, contacts, groups, showGroups]);

    const contactCount = useMemo(
      () => listItems.filter(i => i._type === 'contact').length,
      [listItems]
    );

    // ── Handlers ──────────────────────────────────────────────────────────────

    const handleSheetClose = useCallback(() => {
      setSearchQuery('');
      onClose?.();
    }, [onClose]);

    const handleDonePress = useCallback(() => {
      onDone?.();
      (ref as React.RefObject<BottomSheet>)?.current?.close();
    }, [onDone, ref]);

    // ── Row renderers ─────────────────────────────────────────────────────────

    const renderSectionHeader = useCallback(
      (label: string) => (
        <View style={[styles.sectionHeader, { backgroundColor: sheetBg }]}>
          <Text style={[styles.sectionHeaderText, { color: secondaryTextColor }]}>{label}</Text>
        </View>
      ),
      [sheetBg, secondaryTextColor]
    );

    const renderGroupRow = useCallback(
      (group: SearchResultGroup) => (
        <Pressable
          onPress={() => onGroupSelect?.(group)}
          style={({ pressed }) => [styles.row, { opacity: pressed ? 0.75 : 1 }]}
        >
          <Avatar group={group} size={44} />
          <View style={styles.rowInfo}>
            <Text style={[styles.rowName, { color: textColor }]} numberOfLines={1}>
              {group.name}
            </Text>
            <Text style={[styles.rowMeta, { color: secondaryTextColor }]}>
              {group.memberCount} {group.memberCount === 1 ? 'member' : 'members'}
            </Text>
          </View>
          <Ionicons name="chevron-forward" size={20} color={secondaryTextColor} />
        </Pressable>
      ),
      [onGroupSelect, textColor, secondaryTextColor]
    );

    const renderContactRow = useCallback(
      (contact: EnrichedContact) => {
        const isSelected = selectedIds?.has(contact.id) ?? false;
        const isMultiSelect = selectedIds !== undefined;
        const label = contact.phoneLabel
          ? contact.phoneLabel.charAt(0).toUpperCase() + contact.phoneLabel.slice(1).toLowerCase()
          : undefined;

        return (
          <Pressable
            onPress={() => onContactSelect(contact)}
            style={({ pressed }) => [
              styles.row,
              isMultiSelect && styles.contactRowBordered,
              {
                backgroundColor: isSelected ? colors.primary[50] : 'transparent',
                borderColor: isSelected
                  ? colors.primary[500]
                  : isDark
                  ? colors.gray[700]
                  : colors.gray[200],
                opacity: pressed ? 0.8 : 1,
              },
            ]}
          >
            <Avatar
              user={{ name: contact.name, avatar_url: contact.avatarUrl ?? null }}
              size={44}
            />
            <View style={styles.rowInfo}>
              <Text style={[styles.rowName, { color: textColor }]} numberOfLines={1}>
                {contact.name}
              </Text>
              <Text style={[styles.rowMeta, { color: secondaryTextColor }]} numberOfLines={1}>
                {contact.phone}
                {label ? ` · ${label}` : ''}
              </Text>
            </View>
            {isMultiSelect && (
              <View
                style={[
                  styles.checkbox,
                  isSelected && styles.checkboxSelected,
                  { borderColor: isSelected ? colors.primary[500] : colors.gray[400] },
                ]}
              >
                {isSelected && <Ionicons name="checkmark" size={16} color={colors.white} />}
              </View>
            )}
          </Pressable>
        );
      },
      [selectedIds, onContactSelect, isDark, textColor, secondaryTextColor]
    );

    const renderItem = useCallback(
      ({ item }: { item: ListItem }) => {
        if (item._type === 'sectionHeader') return renderSectionHeader(item.label);
        if (item._type === 'group') return renderGroupRow(item.data);
        return renderContactRow(item.data);
      },
      [renderSectionHeader, renderGroupRow, renderContactRow]
    );

    const keyExtractor = useCallback((item: ListItem, index: number) => {
      if (item._type === 'sectionHeader') return `header-${index}`;
      if (item._type === 'group') return `group-${item.data.id}`;
      return `contact-${item.data.id}`;
    }, []);

    // ── Render ────────────────────────────────────────────────────────────────

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
        onAnimate={(fromIndex, toIndex) => {
          if (toIndex === -1) onStartClose?.();
        }}
      >
        {/* Header */}
        <View
          style={[
            styles.header,
            { borderBottomColor: isDark ? colors.gray[700] : colors.gray[200] },
          ]}
        >
          <Text style={[styles.headerTitle, { color: textColor }]}>{title}</Text>
          {doneText && (
            <Pressable onPress={handleDonePress} style={styles.headerDoneButton}>
              <Text style={[styles.headerDoneText, { color: colors.primary[500] }]}>
                {doneText}
              </Text>
            </Pressable>
          )}
        </View>

        {/* Search */}
        <View style={styles.searchContainer}>
          <View
            style={[
              styles.searchBox,
              { backgroundColor: isDark ? colors.gray[800] : colors.gray[100] },
            ]}
          >
            <Ionicons name="search-outline" size={20} color={colors.gray[400]} />
            <BottomSheetTextInput
              placeholder="Search by name or number..."
              placeholderTextColor={colors.gray[400]}
              value={searchQuery}
              onChangeText={setSearchQuery}
              style={[styles.searchInput, { color: textColor }]}
            />
            {searchQuery.length > 0 && (
              <Pressable onPress={() => setSearchQuery('')}>
                <Ionicons name="close-circle" size={20} color={colors.gray[400]} />
              </Pressable>
            )}
          </View>
        </View>

        {/* Count label */}
        {hasContactPermission && !isLoading && (
          <Text style={[styles.countLabel, { color: secondaryTextColor }]}>
            {searchQuery
              ? `${contactCount} ${contactCount === 1 ? 'result' : 'results'}`
              : `All Contacts (${contacts.length})`}
          </Text>
        )}

        {/* Permission denied */}
        {hasContactPermission === false && (
          <View style={styles.stateContainer}>
            <Ionicons name="lock-closed-outline" size={48} color={colors.gray[400]} />
            <Text style={[styles.stateTitle, { color: textColor }]}>
              Contact Access Required
            </Text>
            <Text style={[styles.stateBody, { color: secondaryTextColor }]}>
              To add members, please allow access to your contacts in Settings.
            </Text>
            <Pressable
              onPress={() => Linking.openSettings()}
              style={[styles.settingsButton, { backgroundColor: colors.primary[500] }]}
            >
              <Text style={styles.settingsButtonText}>Open Settings</Text>
            </Pressable>
          </View>
        )}

        {/* Loading */}
        {isLoading && hasContactPermission !== false && (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="small" color={colors.primary[500]} />
            <Text style={[styles.loadingText, { color: secondaryTextColor }]}>
              Loading contacts...
            </Text>
          </View>
        )}

        {/* List */}
        {hasContactPermission && !isLoading && (
          <BottomSheetFlatList
            data={listItems}
            renderItem={renderItem}
            keyExtractor={keyExtractor}
            ListEmptyComponent={
              <View style={styles.emptyState}>
                <Ionicons name="person-add-outline" size={48} color={colors.gray[400]} />
                <Text style={[styles.emptyStateText, { color: secondaryTextColor }]}>
                  {searchQuery ? 'No results found' : 'No contacts available'}
                </Text>
              </View>
            }
            contentContainerStyle={styles.listContent}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
          />
        )}
      </BottomSheet>
    );
  }
);

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingBottom: 16,
    borderBottomWidth: 1,
  } as ViewStyle,
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    flex: 1,
    textAlign: 'center',
    paddingLeft: 44,
  } as TextStyle,
  headerDoneButton: {
    width: 44,
    alignItems: 'flex-end',
  } as ViewStyle,
  headerDoneText: {
    fontSize: 16,
    fontWeight: '600',
  } as TextStyle,
  searchContainer: {
    paddingHorizontal: 20,
    paddingVertical: 16,
  } as ViewStyle,
  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 12,
    gap: 8,
  } as ViewStyle,
  searchInput: {
    flex: 1,
    fontSize: 16,
    padding: 0,
  } as TextStyle,
  countLabel: {
    fontSize: 13,
    fontWeight: '500',
    paddingHorizontal: 20,
    marginBottom: 12,
  } as TextStyle,
  sectionHeader: {
    paddingHorizontal: 20,
    paddingVertical: 6,
  } as ViewStyle,
  sectionHeaderText: {
    fontSize: 12,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  } as TextStyle,
  listContent: {
    paddingHorizontal: 20,
    paddingBottom: 40,
  } as ViewStyle,
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 4,
    gap: 12,
  } as ViewStyle,
  contactRowBordered: {
    padding: 12,
    borderRadius: 12,
    marginBottom: 8,
    borderWidth: 1,
  } as ViewStyle,
  rowInfo: {
    flex: 1,
  } as ViewStyle,
  rowName: {
    fontSize: 16,
    fontWeight: '500',
  } as TextStyle,
  rowMeta: {
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
  stateContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 40,
  } as ViewStyle,
  stateTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginTop: 16,
    marginBottom: 8,
    textAlign: 'center',
  } as TextStyle,
  stateBody: {
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

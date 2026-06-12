/**
 * Country Picker Component
 * 
 * Modal picker for selecting country dial code.
 */

import { useState, useCallback } from 'react';
import {
  StyleSheet,
  View,
  Text,
  Pressable,
  Modal,
  TextInput,
} from 'react-native';
import { FlashList } from '@shopify/flash-list';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MotiView } from 'moti';
import { IconSymbol } from '@/components/ui/icon-symbol';

import { colors } from '@/constants/colors';
import { countries, type Country, DEFAULT_COUNTRY } from '@/constants/countries';
import { useColorScheme } from '@/hooks/use-color-scheme';

interface CountryPickerProps {
  selectedCountry: Country;
  onSelect: (country: Country) => void;
}

export function CountryPicker({ selectedCountry, onSelect }: CountryPickerProps) {
  const colorScheme = useColorScheme() ?? 'light';
  const isDark = colorScheme === 'dark';
  
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState('');

  const filteredCountries = countries.filter(
    (country) =>
      country.name.toLowerCase().includes(search.toLowerCase()) ||
      country.dialCode.includes(search) ||
      country.code.toLowerCase().includes(search.toLowerCase())
  );

  const handleSelect = useCallback((country: Country) => {
    onSelect(country);
    setIsOpen(false);
    setSearch('');
  }, [onSelect]);

  const backgroundColor = isDark ? colors.gray[800] : colors.white;
  const textColor = isDark ? colors.text.dark.primary : colors.text.light.primary;
  const secondaryTextColor = isDark ? colors.text.dark.secondary : colors.text.light.secondary;
  const borderColor = isDark ? colors.gray[700] : colors.gray[300];
  const modalBg = isDark ? colors.background.dark : colors.background.light;

  return (
    <>
      {/* Trigger Button */}
      <Pressable
        onPress={() => setIsOpen(true)}
        style={[
          styles.trigger,
          { backgroundColor, borderColor },
        ]}
      >
        <Text style={styles.flag}>{selectedCountry.flag}</Text>
        <Text style={[styles.dialCode, { color: textColor }]}>
          {selectedCountry.dialCode}
        </Text>
        <IconSymbol
          name="chevron.down"
          size={16}
          color={secondaryTextColor}
        />
      </Pressable>

      {/* Modal */}
      <Modal
        visible={isOpen}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setIsOpen(false)}
      >
        <SafeAreaView style={[styles.modal, { backgroundColor: modalBg }]} edges={['top']}>
          {/* Header */}
          <View style={[styles.header, { borderBottomColor: borderColor }]}>
            <Pressable onPress={() => setIsOpen(false)} style={styles.closeButton}>
              <IconSymbol name="xmark" size={24} color={textColor} />
            </Pressable>
            <Text style={[styles.headerTitle, { color: textColor }]}>
              Select Country
            </Text>
            <View style={styles.closeButton} />
          </View>

          {/* Search */}
          <View style={[styles.searchContainer, { backgroundColor, borderColor }]}>
            <IconSymbol name="magnifyingglass" size={20} color={secondaryTextColor} />
            <TextInput
              style={[styles.searchInput, { color: textColor }]}
              placeholder="Search country..."
              placeholderTextColor={secondaryTextColor}
              value={search}
              onChangeText={setSearch}
              autoCorrect={false}
            />
            {search.length > 0 && (
              <Pressable onPress={() => setSearch('')}>
                <IconSymbol name="xmark.circle" size={20} color={secondaryTextColor} />
              </Pressable>
            )}
          </View>

          {/* Country List */}
          <FlashList
            data={filteredCountries}
            keyExtractor={(item) => item.code}
            contentContainerStyle={styles.listContent}
            keyboardShouldPersistTaps="handled"
            renderItem={({ item }) => {
              const isSelected = item.code === selectedCountry.code;
              return (
                <Pressable
                  onPress={() => handleSelect(item)}
                  style={[
                    styles.countryItem,
                    { borderBottomColor: borderColor },
                    isSelected && { backgroundColor: isDark ? colors.gray[800] : colors.primary[50] },
                  ]}
                >
                  <Text style={styles.countryFlag}>{item.flag}</Text>
                  <View style={styles.countryInfo}>
                    <Text style={[styles.countryName, { color: textColor }]}>
                      {item.name}
                    </Text>
                    <Text style={[styles.countryDialCode, { color: secondaryTextColor }]}>
                      {item.dialCode}
                    </Text>
                  </View>
                  {isSelected && (
                    <IconSymbol name="checkmark.circle.fill" size={24} color={colors.primary[500]} />
                  )}
                </Pressable>
              );
            }}
            ListEmptyComponent={
              <View style={styles.emptyState}>
                <Text style={[styles.emptyText, { color: secondaryTextColor }]}>
                  No countries found
                </Text>
              </View>
            }
          />
        </SafeAreaView>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  trigger: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    height: 52, // Match input height (14 padding * 2 + 16 font + 8 line height adjustment)
    borderWidth: 1.5,
    borderRadius: 12,
    marginRight: 8,
    gap: 6,
  },
  flag: {
    fontSize: 20,
  },
  dialCode: {
    fontSize: 16,
    fontWeight: '500',
  },
  modal: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  closeButton: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    margin: 16,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderWidth: 1,
    borderRadius: 12,
    gap: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
  },
  listContent: {
    paddingBottom: 40,
  },
  countryItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  countryFlag: {
    fontSize: 28,
    marginRight: 12,
  },
  countryInfo: {
    flex: 1,
  },
  countryName: {
    fontSize: 16,
    fontWeight: '500',
  },
  countryDialCode: {
    fontSize: 14,
    marginTop: 2,
  },
  emptyState: {
    padding: 40,
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 16,
  },
});

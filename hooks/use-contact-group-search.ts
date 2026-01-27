/**
 * Contact & Group Search Hook
 * 
 * Searches through phone contacts and user's groups.
 * Used for the add-expense screen when no group is pre-selected.
 */

import { useCallback, useEffect, useState } from 'react';
import * as Contacts from 'expo-contacts';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/auth-context';
import type { ContactEntry } from '@/types';

export interface SearchResultGroup {
  type: 'group';
  id: string;
  name: string;
  memberCount: number;
}

export interface SearchResultContact {
  type: 'contact';
  id: string;
  name: string;
  phone: string;
  /** If this contact exists in the app (registered or shadow user) */
  userId?: string;
  /** Avatar URL if user exists */
  avatarUrl?: string | null;
}

export type SearchResult = SearchResultGroup | SearchResultContact;

interface UseContactGroupSearchResult {
  searchResults: SearchResult[];
  isLoading: boolean;
  hasContactPermission: boolean | null;
  search: (query: string) => void;
  loadInitialData: () => Promise<void>;
}

export function useContactGroupSearch(): UseContactGroupSearchResult {
  const { user } = useAuth();

  const [contacts, setContacts] = useState<ContactEntry[]>([]);
  const [groups, setGroups] = useState<SearchResultGroup[]>([]);
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [hasContactPermission, setHasContactPermission] = useState<boolean | null>(null);
  const [userPhoneMap, setUserPhoneMap] = useState<Map<string, { id: string; avatarUrl: string | null }>>(new Map());

  // Load contacts from phone
  const loadContacts = useCallback(async () => {
    try {
      const { status } = await Contacts.requestPermissionsAsync();
      if (status !== 'granted') {
        setHasContactPermission(false);
        return;
      }
      setHasContactPermission(true);

      const { data } = await Contacts.getContactsAsync({
        fields: [Contacts.Fields.Name, Contacts.Fields.PhoneNumbers],
      });

      const flattenedContacts: ContactEntry[] = [];
      data.forEach((contact) => {
        if (contact.phoneNumbers && contact.phoneNumbers.length > 0) {
          contact.phoneNumbers.forEach((phoneNumber, index) => {
            if (phoneNumber.number) {
              const cleanNumber = phoneNumber.number.replace(/\s/g, '');
              flattenedContacts.push({
                id: `${contact.id}_${index}`,
                name: contact.name || 'Unknown',
                phone: cleanNumber,
                phoneLabel: phoneNumber.label || undefined,
              });
            }
          });
        }
      });

      flattenedContacts.sort((a, b) => a.name.localeCompare(b.name));
      setContacts(flattenedContacts);

      // Check which contacts exist in the app
      const phoneNumbers = flattenedContacts.map(c => c.phone);
      const normalizedPhones = phoneNumbers.map(p => {
        // Normalize: remove spaces, ensure +91 prefix for Indian numbers
        const clean = p.replace(/[\s-]/g, '');
        if (clean.startsWith('+')) return clean;
        if (clean.startsWith('91') && clean.length > 10) return `+${clean}`;
        return `+91${clean.replace(/^0/, '')}`;
      });

      if (normalizedPhones.length > 0) {
        const { data: existingUsers } = await supabase
          .from('users')
          .select('id, phone, avatar_url')
          .in('phone', normalizedPhones);

        if (existingUsers) {
          const phoneMap = new Map<string, { id: string; avatarUrl: string | null }>();
          existingUsers.forEach(u => {
            phoneMap.set(u.phone, { id: u.id, avatarUrl: u.avatar_url });
          });
          setUserPhoneMap(phoneMap);
        }
      }
    } catch (error) {
      console.error('[useContactGroupSearch] Error loading contacts:', error);
    }
  }, []);

  // Load user's groups
  const loadGroups = useCallback(async () => {
    if (!user) return;

    try {
      // Get groups user is member of
      const { data: memberData } = await supabase
        .from('group_members')
        .select('group_id')
        .eq('user_id', user.id);

      if (!memberData || memberData.length === 0) return;

      const groupIds = memberData.map((m) => m.group_id);

      // Fetch group details (only explicit groups, not direct groups, exclude deleted)
      const { data: groupsData } = await supabase
        .from('groups')
        .select('id, name')
        .in('id', groupIds)
        .eq('type', 'group')
        .is('deleted_at', null);

      if (!groupsData) return;

      // Get member counts
      const { data: allMembers } = await supabase
        .from('group_members')
        .select('group_id')
        .in('group_id', groupIds);

      const memberCounts: Record<string, number> = {};
      allMembers?.forEach((m) => {
        memberCounts[m.group_id] = (memberCounts[m.group_id] || 0) + 1;
      });

      const groupResults: SearchResultGroup[] = groupsData.map((g) => ({
        type: 'group',
        id: g.id,
        name: g.name,
        memberCount: memberCounts[g.id] || 1,
      }));

      setGroups(groupResults);
    } catch (error) {
      console.error('[useContactGroupSearch] Error loading groups:', error);
    }
  }, [user]);

  // Load all initial data
  const loadInitialData = useCallback(async () => {
    setIsLoading(true);
    await Promise.all([loadContacts(), loadGroups()]);
    setIsLoading(false);
  }, [loadContacts, loadGroups]);

  // Search function
  const search = useCallback((query: string) => {
    const trimmedQuery = query.trim().toLowerCase();

    if (!trimmedQuery) {
      // Show some default results (first few groups + contacts)
      const defaultResults: SearchResult[] = [
        ...groups.slice(0, 3),
        ...contacts.slice(0, 5).map((c): SearchResultContact => {
          const normalizedPhone = normalizePhone(c.phone);
          const existingUser = userPhoneMap.get(normalizedPhone);
          return {
            type: 'contact',
            id: c.id,
            name: c.name,
            phone: c.phone,
            userId: existingUser?.id,
            avatarUrl: existingUser?.avatarUrl,
          };
        }),
      ];
      setSearchResults(defaultResults);
      return;
    }

    // Filter groups
    const matchingGroups = groups.filter(g =>
      g.name.toLowerCase().includes(trimmedQuery)
    );

    // Filter contacts
    const matchingContacts = contacts
      .filter(c =>
        c.name.toLowerCase().includes(trimmedQuery) ||
        c.phone.includes(trimmedQuery)
      )
      .slice(0, 10) // Limit contacts
      .map((c): SearchResultContact => {
        const normalizedPhone = normalizePhone(c.phone);
        const existingUser = userPhoneMap.get(normalizedPhone);
        return {
          type: 'contact',
          id: c.id,
          name: c.name,
          phone: c.phone,
          userId: existingUser?.id,
          avatarUrl: existingUser?.avatarUrl,
        };
      });

    setSearchResults([...matchingGroups, ...matchingContacts]);
  }, [groups, contacts, userPhoneMap]);

  // Load data on mount
  useEffect(() => {
    loadInitialData();
  }, [loadInitialData]);

  return {
    searchResults,
    isLoading,
    hasContactPermission,
    search,
    loadInitialData,
  };
}

// Helper to normalize phone numbers
function normalizePhone(phone: string): string {
  const clean = phone.replace(/[\s-]/g, '');
  if (clean.startsWith('+')) return clean;
  if (clean.startsWith('91') && clean.length > 10) return `+${clean}`;
  return `+91${clean.replace(/^0/, '')}`;
}

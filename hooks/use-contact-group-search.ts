/**
 * Contact & Group Search Hook
 *
 * A thin search/filter layer on top of useEnrichedContacts.
 * Used by the add-expense screen when no group is pre-selected.
 */

import { useCallback, useEffect, useState } from 'react';

import { useEnrichedContacts } from './use-enriched-contacts';

// ─── Types (kept here so existing callers don't need to change their imports) ──

export interface SearchResultGroup {
  type: 'group';
  id: string;
  name: string;
  image_url: string | null;
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
  /** Whether a direct (1:1) group exists - needed for offline expense creation */
  hasDirectGroup?: boolean;
}

export type SearchResult = SearchResultGroup | SearchResultContact;

interface UseContactGroupSearchResult {
  searchResults: SearchResult[];
  isLoading: boolean;
  hasContactPermission: boolean | null;
  search: (query: string) => void;
  loadInitialData: () => Promise<void>;
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useContactGroupSearch(): UseContactGroupSearchResult {
  const { contacts, groups, isLoading, hasContactPermission, loadInitialData } =
    useEnrichedContacts();

  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);

  const search = useCallback(
    (query: string) => {
      const trimmed = query.trim().toLowerCase();

      const mapToResult = (c: (typeof contacts)[number]): SearchResultContact => ({
        type: 'contact',
        id: c.id,
        name: c.name,
        phone: c.phone,
        userId: c.userId,
        avatarUrl: c.avatarUrl,
        hasDirectGroup: c.hasDirectGroup,
      });

      if (!trimmed) {
        setSearchResults([
          ...groups.slice(0, 3),
          ...contacts.slice(0, 5).map(mapToResult),
        ]);
        return;
      }

      const matchingGroups = groups.filter(g =>
        g.name.toLowerCase().includes(trimmed)
      );

      const matchingContacts = contacts
        .filter(
          c =>
            c.name.toLowerCase().includes(trimmed) ||
            c.phone.includes(trimmed)
        )
        .slice(0, 10)
        .map(mapToResult);

      setSearchResults([...matchingGroups, ...matchingContacts]);
    },
    [groups, contacts]
  );

  useEffect(() => {
    loadInitialData();
  }, [loadInitialData]);

  return { searchResults, isLoading, hasContactPermission, search, loadInitialData };
}

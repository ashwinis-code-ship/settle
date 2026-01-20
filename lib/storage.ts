/**
 * Offline Storage Layer
 * 
 * Handles local caching of data using AsyncStorage.
 * Provides typed get/set operations with JSON serialization.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';

// Storage key prefixes
const STORAGE_KEYS = {
  // Cached data
  USER: 'settle:user',
  GROUPS: 'settle:groups',
  GROUP_MEMBERS: 'settle:group_members',
  EXPENSES: 'settle:expenses',
  EXPENSE_SPLITS: 'settle:expense_splits',
  SETTLEMENTS: 'settle:settlements',
  CATEGORIES: 'settle:categories',
  FRIENDS: 'settle:friends',
  
  // Sync state
  SYNC_QUEUE: 'settle:sync_queue',
  LAST_SYNC: 'settle:last_sync',
  
  // App state
  ONBOARDED: 'settle:onboarded',
} as const;

export { STORAGE_KEYS };

/**
 * Generic storage operations
 */
export const storage = {
  /**
   * Get a value from storage
   */
  async get<T>(key: string): Promise<T | null> {
    try {
      const value = await AsyncStorage.getItem(key);
      if (value === null) return null;
      return JSON.parse(value) as T;
    } catch (error) {
      console.error(`[Storage] Error getting ${key}:`, error);
      return null;
    }
  },

  /**
   * Set a value in storage
   */
  async set<T>(key: string, value: T): Promise<boolean> {
    try {
      await AsyncStorage.setItem(key, JSON.stringify(value));
      return true;
    } catch (error) {
      console.error(`[Storage] Error setting ${key}:`, error);
      return false;
    }
  },

  /**
   * Remove a value from storage
   */
  async remove(key: string): Promise<boolean> {
    try {
      await AsyncStorage.removeItem(key);
      return true;
    } catch (error) {
      console.error(`[Storage] Error removing ${key}:`, error);
      return false;
    }
  },

  /**
   * Clear all settle-related data (for logout)
   */
  async clearAll(): Promise<boolean> {
    try {
      const keys = Object.values(STORAGE_KEYS);
      await AsyncStorage.multiRemove(keys);
      return true;
    } catch (error) {
      console.error('[Storage] Error clearing all:', error);
      return false;
    }
  },

  /**
   * Get multiple values at once
   */
  async getMultiple<T extends Record<string, unknown>>(
    keys: string[]
  ): Promise<Partial<T>> {
    try {
      const pairs = await AsyncStorage.multiGet(keys);
      const result: Record<string, unknown> = {};
      for (const [key, value] of pairs) {
        if (value !== null) {
          result[key] = JSON.parse(value);
        }
      }
      return result as Partial<T>;
    } catch (error) {
      console.error('[Storage] Error getting multiple:', error);
      return {};
    }
  },

  /**
   * Set multiple values at once
   */
  async setMultiple(items: Record<string, unknown>): Promise<boolean> {
    try {
      const pairs: [string, string][] = Object.entries(items).map(
        ([key, value]) => [key, JSON.stringify(value)]
      );
      await AsyncStorage.multiSet(pairs);
      return true;
    } catch (error) {
      console.error('[Storage] Error setting multiple:', error);
      return false;
    }
  },
};

/**
 * Cache helpers for specific entity types
 */
export const cache = {
  // User
  async getUser() {
    return storage.get(STORAGE_KEYS.USER);
  },
  async setUser(user: unknown) {
    return storage.set(STORAGE_KEYS.USER, user);
  },

  // Groups
  async getGroups() {
    return storage.get<unknown[]>(STORAGE_KEYS.GROUPS) ?? [];
  },
  async setGroups(groups: unknown[]) {
    return storage.set(STORAGE_KEYS.GROUPS, groups);
  },

  // Categories
  async getCategories() {
    return storage.get<unknown[]>(STORAGE_KEYS.CATEGORIES) ?? [];
  },
  async setCategories(categories: unknown[]) {
    return storage.set(STORAGE_KEYS.CATEGORIES, categories);
  },

  // Last sync time
  async getLastSync(): Promise<string | null> {
    return storage.get<string>(STORAGE_KEYS.LAST_SYNC);
  },
  async setLastSync(timestamp: string) {
    return storage.set(STORAGE_KEYS.LAST_SYNC, timestamp);
  },
};

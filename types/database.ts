/**
 * Database types matching Supabase schema
 * These types represent the raw database rows
 */

// ============================================
// ENUMS & CONSTANTS
// ============================================

export type GroupMemberRole = 'admin' | 'member';

export type CurrencyCode = 'INR' | 'USD' | 'EUR' | 'GBP' | 'JPY' | 'AUD' | 'CAD';

export const CURRENCIES: Record<CurrencyCode, { symbol: string; name: string }> = {
  INR: { symbol: '₹', name: 'Indian Rupee' },
  USD: { symbol: '$', name: 'US Dollar' },
  EUR: { symbol: '€', name: 'Euro' },
  GBP: { symbol: '£', name: 'British Pound' },
  JPY: { symbol: '¥', name: 'Japanese Yen' },
  AUD: { symbol: 'A$', name: 'Australian Dollar' },
  CAD: { symbol: 'C$', name: 'Canadian Dollar' },
};

export const DEFAULT_CURRENCY: CurrencyCode = 'INR';

// ============================================
// DATABASE ROW TYPES
// ============================================

/**
 * User profile (extends Supabase auth.users)
 */
export interface DbUser {
  id: string;
  phone: string;
  name: string;
  avatar_url: string | null;
  default_currency: CurrencyCode;
  created_at: string;
  updated_at: string;
}

/**
 * Group for shared expenses
 */
export interface DbGroup {
  id: string;
  name: string;
  description: string | null;
  image_url: string | null;
  currency: CurrencyCode;
  created_by: string;
  created_at: string;
  updated_at: string;
}

/**
 * Group membership junction
 */
export interface DbGroupMember {
  id: string;
  group_id: string;
  user_id: string;
  role: GroupMemberRole;
  joined_at: string;
}

/**
 * Expense category
 */
export interface DbCategory {
  id: string;
  name: string;
  icon: string;
  color: string;
  sort_order: number;
}

/**
 * Expense record
 */
export interface DbExpense {
  id: string;
  group_id: string;
  paid_by: string;
  amount: number;
  currency: CurrencyCode;
  description: string;
  category_id: string | null;
  notes: string | null;
  expense_date: string;
  created_by: string;
  created_at: string;
  updated_at: string;
}

/**
 * How an expense is split among users
 */
export interface DbExpenseSplit {
  id: string;
  expense_id: string;
  user_id: string;
  amount: number;
  created_at: string;
}

/**
 * Settlement/payment between users
 */
export interface DbSettlement {
  id: string;
  group_id: string | null;
  paid_by: string;
  paid_to: string;
  amount: number;
  currency: CurrencyCode;
  notes: string | null;
  created_at: string;
}

// ============================================
// VIEW TYPES
// ============================================

/**
 * Group balance view row
 */
export interface DbGroupBalance {
  group_id: string;
  user_id: string;
  user_name: string;
  total_paid: number;
  total_owed: number;
  total_settled_paid: number;
  total_settled_received: number;
}

// ============================================
// INSERT TYPES (for creating new records)
// ============================================

export type DbUserInsert = Omit<DbUser, 'created_at' | 'updated_at'>;

export type DbGroupInsert = Omit<DbGroup, 'id' | 'created_at' | 'updated_at'>;

export type DbGroupMemberInsert = Omit<DbGroupMember, 'id' | 'joined_at'>;

export type DbExpenseInsert = Omit<DbExpense, 'id' | 'created_at' | 'updated_at'>;

export type DbExpenseSplitInsert = Omit<DbExpenseSplit, 'id' | 'created_at'>;

export type DbSettlementInsert = Omit<DbSettlement, 'id' | 'created_at'>;

// ============================================
// UPDATE TYPES (for updating records)
// ============================================

export type DbUserUpdate = Partial<Omit<DbUser, 'id' | 'created_at' | 'updated_at'>>;

export type DbGroupUpdate = Partial<Omit<DbGroup, 'id' | 'created_by' | 'created_at' | 'updated_at'>>;

export type DbExpenseUpdate = Partial<Omit<DbExpense, 'id' | 'group_id' | 'created_by' | 'created_at' | 'updated_at'>>;

/**
 * Application-level types with relations and computed fields
 * These are used throughout the app UI
 */

import type {
  CurrencyCode,
  DbCategory,
  DbExpense,
  DbGroup,
  DbSettlement,
  DbUser,
  GroupMemberRole
} from './database';

// ============================================
// USER TYPES
// ============================================

/**
 * User with minimal info for display
 */
export interface UserSummary {
  id: string;
  name: string;
  phone: string;
  avatar_url: string | null;
}

/**
 * Full user profile
 */
export interface User extends DbUser { }

// ============================================
// GROUP TYPES
// ============================================

/**
 * Group member with user details
 */
export interface GroupMember {
  id: string;
  user_id: string;
  role: GroupMemberRole;
  joined_at: string;
  user: UserSummary;
}

/**
 * Group with members and balance info
 */
export interface Group extends DbGroup {
  members: GroupMember[];
  member_count: number;
}

/**
 * Group with user's balance in it
 */
export interface GroupWithBalance extends Group {
  /** Positive = you are owed, Negative = you owe */
  your_balance: number;
}

/**
 * Group list item for display
 */
export interface GroupListItem {
  id: string;
  name: string;
  image_url: string | null;
  currency: CurrencyCode;
  member_count: number;
  your_balance: number;
  last_activity: string | null;
  /** True when the group has no checkpoints OR its latest expense is newer than the latest checkpoint */
  has_active_phase: boolean;
}

// ============================================
// EXPENSE TYPES
// ============================================

/**
 * Split info for display
 */
export interface ExpenseSplitInfo {
  user_id: string;
  user: UserSummary;
  amount: number;
}

/**
 * Expense with all relations for display
 */
export interface Expense extends DbExpense {
  paid_by_user: UserSummary;
  category: DbCategory | null;
  splits: ExpenseSplitInfo[];
}

/**
 * Expense list item for display
 */
export interface ExpenseListItem {
  id: string;
  description: string;
  amount: number;
  currency: CurrencyCode;
  paid_by: UserSummary;
  category: DbCategory | null;
  expense_date: string;
  /** ISO timestamp when the record was created — used for phase boundary comparisons */
  created_at: string;
  /** Your split amount. 0 means you are not included in this expense's split. */
  your_share: number;
  /** True if current user paid for this */
  you_paid: boolean;
  split_count: number;
}

/**
 * A group phase checkpoint — marks the end of a phase.
 * Any group member can create or delete one.
 */
export interface GroupCheckpoint {
  id: string;
  group_id: string;
  created_by: string;
  /** Display name of the member who created the checkpoint */
  creator_name: string;
  created_at: string;
}

// ============================================
// SETTLEMENT TYPES
// ============================================

/**
 * Settlement with user details
 */
export interface Settlement extends DbSettlement {
  paid_by_user: UserSummary;
  paid_to_user: UserSummary;
}

// ============================================
// BALANCE TYPES
// ============================================

/**
 * Balance with a specific user
 */
export interface UserBalance {
  user: UserSummary;
  /** Positive = they owe you, Negative = you owe them */
  balance: number;
  currency: CurrencyCode;
}

/**
 * Detailed balance breakdown in a group
 */
export interface GroupMemberBalance {
  user: UserSummary;
  total_paid: number;
  total_owed: number;
  total_settled_paid: number;
  total_settled_received: number;
  /** Net balance: positive = owed by group, negative = owes group */
  net_balance: number;
}

/**
 * Friend with aggregated balance across all groups
 */
export interface Friend {
  user: UserSummary;
  /** Positive = they owe you, Negative = you owe them */
  total_balance: number;
  /** Primary currency for display (most common in transactions) */
  primary_currency: CurrencyCode;
  /** Number of shared groups */
  shared_groups: number;
  /** Last transaction date */
  last_activity: string | null;
  /** Whether a direct (1:1) group exists with this friend - used for offline expense creation */
  hasDirectGroup?: boolean;
}

/**
 * Transaction between you and a friend (for friend detail view)
 */
export interface FriendTransaction {
  id: string;
  type: 'expense' | 'settlement';
  description: string;
  /** Positive = they owe you from this, Negative = you owe them */
  amount: number;
  currency: CurrencyCode;
  date: string;
  group_id: string | null;
  group_name: string | null;
  /** 'group' for a real multi-person group, 'direct' for a 1:1 group */
  group_type: string | null;
  /** Notes (settlements only) */
  notes?: string | null;
  /** Category emoji icon (expenses only) */
  category_icon?: string | null;
  /** Category hex color (expenses only) */
  category_color?: string | null;
  /** True if the current user paid for this expense */
  paid_by_you?: boolean;
}

// ============================================
// DASHBOARD TYPES
// ============================================

/**
 * Overall balance summary
 */
export interface BalanceSummary {
  /** Total amount you are owed */
  total_owed_to_you: number;
  /** Total amount you owe others */
  total_you_owe: number;
  /** Net balance */
  net_balance: number;
  /** Primary currency */
  currency: CurrencyCode;
}

/**
 * Recent activity item for dashboard
 */
export interface ActivityItem {
  id: string;
  type: 'expense' | 'settlement' | 'group_joined' | 'member_added';
  title: string;
  subtitle: string;
  amount: number | null;
  currency: CurrencyCode | null;
  timestamp: string;
  group_id: string | null;
  group_name: string | null;
  user: UserSummary | null;
}

// ============================================
// FORM TYPES
// ============================================

/**
 * Split type for expense creation
 */
export type SplitType = 'equal_all' | 'equal_selected';

/**
 * Expense form data
 */
export interface ExpenseFormData {
  description: string;
  amount: string;
  currency: CurrencyCode;
  category_id: string | null;
  paid_by: string;
  split_type: SplitType;
  /** User IDs to split between (for equal_selected) */
  split_between: string[];
  notes: string;
  expense_date: Date;
}

/**
 * Settlement form data
 */
export interface SettlementFormData {
  paid_to: string;
  amount: string;
  currency: CurrencyCode;
  group_id: string | null;
  notes: string;
}

/**
 * Group form data
 */
export interface GroupFormData {
  name: string;
  description: string;
  currency: CurrencyCode;
  /** Members to add */
  members: { phone: string; name: string }[];
  /** Optional local image URI to upload */
  imageUri?: string;
}

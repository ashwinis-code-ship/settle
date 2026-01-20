/**
 * Supabase Database Types
 * 
 * This file defines the Database type for Supabase client.
 * It provides type safety for all database operations.
 * 
 * Usage:
 *   import { supabase } from '@/lib/supabase';
 *   const { data } = await supabase.from('users').select('*');
 *   // data is typed as DbUser[] | null
 */

import type {
  CurrencyCode,
  DbCategory,
  DbExpense,
  DbExpenseInsert,
  DbExpenseSplit,
  DbExpenseSplitInsert,
  DbExpenseUpdate,
  DbGroup,
  DbGroupInsert,
  DbGroupMember,
  DbGroupMemberInsert,
  DbGroupUpdate,
  DbSettlement,
  DbSettlementInsert,
  DbUser,
  DbUserInsert,
  DbUserUpdate,
  GroupMemberRole,
} from './database';

export interface Database {
  public: {
    Tables: {
      users: {
        Row: DbUser;
        Insert: DbUserInsert;
        Update: DbUserUpdate;
      };
      groups: {
        Row: DbGroup;
        Insert: DbGroupInsert;
        Update: DbGroupUpdate;
      };
      group_members: {
        Row: DbGroupMember;
        Insert: DbGroupMemberInsert;
        Update: Partial<DbGroupMemberInsert>;
      };
      categories: {
        Row: DbCategory;
        Insert: Omit<DbCategory, 'id'>;
        Update: Partial<Omit<DbCategory, 'id'>>;
      };
      expenses: {
        Row: DbExpense;
        Insert: DbExpenseInsert;
        Update: DbExpenseUpdate;
      };
      expense_splits: {
        Row: DbExpenseSplit;
        Insert: DbExpenseSplitInsert;
        Update: Partial<DbExpenseSplitInsert>;
      };
      settlements: {
        Row: DbSettlement;
        Insert: DbSettlementInsert;
        Update: Partial<DbSettlementInsert>;
      };
    };
    Views: {
      group_balances: {
        Row: {
          group_id: string;
          user_id: string;
          user_name: string;
          total_paid: number;
          total_owed: number;
          total_settled_paid: number;
          total_settled_received: number;
        };
      };
    };
    Functions: {
      calculate_balance_between_users: {
        Args: {
          user1_id: string;
          user2_id: string;
        };
        Returns: number;
      };
    };
    Enums: {
      group_member_role: GroupMemberRole;
      currency_code: CurrencyCode;
    };
  };
}

// Re-export for convenience
export type Tables<T extends keyof Database['public']['Tables']> =
  Database['public']['Tables'][T]['Row'];

export type InsertTables<T extends keyof Database['public']['Tables']> =
  Database['public']['Tables'][T]['Insert'];

export type UpdateTables<T extends keyof Database['public']['Tables']> =
  Database['public']['Tables'][T]['Update'];

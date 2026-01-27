-- Settle Database Schema
-- Run this in your Supabase SQL Editor

-- ============================================
-- EXTENSIONS
-- ============================================
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================
-- TABLES
-- ============================================

-- Users table (extends Supabase auth.users)
CREATE TABLE public.users (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    phone TEXT UNIQUE NOT NULL,
    name TEXT NOT NULL,
    avatar_url TEXT,
    default_currency TEXT DEFAULT 'INR',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Groups table
CREATE TABLE public.groups (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL,
    description TEXT,
    image_url TEXT,
    currency TEXT DEFAULT 'INR',
    type TEXT DEFAULT 'group' CHECK (type IN ('group', 'direct')), -- 'group' = explicit named group, 'direct' = auto-created 1:1 group
    created_by UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    deleted_at TIMESTAMPTZ DEFAULT NULL -- Soft delete: NULL = active, timestamp = deleted
);

-- Group members junction table
CREATE TABLE public.group_members (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    group_id UUID NOT NULL REFERENCES public.groups(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    role TEXT DEFAULT 'member' CHECK (role IN ('admin', 'member')),
    joined_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(group_id, user_id)
);

-- Categories table
CREATE TABLE public.categories (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL UNIQUE,
    icon TEXT NOT NULL,
    color TEXT NOT NULL,
    sort_order INT DEFAULT 0
);

-- Expenses table
CREATE TABLE public.expenses (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    group_id UUID NOT NULL REFERENCES public.groups(id) ON DELETE CASCADE,
    paid_by UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    amount DECIMAL(12, 2) NOT NULL CHECK (amount > 0),
    currency TEXT NOT NULL DEFAULT 'INR',
    description TEXT NOT NULL,
    category_id UUID REFERENCES public.categories(id) ON DELETE SET NULL,
    notes TEXT,
    expense_date DATE DEFAULT CURRENT_DATE,
    created_by UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Expense splits table (who owes what from each expense)
CREATE TABLE public.expense_splits (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    expense_id UUID NOT NULL REFERENCES public.expenses(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    amount DECIMAL(12, 2) NOT NULL CHECK (amount >= 0),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(expense_id, user_id)
);

-- Settlements table (when someone pays back)
CREATE TABLE public.settlements (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    group_id UUID REFERENCES public.groups(id) ON DELETE CASCADE,
    paid_by UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    paid_to UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    amount DECIMAL(12, 2) NOT NULL CHECK (amount > 0),
    currency TEXT NOT NULL DEFAULT 'INR',
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    CHECK (paid_by != paid_to)
);

-- ============================================
-- INDEXES
-- ============================================

-- Users indexes
CREATE INDEX idx_users_phone ON public.users(phone);

-- Groups indexes
CREATE INDEX idx_groups_created_by ON public.groups(created_by);
CREATE INDEX idx_groups_created_at ON public.groups(created_at DESC);
CREATE INDEX idx_groups_deleted_at ON public.groups(deleted_at) WHERE deleted_at IS NULL; -- Partial index for active groups

-- Group members indexes
CREATE INDEX idx_group_members_user_id ON public.group_members(user_id);
CREATE INDEX idx_group_members_group_id ON public.group_members(group_id);

-- Expenses indexes
CREATE INDEX idx_expenses_group_id ON public.expenses(group_id);
CREATE INDEX idx_expenses_paid_by ON public.expenses(paid_by);
CREATE INDEX idx_expenses_created_at ON public.expenses(created_at DESC);
CREATE INDEX idx_expenses_expense_date ON public.expenses(expense_date DESC);

-- Expense splits indexes
CREATE INDEX idx_expense_splits_expense_id ON public.expense_splits(expense_id);
CREATE INDEX idx_expense_splits_user_id ON public.expense_splits(user_id);

-- Settlements indexes
CREATE INDEX idx_settlements_group_id ON public.settlements(group_id);
CREATE INDEX idx_settlements_paid_by ON public.settlements(paid_by);
CREATE INDEX idx_settlements_paid_to ON public.settlements(paid_to);
CREATE INDEX idx_settlements_created_at ON public.settlements(created_at DESC);

-- ============================================
-- FUNCTIONS
-- ============================================

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Function to automatically add creator as group admin
CREATE OR REPLACE FUNCTION add_creator_as_admin()
RETURNS TRIGGER 
SECURITY DEFINER
AS $$
BEGIN
    INSERT INTO public.group_members (group_id, user_id, role)
    VALUES (NEW.id, NEW.created_by, 'admin');
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Helper function to check group membership (SECURITY DEFINER to avoid RLS recursion)
CREATE OR REPLACE FUNCTION public.is_group_member(p_group_id UUID, p_user_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 FROM public.group_members
        WHERE group_id = p_group_id AND user_id = p_user_id
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================
-- TRIGGERS
-- ============================================

-- Update timestamps
CREATE TRIGGER update_users_updated_at
    BEFORE UPDATE ON public.users
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_groups_updated_at
    BEFORE UPDATE ON public.groups
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_expenses_updated_at
    BEFORE UPDATE ON public.expenses
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Auto-add creator as admin when group is created
CREATE TRIGGER add_group_creator_as_admin
    AFTER INSERT ON public.groups
    FOR EACH ROW
    EXECUTE FUNCTION add_creator_as_admin();

-- ============================================
-- ROW LEVEL SECURITY (RLS)
-- ============================================

-- Enable RLS on all tables
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.group_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.expenses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.expense_splits ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.settlements ENABLE ROW LEVEL SECURITY;

-- Users policies
CREATE POLICY "Users can view all users" ON public.users
    FOR SELECT USING (true);

CREATE POLICY "Users can update own profile" ON public.users
    FOR UPDATE USING (auth.uid() = id);

CREATE POLICY "Users can insert own profile" ON public.users
    FOR INSERT WITH CHECK (auth.uid() = id);

-- Groups policies
CREATE POLICY "Users can view groups they are members of" ON public.groups
    FOR SELECT USING (
        auth.uid() = created_by OR
        EXISTS (
            SELECT 1 FROM public.group_members
            WHERE group_members.group_id = id
            AND group_members.user_id = auth.uid()
        )
    );

CREATE POLICY "Users can create groups" ON public.groups
    FOR INSERT WITH CHECK (auth.uid() = created_by);

CREATE POLICY "Group admins can update groups" ON public.groups
    FOR UPDATE USING (
        EXISTS (
            SELECT 1 FROM public.group_members
            WHERE group_members.group_id = id
            AND group_members.user_id = auth.uid()
            AND group_members.role = 'admin'
        )
    );

CREATE POLICY "Group admins can delete groups" ON public.groups
    FOR DELETE USING (
        EXISTS (
            SELECT 1 FROM public.group_members
            WHERE group_members.group_id = id
            AND group_members.user_id = auth.uid()
            AND group_members.role = 'admin'
        )
    );

-- Group members policies
-- Uses helper function to avoid infinite recursion
CREATE POLICY "Users can view members of their groups" ON public.group_members
    FOR SELECT USING (
        public.is_group_member(group_id, auth.uid())
    );

CREATE POLICY "Group admins can add members" ON public.group_members
    FOR INSERT WITH CHECK (
        -- Allow group creator (for trigger and initial setup)
        EXISTS (
            SELECT 1 FROM public.groups
            WHERE groups.id = group_id
            AND groups.created_by = auth.uid()
        )
    );

CREATE POLICY "Group admins can remove members" ON public.group_members
    FOR DELETE USING (
        -- Group creator can remove members
        EXISTS (
            SELECT 1 FROM public.groups
            WHERE groups.id = group_members.group_id
            AND groups.created_by = auth.uid()
        )
        OR user_id = auth.uid() -- Users can leave groups
    );

-- Categories policies (public read, admin write)
CREATE POLICY "Anyone can view categories" ON public.categories
    FOR SELECT USING (true);

-- Expenses policies
CREATE POLICY "Users can view expenses in their groups" ON public.expenses
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM public.group_members
            WHERE group_members.group_id = expenses.group_id
            AND group_members.user_id = auth.uid()
        )
    );

CREATE POLICY "Group members can create expenses" ON public.expenses
    FOR INSERT WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.group_members
            WHERE group_members.group_id = group_id
            AND group_members.user_id = auth.uid()
        )
        AND auth.uid() = created_by
    );

CREATE POLICY "Expense creators can update their expenses" ON public.expenses
    FOR UPDATE USING (auth.uid() = created_by);

CREATE POLICY "Expense creators can delete their expenses" ON public.expenses
    FOR DELETE USING (auth.uid() = created_by);

-- Expense splits policies
CREATE POLICY "Users can view splits in their groups" ON public.expense_splits
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM public.expenses
            JOIN public.group_members ON group_members.group_id = expenses.group_id
            WHERE expenses.id = expense_splits.expense_id
            AND group_members.user_id = auth.uid()
        )
    );

CREATE POLICY "Expense creators can manage splits" ON public.expense_splits
    FOR INSERT WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.expenses
            WHERE expenses.id = expense_id
            AND expenses.created_by = auth.uid()
        )
    );

CREATE POLICY "Expense creators can update splits" ON public.expense_splits
    FOR UPDATE USING (
        EXISTS (
            SELECT 1 FROM public.expenses
            WHERE expenses.id = expense_splits.expense_id
            AND expenses.created_by = auth.uid()
        )
    );

CREATE POLICY "Expense creators can delete splits" ON public.expense_splits
    FOR DELETE USING (
        EXISTS (
            SELECT 1 FROM public.expenses
            WHERE expenses.id = expense_splits.expense_id
            AND expenses.created_by = auth.uid()
        )
    );

-- Settlements policies
CREATE POLICY "Users can view settlements they're involved in" ON public.settlements
    FOR SELECT USING (
        paid_by = auth.uid() 
        OR paid_to = auth.uid()
        OR EXISTS (
            SELECT 1 FROM public.group_members
            WHERE group_members.group_id = settlements.group_id
            AND group_members.user_id = auth.uid()
        )
    );

CREATE POLICY "Users can create settlements where they are the payer" ON public.settlements
    FOR INSERT WITH CHECK (auth.uid() = paid_by);

CREATE POLICY "Settlement creators can delete their settlements" ON public.settlements
    FOR DELETE USING (auth.uid() = paid_by);

-- ============================================
-- SEED DATA: Categories
-- ============================================

INSERT INTO public.categories (name, icon, color, sort_order) VALUES
    ('Food & Drinks', '🍔', '#FF6B6B', 1),
    ('Transport', '🚗', '#4ECDC4', 2),
    ('Shopping', '🛍️', '#45B7D1', 3),
    ('Entertainment', '🎬', '#96CEB4', 4),
    ('Accommodation', '🏨', '#FFEAA7', 5),
    ('Utilities', '💡', '#DDA0DD', 6),
    ('Healthcare', '🏥', '#98D8C8', 7),
    ('Groceries', '🛒', '#74B9FF', 8),
    ('Travel', '✈️', '#A29BFE', 9),
    ('Other', '📦', '#C9C9C9', 10);

-- ============================================
-- VIEWS (for easier querying)
-- ============================================

-- View: User balances per group
CREATE OR REPLACE VIEW public.group_balances AS
SELECT 
    gm.group_id,
    gm.user_id,
    u.name AS user_name,
    -- Total amount paid by user in this group
    COALESCE(
        (SELECT SUM(e.amount) FROM public.expenses e WHERE e.group_id = gm.group_id AND e.paid_by = gm.user_id),
        0
    ) AS total_paid,
    -- Total amount owed by user in this group
    COALESCE(
        (SELECT SUM(es.amount) 
         FROM public.expense_splits es 
         JOIN public.expenses e ON e.id = es.expense_id 
         WHERE e.group_id = gm.group_id AND es.user_id = gm.user_id),
        0
    ) AS total_owed,
    -- Total settlements paid by user
    COALESCE(
        (SELECT SUM(s.amount) FROM public.settlements s WHERE s.group_id = gm.group_id AND s.paid_by = gm.user_id),
        0
    ) AS total_settled_paid,
    -- Total settlements received by user
    COALESCE(
        (SELECT SUM(s.amount) FROM public.settlements s WHERE s.group_id = gm.group_id AND s.paid_to = gm.user_id),
        0
    ) AS total_settled_received
FROM public.group_members gm
JOIN public.users u ON u.id = gm.user_id;

-- ============================================
-- HELPER FUNCTION: Calculate net balance between two users
-- ============================================

CREATE OR REPLACE FUNCTION calculate_balance_between_users(user1_id UUID, user2_id UUID)
RETURNS DECIMAL AS $$
DECLARE
    balance DECIMAL := 0;
    user1_paid DECIMAL := 0;
    user1_owes DECIMAL := 0;
    user1_settled_to_user2 DECIMAL := 0;
    user2_settled_to_user1 DECIMAL := 0;
BEGIN
    -- Amount user1 paid that user2 owes (from expense splits)
    SELECT COALESCE(SUM(es.amount), 0) INTO user1_paid
    FROM public.expense_splits es
    JOIN public.expenses e ON e.id = es.expense_id
    WHERE e.paid_by = user1_id AND es.user_id = user2_id;
    
    -- Amount user2 paid that user1 owes
    SELECT COALESCE(SUM(es.amount), 0) INTO user1_owes
    FROM public.expense_splits es
    JOIN public.expenses e ON e.id = es.expense_id
    WHERE e.paid_by = user2_id AND es.user_id = user1_id;
    
    -- Settlements from user1 to user2
    SELECT COALESCE(SUM(amount), 0) INTO user1_settled_to_user2
    FROM public.settlements
    WHERE paid_by = user1_id AND paid_to = user2_id;
    
    -- Settlements from user2 to user1
    SELECT COALESCE(SUM(amount), 0) INTO user2_settled_to_user1
    FROM public.settlements
    WHERE paid_by = user2_id AND paid_to = user1_id;
    
    -- Positive = user2 owes user1, Negative = user1 owes user2
    balance := (user1_paid - user1_owes) - (user1_settled_to_user2 - user2_settled_to_user1);
    
    RETURN balance;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
-- Migration to support Shadow Users (Unregistered Invites)

-- 1. Remove strict FK to auth.users to allow shadow users
ALTER TABLE public.users DROP CONSTRAINT IF EXISTS users_id_fkey;

-- 2. Add is_registered column and Set Default UUID
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS is_registered BOOLEAN DEFAULT TRUE;
ALTER TABLE public.users ALTER COLUMN id SET DEFAULT gen_random_uuid();

-- 3. Update Foreign Keys to ON UPDATE CASCADE
-- This allows us to update the UUID of a shadow user when they claim their account

-- groups
ALTER TABLE public.groups DROP CONSTRAINT IF EXISTS groups_created_by_fkey;
ALTER TABLE public.groups ADD CONSTRAINT groups_created_by_fkey 
    FOREIGN KEY (created_by) REFERENCES public.users(id) ON UPDATE CASCADE ON DELETE CASCADE;

-- group_members
ALTER TABLE public.group_members DROP CONSTRAINT IF EXISTS group_members_user_id_fkey;
ALTER TABLE public.group_members ADD CONSTRAINT group_members_user_id_fkey 
    FOREIGN KEY (user_id) REFERENCES public.users(id) ON UPDATE CASCADE ON DELETE CASCADE;

-- expenses
ALTER TABLE public.expenses DROP CONSTRAINT IF EXISTS expenses_paid_by_fkey;
ALTER TABLE public.expenses ADD CONSTRAINT expenses_paid_by_fkey 
    FOREIGN KEY (paid_by) REFERENCES public.users(id) ON UPDATE CASCADE ON DELETE CASCADE;

ALTER TABLE public.expenses DROP CONSTRAINT IF EXISTS expenses_created_by_fkey;
ALTER TABLE public.expenses ADD CONSTRAINT expenses_created_by_fkey 
    FOREIGN KEY (created_by) REFERENCES public.users(id) ON UPDATE CASCADE ON DELETE CASCADE;

-- expense_splits
ALTER TABLE public.expense_splits DROP CONSTRAINT IF EXISTS expense_splits_user_id_fkey;
ALTER TABLE public.expense_splits ADD CONSTRAINT expense_splits_user_id_fkey 
    FOREIGN KEY (user_id) REFERENCES public.users(id) ON UPDATE CASCADE ON DELETE CASCADE;

-- settlements
ALTER TABLE public.settlements DROP CONSTRAINT IF EXISTS settlements_paid_by_fkey;
ALTER TABLE public.settlements ADD CONSTRAINT settlements_paid_by_fkey 
    FOREIGN KEY (paid_by) REFERENCES public.users(id) ON UPDATE CASCADE ON DELETE CASCADE;

ALTER TABLE public.settlements DROP CONSTRAINT IF EXISTS settlements_paid_to_fkey;
ALTER TABLE public.settlements ADD CONSTRAINT settlements_paid_to_fkey 
    FOREIGN KEY (paid_to) REFERENCES public.users(id) ON UPDATE CASCADE ON DELETE CASCADE;


-- 4. Function to handle account claiming
CREATE OR REPLACE FUNCTION public.complete_signup(
    p_phone TEXT,
    p_name TEXT,
    p_avatar_url TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_shadow_id UUID;
    v_new_id UUID;
BEGIN
    v_new_id := auth.uid();
    
    -- Check if a shadow user exists with this phone
    SELECT id INTO v_shadow_id
    FROM public.users
    WHERE phone = p_phone AND is_registered = FALSE;

    IF v_shadow_id IS NOT NULL AND v_shadow_id != v_new_id THEN
        -- Shadow user exists, merge/claim it
        
        -- We update the shadow user row to become the real user row
        -- Changing the ID will cascade to all related tables
        UPDATE public.users
        SET 
            id = v_new_id,
            name = p_name,
            avatar_url = COALESCE(p_avatar_url, avatar_url),
            is_registered = TRUE,
            updated_at = NOW()
        WHERE id = v_shadow_id;
        
        -- Delete any pre-created row for the new auth ID if it existed and was different (shouldn't happen if we use this function instead of direct insert)
        -- But if standard signup flow inserted a row, we might have a conflict on PK if we try to update shadow_id to new_id and new_id row exists.
        -- SO: We must check if target ID exists.
        
        IF FOUND THEN
             RETURN jsonb_build_object('status', 'merged', 'old_id', v_shadow_id, 'new_id', v_new_id);
        END IF;
    ELSE
        -- No shadow user
        -- Insert new user if not exists (upsert)
        INSERT INTO public.users (id, phone, name, avatar_url, is_registered)
        VALUES (v_new_id, p_phone, p_name, p_avatar_url, TRUE)
        ON CONFLICT (id) DO UPDATE
        SET 
            name = EXCLUDED.name,
            avatar_url = COALESCE(EXCLUDED.avatar_url, public.users.avatar_url),
            updated_at = NOW();
            
        RETURN jsonb_build_object('status', 'created', 'id', v_new_id);
    END IF;
    
    RETURN jsonb_build_object('status', 'error');
END;
$$;
-- Fix RLS policy to allow creating shadow users
CREATE POLICY "Allow authenticated users to create shadow users" ON public.users
    FOR INSERT WITH CHECK (
        auth.role() = 'authenticated' AND is_registered = false
    );

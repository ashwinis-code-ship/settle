-- Phase 1: Grouped expenses – expense_groups table and expenses.expense_group_id
-- One expense_group = one "payment" (description, category, paid_by); child expenses link via expense_group_id.

-- ============================================
-- TABLE: expense_groups
-- ============================================

CREATE TABLE public.expense_groups (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    group_id UUID NOT NULL REFERENCES public.groups(id) ON DELETE CASCADE,
    description TEXT NOT NULL,
    category_id UUID REFERENCES public.categories(id) ON DELETE SET NULL,
    paid_by UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    created_by UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- EXPENSES: add optional link to expense_group
-- ============================================

ALTER TABLE public.expenses
    ADD COLUMN expense_group_id UUID REFERENCES public.expense_groups(id) ON DELETE CASCADE;

COMMENT ON COLUMN public.expenses.expense_group_id IS 'When set, this expense is a line item under the given expense_group (grouped expense). NULL = standalone expense.';

-- ============================================
-- INDEXES
-- ============================================

CREATE INDEX idx_expense_groups_group_id ON public.expense_groups(group_id);
CREATE INDEX idx_expense_groups_created_at ON public.expense_groups(created_at DESC);
CREATE INDEX idx_expenses_expense_group_id ON public.expenses(expense_group_id) WHERE expense_group_id IS NOT NULL;

-- ============================================
-- TRIGGER: updated_at on expense_groups
-- ============================================

CREATE TRIGGER update_expense_groups_updated_at
    BEFORE UPDATE ON public.expense_groups
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- ROW LEVEL SECURITY: expense_groups
-- ============================================

ALTER TABLE public.expense_groups ENABLE ROW LEVEL SECURITY;

-- Group members can view expense_groups in their groups
CREATE POLICY "Users can view expense_groups in their groups" ON public.expense_groups
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM public.group_members
            WHERE group_members.group_id = expense_groups.group_id
            AND group_members.user_id = auth.uid()
        )
    );

-- Group members can create expense_groups (and must set created_by = self)
CREATE POLICY "Group members can create expense_groups" ON public.expense_groups
    FOR INSERT WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.group_members
            WHERE group_members.group_id = expense_groups.group_id
            AND group_members.user_id = auth.uid()
        )
        AND auth.uid() = created_by
    );

-- Group members can update expense_groups in their groups
CREATE POLICY "Group members can update expense_groups" ON public.expense_groups
    FOR UPDATE USING (
        EXISTS (
            SELECT 1 FROM public.group_members
            WHERE group_members.group_id = expense_groups.group_id
            AND group_members.user_id = auth.uid()
        )
    );

-- Group members can delete expense_groups in their groups
CREATE POLICY "Group members can delete expense_groups" ON public.expense_groups
    FOR DELETE USING (
        EXISTS (
            SELECT 1 FROM public.group_members
            WHERE group_members.group_id = expense_groups.group_id
            AND group_members.user_id = auth.uid()
        )
    );

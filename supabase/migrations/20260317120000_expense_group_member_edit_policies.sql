-- Allow any group member to update/delete expenses (and manage splits).
-- Replaces creator-only UPDATE/DELETE policies on expenses and expense_splits.

-- ============================================
-- EXPENSES: drop creator-only, add group-member
-- ============================================

DROP POLICY IF EXISTS "Expense creators can update their expenses" ON public.expenses;
CREATE POLICY "Group members can update expenses" ON public.expenses
    FOR UPDATE USING (
        EXISTS (
            SELECT 1 FROM public.group_members
            WHERE group_members.group_id = expenses.group_id
            AND group_members.user_id = auth.uid()
        )
    );

DROP POLICY IF EXISTS "Expense creators can delete their expenses" ON public.expenses;
CREATE POLICY "Group members can delete expenses" ON public.expenses
    FOR DELETE USING (
        EXISTS (
            SELECT 1 FROM public.group_members
            WHERE group_members.group_id = expenses.group_id
            AND group_members.user_id = auth.uid()
        )
    );

-- ============================================
-- EXPENSE_SPLITS: drop creator-only, add group-member
-- ============================================

DROP POLICY IF EXISTS "Expense creators can manage splits" ON public.expense_splits;
CREATE POLICY "Group members can insert splits" ON public.expense_splits
    FOR INSERT WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.expenses e
            JOIN public.group_members gm ON gm.group_id = e.group_id AND gm.user_id = auth.uid()
            WHERE e.id = expense_splits.expense_id
        )
    );

DROP POLICY IF EXISTS "Expense creators can update splits" ON public.expense_splits;
CREATE POLICY "Group members can update splits" ON public.expense_splits
    FOR UPDATE USING (
        EXISTS (
            SELECT 1 FROM public.expenses e
            JOIN public.group_members gm ON gm.group_id = e.group_id AND gm.user_id = auth.uid()
            WHERE e.id = expense_splits.expense_id
        )
    );

DROP POLICY IF EXISTS "Expense creators can delete splits" ON public.expense_splits;
CREATE POLICY "Group members can delete splits" ON public.expense_splits
    FOR DELETE USING (
        EXISTS (
            SELECT 1 FROM public.expenses e
            JOIN public.group_members gm ON gm.group_id = e.group_id AND gm.user_id = auth.uid()
            WHERE e.id = expense_splits.expense_id
        )
    );

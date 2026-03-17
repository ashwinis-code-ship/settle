-- Convert a grouped expense to a single standalone expense (e.g. when user edits and removes all but one part).
-- Keeps the first child expense (by created_at), updates it with the given data and clears expense_group_id,
-- deletes other children and the expense_group.

CREATE OR REPLACE FUNCTION public.convert_grouped_expense_to_single(
    p_expense_group_id UUID,
    p_description TEXT,
    p_category_id UUID,
    p_paid_by UUID,
    p_amount DECIMAL(12, 2),
    p_split_between JSONB,
    p_notes TEXT DEFAULT NULL,
    p_currency TEXT DEFAULT 'INR',
    p_expense_date DATE DEFAULT CURRENT_DATE
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
    v_group_id UUID;
    v_keep_expense_id UUID;
    v_count INT;
    v_split_amount DECIMAL(12, 2);
    v_user_id UUID;
BEGIN
    SELECT group_id INTO v_group_id
    FROM public.expense_groups
    WHERE id = p_expense_group_id;

    IF v_group_id IS NULL THEN
        RAISE EXCEPTION 'Expense group not found';
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM public.group_members
        WHERE group_id = v_group_id AND user_id = auth.uid()
    ) THEN
        RAISE EXCEPTION 'Not a member of this group';
    END IF;

    IF jsonb_array_length(p_split_between) IS NULL OR jsonb_array_length(p_split_between) < 1 THEN
        RAISE EXCEPTION 'At least one person required in split_between';
    END IF;

    -- First child expense (by created_at) is the one we keep
    SELECT id INTO v_keep_expense_id
    FROM public.expenses
    WHERE expense_group_id = p_expense_group_id
    ORDER BY created_at ASC
    LIMIT 1;

    IF v_keep_expense_id IS NULL THEN
        RAISE EXCEPTION 'No expenses in group';
    END IF;

    -- Delete all splits for the expense we're keeping (we'll re-insert)
    DELETE FROM public.expense_splits WHERE expense_id = v_keep_expense_id;

    -- Update the kept expense to standalone with new data
    UPDATE public.expenses
    SET description = p_description,
        amount = p_amount,
        category_id = p_category_id,
        paid_by = p_paid_by,
        currency = p_currency,
        expense_date = p_expense_date,
        notes = p_notes,
        expense_group_id = NULL
    WHERE id = v_keep_expense_id;

    -- Insert new splits for the kept expense
    v_count := jsonb_array_length(p_split_between);
    v_split_amount := ROUND((p_amount / v_count)::numeric, 2);
    FOR v_user_id IN SELECT elem::UUID FROM jsonb_array_elements_text(p_split_between) AS elem
    LOOP
        INSERT INTO public.expense_splits (expense_id, user_id, amount)
        VALUES (v_keep_expense_id, v_user_id, v_split_amount);
    END LOOP;

    -- Delete splits for all other expenses in the group
    DELETE FROM public.expense_splits
    WHERE expense_id IN (
        SELECT id FROM public.expenses
        WHERE expense_group_id = p_expense_group_id AND id != v_keep_expense_id
    );

    -- Delete other child expenses
    DELETE FROM public.expenses
    WHERE expense_group_id = p_expense_group_id AND id != v_keep_expense_id;

    -- Delete the expense_group
    DELETE FROM public.expense_groups WHERE id = p_expense_group_id;

    RETURN v_keep_expense_id;
END;
$$;

COMMENT ON FUNCTION public.convert_grouped_expense_to_single IS 'Converts a grouped expense to a single standalone expense: keeps first child, updates it, deletes rest and the group.';

-- Backfill: create one expense_group per standalone expense and link it.
-- Safe: only INSERTs into expense_groups and UPDATEs expense_group_id on expenses.
-- No data loss: expenses and expense_splits rows are unchanged except expense_group_id.
-- Idempotent: only touches expenses where expense_group_id IS NULL.

DO $$
DECLARE
  r RECORD;
  gid UUID;
BEGIN
  FOR r IN
    SELECT id, group_id, description, category_id, paid_by, created_by, created_at
    FROM public.expenses
    WHERE expense_group_id IS NULL
  LOOP
    INSERT INTO public.expense_groups (
      group_id,
      description,
      category_id,
      paid_by,
      created_by,
      created_at,
      updated_at
    )
    VALUES (
      r.group_id,
      r.description,
      r.category_id,
      r.paid_by,
      r.created_by,
      r.created_at,
      r.created_at
    )
    RETURNING id INTO gid;

    UPDATE public.expenses
    SET expense_group_id = gid
    WHERE id = r.id;
  END LOOP;
END $$;

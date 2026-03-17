# Grouped-by-default migration: UI flow changes & safe data migration

## Summary

After migration, **every expense** has an `expense_group_id`. There are no standalone expenses. So:

- **Data:** One `expense_group` per “payment”; 1+ child `expenses` per group. Existing standalone expenses become groups with exactly one child.
- **UI:** All three lists (recent activity, friends detail, group detail) only consume `expense_groups` (with children for totals). Navigation is always to `/expense/group/[expenseGroupId]`.

---

## 1. UI / flow changes by screen

### 1.1 Recent activity (Home tab)

**Current:**

- Fetches **standalone expenses** (`expenses` where `expense_group_id IS NULL`) and maps to `ActivityItem` with `type: 'expense'`, `id: expense.id`.
- Fetches **expense_groups** and maps to `ActivityItem` with `type: 'expense_group'`, `id: eg.id`, `line_count`, etc.
- Merges with settlements, sorts by `created_at`, takes top 10.
- Press: expense → `/expense/[expenseId]`, expense_group → `/expense/group/[expenseGroupId]`.

**After migration:**

- **Remove** the standalone-expenses fetch entirely (no more `expense_group_id IS NULL`).
- **Keep** only: expense_groups fetch + settlements fetch; merge and sort as today.
- Every expense row is `type: 'expense_group'`, `id: eg.id`, `line_count: 1` or more. All navigate to `/expense/group/[id]`.
- **Rendering:** No change to list UI; you already support `expense_group` and `line_count`. Only the data source changes (one query instead of two).

**Code change (high level):**

- In `use-recent-activity.ts`: delete the block that fetches standalone expenses and builds `expenseActivities`. Build `allActivities` from `expenseGroupActivities` and `settlementActivities` only. Optionally keep `ActivityItem.type` as `'expense' | 'expense_group' | 'settlement'` and only ever emit `'expense_group'` for expenses (so Home tab doesn’t need UI changes).

---

### 1.2 Friends detail list (Friends tab → friend → activity list)

**Current:**

- `get_friend_transactions` returns:
  - **expense_impacts:** one row per **standalone** expense (`e.expense_group_id IS NULL`) with `type = 'expense'`, `id = e.id`.
  - **expense_group_impacts:** one row per **expense_group** with `type = 'expense_group'`, `id = eg.id`, `line_count`.
- UI: press expense → `/expense/[id]`, press expense_group → `/expense/group/[id]`.

**After migration:**

- **RPC change:** Remove or empty the `expense_impacts` CTE (no standalone expenses). Keep only `expense_group_impacts` (and settlements). So every expense row from the RPC is `type = 'expense_group'`, `id = eg.id`.
- **UI:** No change; you already handle `expense_group` and navigate to `/expense/group/[id]`. You can leave handling for `type === 'expense'` for backward compatibility or remove it once migration is done.

---

### 1.3 Group details list (Group tab → group → expense list)

**Current:**

- Fetches **standalone expenses** (paginated) → `allServerExpenses` → mapped to list items with `itemType: 'expense'`, `id: expense.id`.
- Fetches **expense_groups** → `expenseGroupsListItems` → `itemType: 'group'`, `id: eg.id`.
- Merges both + pending, sorts. Press expense → `/expense/[expenseId]`, group → `/expense/group/[expenseGroupId]`.

**After migration:**

- **Remove** the standalone-expenses query (`fetchExpensePage` with `is('expense_group_id', null)`). Do **not** fetch “standalone” expenses anymore.
- **Keep** only: `fetchExpenseGroupsListItems` (all expense_groups for the group). Every list row is an expense_group (1 or more lines).
- **Merge:** `expenses` = pending items + `expenseGroupsListItems` only (no `allServerExpenses`). Sort by date as today.
- **Navigation:** Every row has `itemType: 'group'` and `id: eg.id` → always `/expense/group/[expenseGroupId]`.
- **Rendering:** Reuse the same “group” row UI for all (you already show total, line_count, etc.). Single-line groups are just `line_count: 1`.

**Code change (high level):**

- In `use-expenses.ts`: stop using `fetchExpensePage` / `allServerExpenses`. Rely only on `expenseGroupsListItems` (and pending). Build `expenses` from `pendingItems` and `expenseGroupsListItems` (both as group-style items). Detail route is always group detail.

---

## 2. Detail route behaviour

- **Option A (recommended):** Use only `/expense/group/[id]` for opening an expense. All list items (recent, friends, group) pass `expense_group_id` and link to this route. Remove or don’t use `/expense/[expenseId]` for list-driven navigation.
- **Option B (backward compatibility):** Keep `/expense/[expenseId]`. When opened, load the expense, read `expense_group_id`, and redirect to `/expense/group/[expense_group_id]`. So old links or bookmarks still work.

---

## 3. Safe migration of existing data (no data loss)

**Goal:** For every expense that currently has `expense_group_id IS NULL`, create exactly one `expense_group` row and set that expense’s `expense_group_id` to it. Do not delete or change any expense row or any `expense_splits` row.

**Invariants:**

- Only **insert** into `expense_groups` and **update** `expenses.expense_group_id`.
- Do not delete or modify `expenses` (amount, description, splits, etc.) or `expense_splits`.
- Run in a **transaction** so either all backfills commit or none do.
- **Idempotent:** Skip expenses that already have `expense_group_id` set (so re-running the migration is safe).

**Steps:**

1. For each row in `expenses` where `expense_group_id IS NULL`:
   - Insert into `expense_groups`:
     - `group_id`, `description`, `category_id`, `paid_by`, `created_by` ← from the expense.
     - `created_at`, `updated_at` ← from the expense (e.g. use expense `created_at` for both if you don’t have updated_at on expenses).
   - Update that expense: `expense_group_id = id` of the new `expense_groups` row.
2. Commit in one transaction.

**Migration SQL (safe, no data loss):**

```sql
-- Backfill: one expense_group per standalone expense; link expense to it.
-- Safe: only INSERTs into expense_groups and UPDATEs expense_group_id on expenses.
-- Idempotent: only touches rows where expense_group_id IS NULL.

BEGIN;

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

COMMIT;
```

**Checks before/after:**

- **Before:**  
  `SELECT COUNT(*) FROM expenses WHERE expense_group_id IS NULL;`  
  Record this number.
- **After:**  
  - `SELECT COUNT(*) FROM expenses WHERE expense_group_id IS NULL;` → should be 0.  
  - `SELECT COUNT(*) FROM expense_groups;` → should increase by the same number.  
  - Total row counts of `expenses` and `expense_splits` unchanged.

**Rollback (if you need to undo before committing):** Don’t commit; roll back the transaction. If you already committed and need to revert, you’d need a separate script that, for each `expense_group` that has exactly one child, sets that child’s `expense_group_id` back to NULL and deletes the `expense_group` row (only for those created by this backfill). So prefer to run the migration in a transaction and only commit after verifying.

---

## 4. Order of operations (recommended)

1. **Apply the migration** (run the SQL above in a transaction, verify counts).
2. **Backend:** Allow creating an expense_group with 1 line (e.g. relax `create_grouped_expense` to accept 1+ lines, or add a single-line create path that still creates a group).
3. **Frontend – group tab:** In `use-expenses`, stop fetching standalone expenses; build the list only from expense_groups (and pending).
4. **Frontend – recent activity:** In `use-recent-activity`, drop the standalone-expenses fetch; build activity only from expense_groups and settlements.
5. **RPC – friends:** In `get_friend_transactions`, remove or zero out the standalone `expense_impacts` CTE so only expense_group (and settlement) rows are returned.
6. **Navigation:** Ensure all list items use `expense_group_id` and link to `/expense/group/[id]`. Optionally keep `/expense/[id]` with redirect to group detail as in Option B above.

This keeps the UI rendering the same in recent activity, friends detail, and group detail, while switching them to a single, grouped-by-default model and migrating old data without losing any.

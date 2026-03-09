-- Returns is_active for every group the given user belongs to.
-- A group is active when it has at least one expense created after the latest
-- checkpoint; a group with no checkpoints is always active; a group with
-- checkpoints but no expenses is inactive (fully archived).
-- Used by the groups list screen to power the Active / Archived filter tabs.

CREATE OR REPLACE FUNCTION get_group_active_status(p_user_id UUID)
RETURNS TABLE (
    group_id  UUID,
    is_active BOOLEAN
) AS $$
BEGIN
    RETURN QUERY
    WITH user_groups AS (
        SELECT gm.group_id
        FROM group_members gm
        WHERE gm.user_id = p_user_id
    ),
    latest_checkpoints AS (
        SELECT gc.group_id, MAX(gc.created_at) AS latest_checkpoint_at
        FROM group_checkpoints gc
        INNER JOIN user_groups ug ON ug.group_id = gc.group_id
        GROUP BY gc.group_id
    ),
    latest_expenses AS (
        SELECT e.group_id, MAX(e.created_at) AS latest_expense_at
        FROM expenses e
        INNER JOIN user_groups ug ON ug.group_id = e.group_id
        GROUP BY e.group_id
    )
    SELECT
        ug.group_id,
        CASE
            -- No checkpoints ever → always active
            WHEN lc.latest_checkpoint_at IS NULL THEN true
            -- Has checkpoints but no expenses at all → archived/empty
            WHEN le.latest_expense_at IS NULL THEN false
            -- Has both → active only if an expense came after the last checkpoint
            WHEN le.latest_expense_at > lc.latest_checkpoint_at THEN true
            ELSE false
        END AS is_active
    FROM user_groups ug
    LEFT JOIN latest_checkpoints lc ON lc.group_id = ug.group_id
    LEFT JOIN latest_expenses    le ON le.group_id = ug.group_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

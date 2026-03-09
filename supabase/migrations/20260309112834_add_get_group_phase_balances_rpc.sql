-- Returns per-member paid / owed / net_balance for a group, optionally scoped to
-- expenses created after p_after_ts (i.e. only the current phase).
-- Used by the group detail screen to populate the BalanceSpectrumBar.

CREATE OR REPLACE FUNCTION get_group_phase_balances(
    p_group_id UUID,
    p_after_ts TIMESTAMPTZ DEFAULT NULL
)
RETURNS TABLE (
    user_id    UUID,
    user_name  TEXT,
    avatar_url TEXT,
    total_paid DECIMAL,
    total_owed DECIMAL,
    net_balance DECIMAL
) AS $$
BEGIN
    RETURN QUERY
    WITH phase_expenses AS (
        SELECT e.id, e.paid_by, e.amount
        FROM expenses e
        WHERE e.group_id = p_group_id
          AND (p_after_ts IS NULL OR e.created_at > p_after_ts)
    ),
    paid AS (
        SELECT pe.paid_by AS user_id, SUM(pe.amount) AS total_paid
        FROM phase_expenses pe
        GROUP BY pe.paid_by
    ),
    owed AS (
        SELECT es.user_id, SUM(es.amount) AS total_owed
        FROM expense_splits es
        JOIN phase_expenses pe ON pe.id = es.expense_id
        GROUP BY es.user_id
    ),
    members AS (
        SELECT gm.user_id, u.name, u.avatar_url
        FROM group_members gm
        JOIN users u ON u.id = gm.user_id
        WHERE gm.group_id = p_group_id
    )
    SELECT
        m.user_id,
        m.name                                                  AS user_name,
        m.avatar_url,
        COALESCE(p.total_paid, 0)                               AS total_paid,
        COALESCE(o.total_owed, 0)                               AS total_owed,
        COALESCE(p.total_paid, 0) - COALESCE(o.total_owed, 0)  AS net_balance
    FROM members m
    LEFT JOIN paid  p ON p.user_id = m.user_id
    LEFT JOIN owed  o ON o.user_id = m.user_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

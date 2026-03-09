-- Fix: the final SELECT was selecting `c.ei_id` but the RETURNS TABLE declared the
-- column as `id`. Postgres requires exact name matching in RETURN QUERY — ensure the
-- final projection uses the declared column names so the function compiles cleanly.

CREATE OR REPLACE FUNCTION get_friend_transactions(
  p_user1_id UUID,
  p_user2_id UUID,
  p_limit INT DEFAULT 50,
  p_cursor_created_at TIMESTAMPTZ DEFAULT NULL,
  p_cursor_id UUID DEFAULT NULL
)
RETURNS TABLE (
  id UUID,
  type TEXT,
  description TEXT,
  amount DECIMAL,
  currency TEXT,
  created_at TIMESTAMPTZ,
  group_id UUID,
  group_name TEXT,
  notes TEXT,
  paid_by UUID,
  category_icon TEXT,
  category_color TEXT
) AS $$
DECLARE
  shared_group_ids UUID[];
BEGIN
  SELECT ARRAY_AGG(DISTINCT gm1.group_id) INTO shared_group_ids
  FROM public.group_members gm1
  JOIN public.group_members gm2 ON gm1.group_id = gm2.group_id
  JOIN public.groups g ON g.id = gm1.group_id
  WHERE gm1.user_id = p_user1_id
    AND gm2.user_id = p_user2_id
    AND g.deleted_at IS NULL;

  IF shared_group_ids IS NULL THEN
    shared_group_ids := ARRAY[]::UUID[];
  END IF;

  RETURN QUERY
  WITH expense_impacts AS (
    SELECT
      e.id                                                              AS ei_id,
      'expense'::TEXT                                                   AS ei_type,
      e.description                                                     AS ei_description,
      CASE
        WHEN e.paid_by = p_user1_id AND es.user_id = p_user2_id THEN es.amount::DECIMAL
        WHEN e.paid_by = p_user2_id AND es.user_id = p_user1_id THEN (-es.amount)::DECIMAL
        ELSE 0::DECIMAL
      END                                                               AS ei_amount,
      e.currency::TEXT                                                  AS ei_currency,
      e.created_at                                                      AS ei_created_at,
      e.group_id                                                        AS ei_group_id,
      g.name::TEXT                                                      AS ei_group_name,
      NULL::TEXT                                                        AS ei_notes,
      e.paid_by                                                         AS ei_paid_by,
      cat.icon::TEXT                                                    AS ei_category_icon,
      cat.color::TEXT                                                   AS ei_category_color
    FROM public.expenses e
    JOIN public.expense_splits es ON es.expense_id = e.id
    JOIN public.groups g ON g.id = e.group_id
    LEFT JOIN public.categories cat ON cat.id = e.category_id
    WHERE e.group_id = ANY(shared_group_ids)
      AND (
        (e.paid_by = p_user1_id AND es.user_id = p_user2_id)
        OR (e.paid_by = p_user2_id AND es.user_id = p_user1_id)
      )
      AND (e.paid_by = p_user1_id OR e.paid_by = p_user2_id)
  ),
  settlement_rows AS (
    SELECT
      s.id                                                                        AS ei_id,
      'settlement'::TEXT                                                          AS ei_type,
      CASE WHEN s.paid_by = p_user1_id THEN 'You paid' ELSE 'They paid' END      AS ei_description,
      CASE WHEN s.paid_by = p_user1_id THEN (-s.amount)::DECIMAL
           ELSE s.amount::DECIMAL END                                             AS ei_amount,
      s.currency::TEXT                                                            AS ei_currency,
      s.created_at                                                                AS ei_created_at,
      s.group_id                                                                  AS ei_group_id,
      COALESCE(g.name, '')::TEXT                                                  AS ei_group_name,
      s.notes::TEXT                                                               AS ei_notes,
      s.paid_by                                                                   AS ei_paid_by,
      NULL::TEXT                                                                  AS ei_category_icon,
      NULL::TEXT                                                                  AS ei_category_color
    FROM public.settlements s
    LEFT JOIN public.groups g ON g.id = s.group_id
    WHERE (
      (s.paid_by = p_user1_id AND s.paid_to = p_user2_id)
      OR (s.paid_by = p_user2_id AND s.paid_to = p_user1_id)
    )
    AND (s.group_id IS NULL OR g.deleted_at IS NULL)
  ),
  combined AS (
    SELECT * FROM expense_impacts WHERE ei_amount != 0
    UNION ALL
    SELECT * FROM settlement_rows
  )
  SELECT
    c.ei_id             AS id,
    c.ei_type           AS type,
    c.ei_description    AS description,
    c.ei_amount         AS amount,
    c.ei_currency       AS currency,
    c.ei_created_at     AS created_at,
    c.ei_group_id       AS group_id,
    c.ei_group_name     AS group_name,
    c.ei_notes          AS notes,
    c.ei_paid_by        AS paid_by,
    c.ei_category_icon  AS category_icon,
    c.ei_category_color AS category_color
  FROM combined c
  WHERE
    (p_cursor_created_at IS NULL)
    OR (c.ei_created_at < p_cursor_created_at)
    OR (c.ei_created_at = p_cursor_created_at AND c.ei_id < p_cursor_id)
  ORDER BY c.ei_created_at DESC, c.ei_id DESC
  LIMIT p_limit;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

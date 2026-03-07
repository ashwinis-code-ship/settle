-- Paginated friend transactions for settlement phase feature
-- Returns combined expenses + settlements between two users with cursor-based pagination

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
  paid_by UUID
) AS $$
DECLARE
  shared_group_ids UUID[];
BEGIN
  -- Get shared group IDs (both users are members, group not deleted)
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
  WITH   expense_impacts AS (
    SELECT
      e.id,
      'expense'::TEXT,
      e.description,
      CASE
        WHEN e.paid_by = p_user1_id AND es.user_id = p_user2_id THEN es.amount
        WHEN e.paid_by = p_user2_id AND es.user_id = p_user1_id THEN -es.amount
        ELSE 0
      END AS amount,
      e.currency::TEXT,
      e.created_at,
      e.group_id,
      g.name::TEXT AS group_name,
      NULL::TEXT AS notes,
      e.paid_by
    FROM public.expenses e
    JOIN public.expense_splits es ON es.expense_id = e.id
    JOIN public.groups g ON g.id = e.group_id
    WHERE e.group_id = ANY(shared_group_ids)
      AND (
        (e.paid_by = p_user1_id AND es.user_id = p_user2_id)
        OR (e.paid_by = p_user2_id AND es.user_id = p_user1_id)
      )
      AND (e.paid_by = p_user1_id OR e.paid_by = p_user2_id)
  ),
  settlement_rows AS (
    SELECT
      s.id,
      'settlement'::TEXT,
      CASE WHEN s.paid_by = p_user1_id THEN 'You paid' ELSE 'They paid' END,
      CASE WHEN s.paid_by = p_user1_id THEN -s.amount ELSE s.amount END,
      s.currency::TEXT,
      s.created_at,
      s.group_id,
      COALESCE(g.name, '')::TEXT,
      s.notes::TEXT,
      s.paid_by
    FROM public.settlements s
    LEFT JOIN public.groups g ON g.id = s.group_id
    WHERE (
      (s.paid_by = p_user1_id AND s.paid_to = p_user2_id)
      OR (s.paid_by = p_user2_id AND s.paid_to = p_user1_id)
    )
    AND (s.group_id IS NULL OR g.deleted_at IS NULL)
  ),
  combined AS (
    SELECT * FROM expense_impacts WHERE amount != 0
    UNION ALL
    SELECT * FROM settlement_rows
  )
  SELECT c.id, c.type, c.description, c.amount, c.currency, c.created_at, c.group_id, c.group_name, c.notes, c.paid_by
  FROM combined c
  WHERE
    (p_cursor_created_at IS NULL)
    OR (c.created_at < p_cursor_created_at)
    OR (c.created_at = p_cursor_created_at AND c.id < p_cursor_id)
  ORDER BY c.created_at DESC, c.id DESC
  LIMIT p_limit;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

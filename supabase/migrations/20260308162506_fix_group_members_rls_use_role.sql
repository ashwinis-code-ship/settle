-- Fix group_members RLS: the initial INSERT/DELETE policies keyed on groups.created_by,
-- meaning only the original group creator could add or remove members.
-- Replace with role-based checks so any admin (role = 'admin') can manage membership.

DROP POLICY IF EXISTS "Group admins can add members" ON public.group_members;
DROP POLICY IF EXISTS "Group admins can remove members" ON public.group_members;

-- Any existing group admin can add new members.
CREATE POLICY "Group admins can add members" ON public.group_members
    FOR INSERT WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.group_members gm
            WHERE gm.group_id = group_members.group_id
              AND gm.user_id = auth.uid()
              AND gm.role = 'admin'
        )
    );

-- Any admin can remove members; users can always remove themselves (leave group).
CREATE POLICY "Group admins can remove members" ON public.group_members
    FOR DELETE USING (
        EXISTS (
            SELECT 1 FROM public.group_members gm
            WHERE gm.group_id = group_members.group_id
              AND gm.user_id = auth.uid()
              AND gm.role = 'admin'
        )
        OR user_id = auth.uid()
    );

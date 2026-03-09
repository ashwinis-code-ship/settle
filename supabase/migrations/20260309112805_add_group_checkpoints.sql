-- Group checkpoints: a lightweight record that marks a phase boundary in a group's
-- expense history.  Any group member can create or delete a checkpoint; the app uses
-- the latest checkpoint timestamp to split the expense list into "current phase" vs
-- "older phases".

CREATE TABLE public.group_checkpoints (
    id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    group_id   UUID        NOT NULL REFERENCES public.groups(id)  ON DELETE CASCADE,
    created_by UUID        NOT NULL REFERENCES public.users(id)   ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.group_checkpoints ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Group members can view checkpoints" ON public.group_checkpoints
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM public.group_members
            WHERE group_members.group_id = group_checkpoints.group_id
              AND group_members.user_id = auth.uid()
        )
    );

CREATE POLICY "Group members can create checkpoints" ON public.group_checkpoints
    FOR INSERT WITH CHECK (
        auth.uid() = created_by
        AND EXISTS (
            SELECT 1 FROM public.group_members
            WHERE group_members.group_id = group_checkpoints.group_id
              AND group_members.user_id = auth.uid()
        )
    );

CREATE POLICY "Group members can delete checkpoints" ON public.group_checkpoints
    FOR DELETE USING (
        EXISTS (
            SELECT 1 FROM public.group_members
            WHERE group_members.group_id = group_checkpoints.group_id
              AND group_members.user_id = auth.uid()
        )
    );

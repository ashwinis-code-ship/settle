-- Allow either party in a settlement to update it (e.g. correct amount or add notes).
-- The paid_by check mirrors the existing DELETE policy; paid_to is added so the
-- recipient can also edit (e.g. add a note after receiving payment).

CREATE POLICY "Users involved can update settlements" ON public.settlements
    FOR UPDATE USING (
        auth.uid() = paid_by OR auth.uid() = paid_to
    );

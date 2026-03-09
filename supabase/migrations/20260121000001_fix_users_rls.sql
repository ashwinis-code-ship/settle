-- Fix users RLS: ensure shadow user INSERT policy doesn't block authenticated signups.
-- Drop and recreate both INSERT policies so they are cleanly isolated:
--   1. Real users insert their own row (auth.uid() = id)
--   2. Authenticated users can create shadow (unregistered) rows for invites

DROP POLICY IF EXISTS "Users can insert own profile" ON public.users;
DROP POLICY IF EXISTS "Allow authenticated users to create shadow users" ON public.users;

CREATE POLICY "Users can insert own profile" ON public.users
    FOR INSERT WITH CHECK (auth.uid() = id);

CREATE POLICY "Allow authenticated users to create shadow users" ON public.users
    FOR INSERT WITH CHECK (
        auth.role() = 'authenticated' AND is_registered = false
    );

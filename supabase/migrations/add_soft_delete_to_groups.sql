-- Migration: Add soft delete capability to groups table
-- Run this in your Supabase SQL Editor

-- Add deleted_at column for soft delete
ALTER TABLE public.groups 
ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ DEFAULT NULL;

-- Add partial index for efficient active group queries
CREATE INDEX IF NOT EXISTS idx_groups_deleted_at 
ON public.groups(deleted_at) 
WHERE deleted_at IS NULL;

-- Verify the column was added
SELECT column_name, data_type, is_nullable 
FROM information_schema.columns 
WHERE table_name = 'groups' AND column_name = 'deleted_at';

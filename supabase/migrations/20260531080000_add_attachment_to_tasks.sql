-- ================================================================
-- Migration: Add attachment columns to tasks table
-- ================================================================

ALTER TABLE public.tasks ADD COLUMN IF NOT EXISTS attachment_url TEXT;
ALTER TABLE public.tasks ADD COLUMN IF NOT EXISTS attachment_name TEXT;

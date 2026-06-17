-- ================================================================
-- Migration: Add expire_at to notices table
-- ================================================================

ALTER TABLE public.notices ADD COLUMN IF NOT EXISTS expire_at TIMESTAMPTZ;

-- ================================================================
-- Migration: Add duration to tasks and started_at to submissions
-- ================================================================

-- 1. Add duration_minutes column to tasks table (optional, for exam task types)
ALTER TABLE public.tasks ADD COLUMN IF NOT EXISTS duration_minutes INTEGER;

-- 2. Add started_at column to submissions table (optional, tracks when a student starts an exam)
ALTER TABLE public.submissions ADD COLUMN IF NOT EXISTS started_at TIMESTAMPTZ;

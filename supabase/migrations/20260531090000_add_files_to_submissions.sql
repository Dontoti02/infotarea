-- ================================================================
-- Migration: Add unique constraint and file columns to submissions
-- ================================================================

-- Add file columns (safe to run again if already exist)
ALTER TABLE public.submissions ADD COLUMN IF NOT EXISTS file_url TEXT;
ALTER TABLE public.submissions ADD COLUMN IF NOT EXISTS file_name TEXT;

-- Add unique constraint on (task_id, student_id) to allow upsert
-- This ensures each student has one submission per task
ALTER TABLE public.submissions 
  DROP CONSTRAINT IF EXISTS submissions_task_student_unique;

ALTER TABLE public.submissions 
  ADD CONSTRAINT submissions_task_student_unique UNIQUE (task_id, student_id);

-- Migration: 20261009010000_add_schedule_to_courses.sql
-- Adds: schedule column to courses table

ALTER TABLE public.courses ADD COLUMN IF NOT EXISTS schedule TEXT;

-- Reload schema cache
NOTIFY pgrst, 'reload schema';

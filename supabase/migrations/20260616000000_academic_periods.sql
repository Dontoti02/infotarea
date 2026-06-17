-- ================================================================
-- Migration: Academic Periods (Cierre de Año)
-- ================================================================
-- Stores a snapshot of each academic year when it is closed.
-- The admin archives all operational data before clearing the
-- working tables for the new school year.
-- ================================================================

CREATE TABLE IF NOT EXISTS public.academic_periods (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  year_label TEXT NOT NULL,                       -- e.g. "2025-2026"
  start_year INTEGER NOT NULL,                    -- e.g. 2025
  end_year INTEGER NOT NULL,                      -- e.g. 2026
  closed_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  closed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- Snapshot statistics at close time
  total_students INTEGER NOT NULL DEFAULT 0,
  total_teachers INTEGER NOT NULL DEFAULT 0,
  total_courses INTEGER NOT NULL DEFAULT 0,
  total_tasks INTEGER NOT NULL DEFAULT 0,
  total_submissions INTEGER NOT NULL DEFAULT 0,
  total_notices INTEGER NOT NULL DEFAULT 0,
  total_resources INTEGER NOT NULL DEFAULT 0,

  -- Detailed archived data stored as JSONB
  archived_courses JSONB NOT NULL DEFAULT '[]',
  archived_notices JSONB NOT NULL DEFAULT '[]',
  archived_resources JSONB NOT NULL DEFAULT '[]',

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE public.academic_periods ENABLE ROW LEVEL SECURITY;

-- Only admins can view academic periods
DROP POLICY IF EXISTS "Admins can view academic periods" ON public.academic_periods;
CREATE POLICY "Admins can view academic periods"
ON public.academic_periods FOR SELECT
USING (
  (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'admin'
);

-- Only admins can insert academic periods
DROP POLICY IF EXISTS "Admins can insert academic periods" ON public.academic_periods;
CREATE POLICY "Admins can insert academic periods"
ON public.academic_periods FOR INSERT
WITH CHECK (
  (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'admin'
);

-- Only admins can delete academic periods (safety)
DROP POLICY IF EXISTS "Admins can delete academic periods" ON public.academic_periods;
CREATE POLICY "Admins can delete academic periods"
ON public.academic_periods FOR DELETE
USING (
  (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'admin'
);

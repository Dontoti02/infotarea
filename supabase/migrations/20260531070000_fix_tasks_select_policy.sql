-- ================================================================
-- Migration: Fix Tasks SELECT policy to allow assigned teachers to view
-- ================================================================

-- 1. Drop the old restrictive SELECT policy
DROP POLICY IF EXISTS "Tasks are viewable by course members." ON tasks;
DROP POLICY IF EXISTS "Tasks are viewable by members, teachers, and admins" ON tasks;

-- 2. Create a new comprehensive SELECT policy
CREATE POLICY "Tasks are viewable by members, teachers, and admins"
ON tasks FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM course_members 
    WHERE course_id = tasks.course_id AND profile_id = auth.uid()
  )
  OR EXISTS (
    SELECT 1 FROM courses c 
    WHERE c.id = tasks.course_id AND c.teacher_id = auth.uid()
  )
  OR (SELECT role FROM profiles WHERE id = auth.uid()) = 'admin'
);

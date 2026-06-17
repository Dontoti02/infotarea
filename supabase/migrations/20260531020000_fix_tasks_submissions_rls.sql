-- ================================================================
-- Fix: RLS Policies for tasks, submissions, resources, and notices
-- ================================================================

-- ----------------------------------------------------------------
-- 1. TASKS Table Policies
-- ----------------------------------------------------------------

-- Allow admins and teachers to INSERT tasks
DROP POLICY IF EXISTS "Admins and teachers can insert tasks" ON tasks;
CREATE POLICY "Admins and teachers can insert tasks"
ON tasks FOR INSERT
WITH CHECK (
  (SELECT role FROM profiles WHERE id = auth.uid()) IN ('admin', 'teacher')
);

-- Allow admins and teachers to UPDATE tasks
DROP POLICY IF EXISTS "Admins and teachers can update tasks" ON tasks;
CREATE POLICY "Admins and teachers can update tasks"
ON tasks FOR UPDATE
USING (
  (SELECT role FROM profiles WHERE id = auth.uid()) IN ('admin', 'teacher')
);

-- Allow admins and teachers to DELETE tasks
DROP POLICY IF EXISTS "Admins and teachers can delete tasks" ON tasks;
CREATE POLICY "Admins and teachers can delete tasks"
ON tasks FOR DELETE
USING (
  (SELECT role FROM profiles WHERE id = auth.uid()) IN ('admin', 'teacher')
);


-- ----------------------------------------------------------------
-- 2. SUBMISSIONS Table Policies
-- ----------------------------------------------------------------

-- Allow students to INSERT their own submissions
DROP POLICY IF EXISTS "Students can insert own submissions" ON submissions;
CREATE POLICY "Students can insert own submissions"
ON submissions FOR INSERT
WITH CHECK (
  auth.uid() = student_id AND
  (SELECT role FROM profiles WHERE id = auth.uid()) = 'student'
);

-- Allow students to UPDATE their own submissions AND teachers/admins to UPDATE (grade) submissions
DROP POLICY IF EXISTS "Users can update submissions" ON submissions;
CREATE POLICY "Users can update submissions"
ON submissions FOR UPDATE
USING (
  auth.uid() = student_id OR
  (SELECT role FROM profiles WHERE id = auth.uid()) IN ('admin', 'teacher')
)
WITH CHECK (
  auth.uid() = student_id OR
  (SELECT role FROM profiles WHERE id = auth.uid()) IN ('admin', 'teacher')
);

-- Allow admins and teachers to DELETE submissions
DROP POLICY IF EXISTS "Admins and teachers can delete submissions" ON submissions;
CREATE POLICY "Admins and teachers can delete submissions"
ON submissions FOR DELETE
USING (
  (SELECT role FROM profiles WHERE id = auth.uid()) IN ('admin', 'teacher')
);


-- ----------------------------------------------------------------
-- 3. RESOURCES Table Policies
-- ----------------------------------------------------------------

-- Allow course members and admins to SELECT resources
DROP POLICY IF EXISTS "Course members can view resources" ON resources;
CREATE POLICY "Course members can view resources"
ON resources FOR SELECT
USING (
  EXISTS (SELECT 1 FROM course_members WHERE course_id = resources.course_id AND profile_id = auth.uid())
  OR (SELECT role FROM profiles WHERE id = auth.uid()) = 'admin'
);

-- Allow admins and teachers to INSERT resources
DROP POLICY IF EXISTS "Admins and teachers can insert resources" ON resources;
CREATE POLICY "Admins and teachers can insert resources"
ON resources FOR INSERT
WITH CHECK (
  (SELECT role FROM profiles WHERE id = auth.uid()) IN ('admin', 'teacher')
);

-- Allow admins and teachers to UPDATE resources
DROP POLICY IF EXISTS "Admins and teachers can update resources" ON resources;
CREATE POLICY "Admins and teachers can update resources"
ON resources FOR UPDATE
USING (
  (SELECT role FROM profiles WHERE id = auth.uid()) IN ('admin', 'teacher')
);

-- Allow admins and teachers to DELETE resources
DROP POLICY IF EXISTS "Admins and teachers can delete resources" ON resources;
CREATE POLICY "Admins and teachers can delete resources"
ON resources FOR DELETE
USING (
  (SELECT role FROM profiles WHERE id = auth.uid()) IN ('admin', 'teacher')
);


-- ----------------------------------------------------------------
-- 4. NOTICES Table Policies
-- ----------------------------------------------------------------

-- Allow admins and teachers to INSERT notices
DROP POLICY IF EXISTS "Admins and teachers can insert notices" ON notices;
CREATE POLICY "Admins and teachers can insert notices"
ON notices FOR INSERT
WITH CHECK (
  (SELECT role FROM profiles WHERE id = auth.uid()) IN ('admin', 'teacher')
);

-- Allow admins and teachers to UPDATE notices
DROP POLICY IF EXISTS "Admins and teachers can update notices" ON notices;
CREATE POLICY "Admins and teachers can update notices"
ON notices FOR UPDATE
USING (
  (SELECT role FROM profiles WHERE id = auth.uid()) IN ('admin', 'teacher')
);

-- Allow admins and teachers to DELETE notices
DROP POLICY IF EXISTS "Admins and teachers can delete notices" ON notices;
CREATE POLICY "Admins and teachers can delete notices"
ON notices FOR DELETE
USING (
  (SELECT role FROM profiles WHERE id = auth.uid()) IN ('admin', 'teacher')
);

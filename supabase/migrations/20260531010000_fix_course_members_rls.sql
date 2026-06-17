-- ================================================================
-- Fix: Add RLS policies for course_members table
-- Without these, admins cannot read course section data for students
-- ================================================================

-- 1. Allow admins to SELECT all course_members records
DROP POLICY IF EXISTS "Admins can view all course memberships" ON course_members;
CREATE POLICY "Admins can view all course memberships"
ON course_members FOR SELECT
USING (
  (SELECT role FROM profiles WHERE id = auth.uid()) = 'admin'
);

-- 2. Allow members to view their own course memberships
DROP POLICY IF EXISTS "Users can view their own course memberships" ON course_members;
CREATE POLICY "Users can view their own course memberships"
ON course_members FOR SELECT
USING (
  profile_id = auth.uid()
);

-- 3. Allow admins to INSERT course memberships (for bulk imports via client)
DROP POLICY IF EXISTS "Admins can insert course memberships" ON course_members;
CREATE POLICY "Admins can insert course memberships"
ON course_members FOR INSERT
WITH CHECK (
  (SELECT role FROM profiles WHERE id = auth.uid()) = 'admin'
);

-- 4. Allow admins to DELETE course memberships
DROP POLICY IF EXISTS "Admins can delete course memberships" ON course_members;
CREATE POLICY "Admins can delete course memberships"
ON course_members FOR DELETE
USING (
  (SELECT role FROM profiles WHERE id = auth.uid()) = 'admin'
);

-- 5. Also fix courses table: allow admins to INSERT/UPDATE/DELETE courses
DROP POLICY IF EXISTS "Admins can insert courses" ON courses;
CREATE POLICY "Admins can insert courses"
ON courses FOR INSERT
WITH CHECK (
  (SELECT role FROM profiles WHERE id = auth.uid()) = 'admin'
);

DROP POLICY IF EXISTS "Admins can update courses" ON courses;
CREATE POLICY "Admins can update courses"
ON courses FOR UPDATE
USING (
  (SELECT role FROM profiles WHERE id = auth.uid()) = 'admin'
);

DROP POLICY IF EXISTS "Admins can delete courses" ON courses;
CREATE POLICY "Admins can delete courses"
ON courses FOR DELETE
USING (
  (SELECT role FROM profiles WHERE id = auth.uid()) = 'admin'
);

-- 6. Allow admins and all authenticated users to view all courses
DROP POLICY IF EXISTS "Admins can view all courses" ON courses;
CREATE POLICY "Admins can view all courses"
ON courses FOR SELECT
USING (
  (SELECT role FROM profiles WHERE id = auth.uid()) = 'admin'
);

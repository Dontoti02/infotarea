-- ================================================================
-- Migration: Add Teacher Course RLS policies
-- ================================================================

-- ----------------------------------------------------------------
-- 1. COURSES Table Policies
-- ----------------------------------------------------------------

-- Enable RLS (already enabled, but good to verify)
ALTER TABLE courses ENABLE ROW LEVEL SECURITY;

-- Drop existing select policies
DROP POLICY IF EXISTS "Courses are viewable by members." ON courses;
DROP POLICY IF EXISTS "Admins can view all courses" ON courses;

-- New select policy: members, assigned teachers, and admins can view
CREATE POLICY "Courses are viewable by members, teachers or admins"
ON courses FOR SELECT
USING (
  EXISTS (SELECT 1 FROM course_members WHERE course_id = courses.id AND profile_id = auth.uid())
  OR teacher_id = auth.uid()
  OR (SELECT role FROM profiles WHERE id = auth.uid()) = 'admin'
);

-- Drop existing insert policies
DROP POLICY IF EXISTS "Admins can insert courses" ON courses;

-- New insert policy: admins and teachers can insert courses
CREATE POLICY "Admins and teachers can insert courses"
ON courses FOR INSERT
WITH CHECK (
  (SELECT role FROM profiles WHERE id = auth.uid()) = 'admin'
  OR (
    (SELECT role FROM profiles WHERE id = auth.uid()) = 'teacher'
    AND teacher_id = auth.uid()
  )
);

-- Drop existing update policies
DROP POLICY IF EXISTS "Admins can update courses" ON courses;

-- New update policy: admins and assigned teachers can update courses
CREATE POLICY "Admins and assigned teachers can update courses"
ON courses FOR UPDATE
USING (
  (SELECT role FROM profiles WHERE id = auth.uid()) = 'admin'
  OR teacher_id = auth.uid()
)
WITH CHECK (
  (SELECT role FROM profiles WHERE id = auth.uid()) = 'admin'
  OR teacher_id = auth.uid()
);

-- Drop existing delete policies
DROP POLICY IF EXISTS "Admins can delete courses" ON courses;

-- New delete policy: admins and assigned teachers can delete courses
CREATE POLICY "Admins and assigned teachers can delete courses"
ON courses FOR DELETE
USING (
  (SELECT role FROM profiles WHERE id = auth.uid()) = 'admin'
  OR teacher_id = auth.uid()
);


-- ----------------------------------------------------------------
-- 2. COURSE_MEMBERS Table Policies
-- ----------------------------------------------------------------

-- Enable RLS (already enabled, but good to verify)
ALTER TABLE course_members ENABLE ROW LEVEL SECURITY;

-- Drop existing select policies
DROP POLICY IF EXISTS "Admins can view all course memberships" ON course_members;
DROP POLICY IF EXISTS "Users can view their own course memberships" ON course_members;
DROP POLICY IF EXISTS "Teachers can view members of their courses" ON course_members;

-- New select policy: admins, members, and teachers of the course can view
CREATE POLICY "Admins, teachers and members can view memberships"
ON course_members FOR SELECT
USING (
  (SELECT role FROM profiles WHERE id = auth.uid()) = 'admin'
  OR profile_id = auth.uid()
  OR EXISTS (
    SELECT 1 FROM courses c
    WHERE c.id = course_members.course_id
    AND c.teacher_id = auth.uid()
  )
);

-- Drop existing insert policies
DROP POLICY IF EXISTS "Admins can insert course memberships" ON course_members;

-- New insert policy: admins and teachers of the course can insert
CREATE POLICY "Admins and assigned teachers can insert course memberships"
ON course_members FOR INSERT
WITH CHECK (
  (SELECT role FROM profiles WHERE id = auth.uid()) = 'admin'
  OR EXISTS (
    SELECT 1 FROM courses c
    WHERE c.id = course_members.course_id
    AND c.teacher_id = auth.uid()
  )
);

-- Drop existing delete policies
DROP POLICY IF EXISTS "Admins can delete course memberships" ON course_members;

-- New delete policy: admins and teachers of the course can delete
CREATE POLICY "Admins and assigned teachers can delete course memberships"
ON course_members FOR DELETE
USING (
  (SELECT role FROM profiles WHERE id = auth.uid()) = 'admin'
  OR EXISTS (
    SELECT 1 FROM courses c
    WHERE c.id = course_members.course_id
    AND c.teacher_id = auth.uid()
  )
);

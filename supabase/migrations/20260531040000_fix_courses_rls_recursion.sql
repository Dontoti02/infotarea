-- ================================================================
-- Migration: Fix infinite recursion in courses / course_members RLS
-- ================================================================
-- ROOT CAUSE:
--   courses SELECT policy  -> queries course_members
--   course_members SELECT policy -> queries courses
--   => infinite recursion
--
-- FIX:
--   1. courses SELECT: remove the course_members subquery.
--      A user can see a course if:
--        a) they are the teacher (teacher_id = auth.uid())
--        b) they are an admin
--        c) they are a member (use a SECURITY DEFINER function that bypasses RLS)
--   2. course_members policies: remove the JOIN to courses.
--      A teacher's membership check is done via teacher_id on the courses table
--      but read using a SECURITY DEFINER helper so RLS is not triggered again.
-- ================================================================

-- ----------------------------------------------------------------
-- 1. Helper function: checks if the current user is the teacher
--    of a given course. Runs as SECURITY DEFINER so it bypasses
--    RLS and avoids recursive policy evaluation.
-- ----------------------------------------------------------------
CREATE OR REPLACE FUNCTION is_course_teacher(p_course_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM courses
    WHERE id = p_course_id
      AND teacher_id = auth.uid()
  );
$$;

-- ----------------------------------------------------------------
-- 2. Helper function: checks if the current user is a member
--    of a given course. Runs as SECURITY DEFINER to bypass RLS.
-- ----------------------------------------------------------------
CREATE OR REPLACE FUNCTION is_course_member(p_course_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM course_members
    WHERE course_id = p_course_id
      AND profile_id = auth.uid()
  );
$$;

-- ----------------------------------------------------------------
-- 3. Re-create COURSES policies (no cross-table dependencies)
-- ----------------------------------------------------------------
DROP POLICY IF EXISTS "Courses are viewable by members, teachers or admins" ON courses;
DROP POLICY IF EXISTS "Admins and teachers can insert courses" ON courses;
DROP POLICY IF EXISTS "Admins and assigned teachers can update courses" ON courses;
DROP POLICY IF EXISTS "Admins and assigned teachers can delete courses" ON courses;

-- SELECT: admin, teacher of the course, or member
CREATE POLICY "courses_select"
ON courses FOR SELECT
USING (
  (SELECT role FROM profiles WHERE id = auth.uid()) = 'admin'
  OR teacher_id = auth.uid()
  OR is_course_member(id)
);

-- INSERT: admin or teacher inserting their own course
CREATE POLICY "courses_insert"
ON courses FOR INSERT
WITH CHECK (
  (SELECT role FROM profiles WHERE id = auth.uid()) = 'admin'
  OR (
    (SELECT role FROM profiles WHERE id = auth.uid()) = 'teacher'
    AND teacher_id = auth.uid()
  )
);

-- UPDATE: admin or assigned teacher
CREATE POLICY "courses_update"
ON courses FOR UPDATE
USING (
  (SELECT role FROM profiles WHERE id = auth.uid()) = 'admin'
  OR teacher_id = auth.uid()
)
WITH CHECK (
  (SELECT role FROM profiles WHERE id = auth.uid()) = 'admin'
  OR teacher_id = auth.uid()
);

-- DELETE: admin or assigned teacher
CREATE POLICY "courses_delete"
ON courses FOR DELETE
USING (
  (SELECT role FROM profiles WHERE id = auth.uid()) = 'admin'
  OR teacher_id = auth.uid()
);

-- ----------------------------------------------------------------
-- 4. Re-create COURSE_MEMBERS policies (use helper function)
-- ----------------------------------------------------------------
DROP POLICY IF EXISTS "Admins, teachers and members can view memberships" ON course_members;
DROP POLICY IF EXISTS "Admins and assigned teachers can insert course memberships" ON course_members;
DROP POLICY IF EXISTS "Admins and assigned teachers can delete course memberships" ON course_members;

-- SELECT: admin, own membership, or teacher of that course
CREATE POLICY "course_members_select"
ON course_members FOR SELECT
USING (
  (SELECT role FROM profiles WHERE id = auth.uid()) = 'admin'
  OR profile_id = auth.uid()
  OR is_course_teacher(course_id)
);

-- INSERT: admin or teacher of the course
CREATE POLICY "course_members_insert"
ON course_members FOR INSERT
WITH CHECK (
  (SELECT role FROM profiles WHERE id = auth.uid()) = 'admin'
  OR is_course_teacher(course_id)
);

-- DELETE: admin or teacher of the course
CREATE POLICY "course_members_delete"
ON course_members FOR DELETE
USING (
  (SELECT role FROM profiles WHERE id = auth.uid()) = 'admin'
  OR is_course_teacher(course_id)
);

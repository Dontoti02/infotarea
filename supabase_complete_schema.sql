-- =========================================================
-- Migration: 20260514011852_initial_schema.sql
-- =========================================================

-- Create custom types
DO $$ BEGIN
    CREATE TYPE user_role AS ENUM ('admin', 'teacher', 'student');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE notice_category AS ENUM ('urgent', 'academic', 'event');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE task_type AS ENUM ('essay', 'exam', 'homework');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE submission_status AS ENUM ('pending', 'reviewed');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Profiles table
CREATE TABLE IF NOT EXISTS profiles (
  id UUID REFERENCES auth.users ON DELETE CASCADE PRIMARY KEY,
  full_name TEXT NOT NULL,
  role user_role NOT NULL DEFAULT 'student',
  avatar_url TEXT,
  bio TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Courses table
CREATE TABLE IF NOT EXISTS courses (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  section TEXT NOT NULL,
  image_url TEXT,
  teacher_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Course members (junction table)
CREATE TABLE IF NOT EXISTS course_members (
  course_id UUID REFERENCES courses ON DELETE CASCADE,
  profile_id UUID REFERENCES profiles ON DELETE CASCADE,
  PRIMARY KEY (course_id, profile_id)
);

-- Tasks table
CREATE TABLE IF NOT EXISTS tasks (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  course_id UUID REFERENCES courses ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  due_date TIMESTAMPTZ,
  task_type task_type NOT NULL DEFAULT 'homework',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Submissions table
CREATE TABLE IF NOT EXISTS submissions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  task_id UUID REFERENCES tasks ON DELETE CASCADE,
  student_id UUID REFERENCES profiles ON DELETE CASCADE,
  content TEXT, -- URL to file or text content
  status submission_status NOT NULL DEFAULT 'pending',
  score DECIMAL(4,2),
  feedback TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Notices table
CREATE TABLE IF NOT EXISTS notices (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  author_id UUID REFERENCES profiles ON DELETE CASCADE,
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  category notice_category NOT NULL DEFAULT 'academic',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Resources table
CREATE TABLE IF NOT EXISTS resources (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  course_id UUID REFERENCES courses ON DELETE CASCADE,
  name TEXT NOT NULL,
  file_type TEXT,
  file_url TEXT NOT NULL,
  file_size BIGINT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- RLS Policies
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE courses ENABLE ROW LEVEL SECURITY;
ALTER TABLE course_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE submissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE notices ENABLE ROW LEVEL SECURITY;
ALTER TABLE resources ENABLE ROW LEVEL SECURITY;

-- Profile policies
DROP POLICY IF EXISTS "Public profiles are viewable by everyone." ON profiles;
CREATE POLICY "Public profiles are viewable by everyone." ON profiles FOR SELECT USING (true);

DROP POLICY IF EXISTS "Users can insert their own profile." ON profiles;
CREATE POLICY "Users can insert their own profile." ON profiles FOR INSERT WITH CHECK (auth.uid() = id);

DROP POLICY IF EXISTS "Users can update own profile." ON profiles;
CREATE POLICY "Users can update own profile." ON profiles FOR UPDATE USING (auth.uid() = id);

DROP POLICY IF EXISTS "Admins can update any profile" ON profiles;
CREATE POLICY "Admins can update any profile" ON profiles FOR UPDATE USING (
  (SELECT role FROM profiles WHERE id = auth.uid()) = 'admin'
);

DROP POLICY IF EXISTS "Admins can delete any profile" ON profiles;
CREATE POLICY "Admins can delete any profile" ON profiles FOR DELETE USING (
  (SELECT role FROM profiles WHERE id = auth.uid()) = 'admin'
);

-- Course policies
DROP POLICY IF EXISTS "Courses are viewable by members." ON courses;
CREATE POLICY "Courses are viewable by members." ON courses FOR SELECT USING (
  EXISTS (SELECT 1 FROM course_members WHERE course_id = courses.id AND profile_id = auth.uid())
  OR (SELECT role FROM profiles WHERE id = auth.uid()) = 'admin'
);

-- Task policies
DROP POLICY IF EXISTS "Tasks are viewable by course members." ON tasks;
CREATE POLICY "Tasks are viewable by course members." ON tasks FOR SELECT USING (
  EXISTS (SELECT 1 FROM course_members WHERE course_id = tasks.course_id AND profile_id = auth.uid())
  OR (SELECT role FROM profiles WHERE id = auth.uid()) = 'admin'
);

-- Submission policies
DROP POLICY IF EXISTS "Students can view own submissions." ON submissions;
CREATE POLICY "Students can view own submissions." ON submissions FOR SELECT USING (
  auth.uid() = student_id
  OR EXISTS (
    SELECT 1 FROM tasks t
    JOIN course_members cm ON t.course_id = cm.course_id
    WHERE t.id = submissions.task_id AND cm.profile_id = auth.uid()
    AND (SELECT role FROM profiles WHERE id = auth.uid()) = 'teacher'
  )
  OR (SELECT role FROM profiles WHERE id = auth.uid()) = 'admin'
);

-- Notice policies
DROP POLICY IF EXISTS "Notices are viewable by everyone." ON notices;
CREATE POLICY "Notices are viewable by everyone." ON notices FOR SELECT USING (true);

-- Trigger for new user profile creation
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, role)
  VALUES (
    new.id, 
    COALESCE(new.raw_user_meta_data->>'full_name', 'Nuevo Usuario'), 
    COALESCE((new.raw_user_meta_data->>'role')::public.user_role, 'student'::public.user_role)
  );
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();


-- =========================================================
-- Migration: 20260529011000_temp_credentials.sql
-- =========================================================

-- Create temp_credentials table to store generated accounts for students
CREATE TABLE IF NOT EXISTS public.temp_credentials (
  profile_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE PRIMARY KEY,
  email TEXT NOT NULL,
  temp_password TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable Row Level Security
ALTER TABLE public.temp_credentials ENABLE ROW LEVEL SECURITY;

-- RLS Policy: Admins can view all temp credentials
DROP POLICY IF EXISTS "Admins can view temp credentials" ON public.temp_credentials;
CREATE POLICY "Admins can view temp credentials" 
ON public.temp_credentials 
FOR SELECT 
USING (
  (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'admin'
);

-- RLS Policy: Admins can modify temp credentials (inserts, updates, deletes)
DROP POLICY IF EXISTS "Admins can modify temp credentials" ON public.temp_credentials;
CREATE POLICY "Admins can modify temp credentials" 
ON public.temp_credentials 
FOR ALL 
USING (
  (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'admin'
);


-- =========================================================
-- Migration: 20260531010000_fix_course_members_rls.sql
-- =========================================================

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


-- =========================================================
-- Migration: 20260531020000_fix_tasks_submissions_rls.sql
-- =========================================================

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


-- =========================================================
-- Migration: 20260531030000_teacher_course_policies.sql
-- =========================================================

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


-- =========================================================
-- Migration: 20260531040000_fix_courses_rls_recursion.sql
-- =========================================================

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


-- =========================================================
-- Migration: 20260531050000_sync_students_to_courses.sql
-- =========================================================

-- ================================================================
-- Fix: Sync existing students into courses of the same section
-- ================================================================
-- This script enrolls students into ALL courses that share their
-- section, ensuring existing courses show the correct student count.
--
-- HOW IT WORKS:
--   For each (course, student) pair where:
--     - The course has a section (e.g. '1A')
--     - The student is already enrolled in ANY course with that same section
--     - The student is NOT yet enrolled in this course
--   → Insert the student as a course_member.
-- ================================================================

INSERT INTO course_members (course_id, profile_id)
SELECT DISTINCT
  c.id          AS course_id,
  p.id          AS profile_id
FROM courses c
JOIN courses base_course ON base_course.section = c.section  -- same section
JOIN course_members cm   ON cm.course_id = base_course.id    -- student enrolled in base course
JOIN profiles p          ON p.id = cm.profile_id
                         AND p.role = 'student'              -- only students
WHERE
  -- Exclude the teacher (if any)
  (c.teacher_id IS NULL OR p.id != c.teacher_id)
  -- Only insert if not already a member
  AND NOT EXISTS (
    SELECT 1 FROM course_members ex
    WHERE ex.course_id = c.id
      AND ex.profile_id = p.id
  )
ON CONFLICT (course_id, profile_id) DO NOTHING;


-- =========================================================
-- Migration: 20260531060000_add_email_to_profiles.sql
-- =========================================================

-- ================================================================
-- Migration: Add email column to profiles and sync existing emails
-- ================================================================

-- 1. Add email column to profiles table if it doesn't exist
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS email TEXT;

-- 2. Sync existing profiles with emails from auth.users
UPDATE public.profiles p
SET email = u.email
FROM auth.users u
WHERE p.id = u.id;

-- 3. Update handle_new_user trigger function to include email
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, role, email)
  VALUES (
    new.id, 
    COALESCE(new.raw_user_meta_data->>'full_name', 'Nuevo Usuario'), 
    COALESCE((new.raw_user_meta_data->>'role')::public.user_role, 'student'::public.user_role),
    new.email
  );
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;


-- =========================================================
-- Migration: 20260531070000_fix_tasks_select_policy.sql
-- =========================================================

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


-- =========================================================
-- Migration: 20260531080000_add_attachment_to_tasks.sql
-- =========================================================

-- ================================================================
-- Migration: Add attachment columns to tasks table
-- ================================================================

ALTER TABLE public.tasks ADD COLUMN IF NOT EXISTS attachment_url TEXT;
ALTER TABLE public.tasks ADD COLUMN IF NOT EXISTS attachment_name TEXT;


-- =========================================================
-- Migration: 20260531090000_add_files_to_submissions.sql
-- =========================================================

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


-- =========================================================
-- Migration: 20260531100000_setup_storage_bucket.sql
-- =========================================================

-- ================================================================
-- Migration: Setup docs_tareas Storage Bucket and Policies
-- ================================================================

-- Create the bucket if it does not exist
INSERT INTO storage.buckets (id, name, public)
VALUES ('docs_tareas', 'docs_tareas', true)
ON CONFLICT (id) DO NOTHING;

-- Make sure RLS is enabled on storage.objects (usually enabled by default)
ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;

-- 1. Policy to allow public read access to anyone
DROP POLICY IF EXISTS "Public Access for docs_tareas" ON storage.objects;
CREATE POLICY "Public Access for docs_tareas"
ON storage.objects
FOR SELECT
USING (bucket_id = 'docs_tareas');

-- 2. Policy to allow authenticated users to upload files
DROP POLICY IF EXISTS "Authenticated Upload for docs_tareas" ON storage.objects;
CREATE POLICY "Authenticated Upload for docs_tareas"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'docs_tareas');

-- 3. Policy to allow authenticated users to update their own files
DROP POLICY IF EXISTS "Authenticated Update for docs_tareas" ON storage.objects;
CREATE POLICY "Authenticated Update for docs_tareas"
ON storage.objects
FOR UPDATE
TO authenticated
USING (bucket_id = 'docs_tareas');

-- 4. Policy to allow authenticated users to delete their own files
DROP POLICY IF EXISTS "Authenticated Delete for docs_tareas" ON storage.objects;
CREATE POLICY "Authenticated Delete for docs_tareas"
ON storage.objects
FOR DELETE
TO authenticated
USING (bucket_id = 'docs_tareas');


-- =========================================================
-- Migration: 20260531110000_fix_storage_policies.sql
-- =========================================================

-- ================================================================
-- Migration: Fix docs_tareas Storage Bucket Policies
-- ================================================================

-- Ensure the bucket exists and is public
INSERT INTO storage.buckets (id, name, public)
VALUES ('docs_tareas', 'docs_tareas', true)
ON CONFLICT (id) DO NOTHING;

-- Drop any previous restrictive policies
DROP POLICY IF EXISTS "Authenticated Upload for docs_tareas" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated Update for docs_tareas" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated Delete for docs_tareas" ON storage.objects;
DROP POLICY IF EXISTS "Public Access for docs_tareas" ON storage.objects;

DROP POLICY IF EXISTS "Public Read docs_tareas" ON storage.objects;
DROP POLICY IF EXISTS "Public Upload docs_tareas" ON storage.objects;
DROP POLICY IF EXISTS "Public Update docs_tareas" ON storage.objects;
DROP POLICY IF EXISTS "Public Delete docs_tareas" ON storage.objects;

-- 1. Create a public read policy
CREATE POLICY "Public Read docs_tareas"
ON storage.objects
FOR SELECT
TO public
USING (bucket_id = 'docs_tareas');

-- 2. Create a public upload policy for both students and teachers
CREATE POLICY "Public Upload docs_tareas"
ON storage.objects
FOR INSERT
TO public
WITH CHECK (bucket_id = 'docs_tareas');

-- 3. Create a public update policy
CREATE POLICY "Public Update docs_tareas"
ON storage.objects
FOR UPDATE
TO public
USING (bucket_id = 'docs_tareas');

-- 4. Create a public delete policy
CREATE POLICY "Public Delete docs_tareas"
ON storage.objects
FOR DELETE
TO public
USING (bucket_id = 'docs_tareas');


-- =========================================================
-- Migration: 20260608010000_add_forum_task_type.sql
-- =========================================================

-- ================================================================
-- Add 'forum' to task_type enum and deprecate 'essay'
-- ================================================================
-- PostgreSQL requires ALTER TYPE to add new enum values.
-- We cannot remove 'essay' from the enum without recreating it,
-- so we leave it in the DB but remove it from the UI.
-- ================================================================

ALTER TYPE task_type ADD VALUE IF NOT EXISTS 'forum';


-- =========================================================
-- Migration: 20260608020000_auto_enroll_students_triggers.sql
-- =========================================================

-- ================================================================
-- Migration: Auto-enroll students into section courses
-- ================================================================

-- 1. Function to sync existing students of the section to a new course
CREATE OR REPLACE FUNCTION public.sync_students_to_new_course()
RETURNS TRIGGER AS $$
BEGIN
  -- Prevent trigger recursion
  IF pg_trigger_depth() > 1 THEN
    RETURN NEW;
  END IF;

  -- Insert all students enrolled in any course of the same section into the new course
  INSERT INTO public.course_members (course_id, profile_id)
  SELECT DISTINCT
    NEW.id AS course_id,
    cm.profile_id
  FROM public.course_members cm
  JOIN public.courses c ON c.id = cm.course_id
  JOIN public.profiles p ON p.id = cm.profile_id
  WHERE c.section = NEW.section
    AND p.role = 'student'
    -- Exclude the teacher of the course
    AND cm.profile_id != COALESCE(NEW.teacher_id, '00000000-0000-0000-0000-000000000000'::uuid)
  ON CONFLICT (course_id, profile_id) DO NOTHING;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 2. Trigger on courses table
DROP TRIGGER IF EXISTS trigger_sync_students_to_new_course ON public.courses;
CREATE TRIGGER trigger_sync_students_to_new_course
AFTER INSERT OR UPDATE OF section, teacher_id ON public.courses
FOR EACH ROW
EXECUTE FUNCTION public.sync_students_to_new_course();


-- 3. Function to sync a newly enrolled student to all other courses of the same section
CREATE OR REPLACE FUNCTION public.sync_new_student_to_section_courses()
RETURNS TRIGGER AS $$
DECLARE
  v_section TEXT;
  v_role public.user_role;
BEGIN
  -- Prevent trigger recursion
  IF pg_trigger_depth() > 1 THEN
    RETURN NEW;
  END IF;

  -- Check the role of the profile being enrolled
  SELECT role INTO v_role FROM public.profiles WHERE id = NEW.profile_id;
  
  -- Only sync students
  IF v_role = 'student' THEN
    -- Get the section of the course they were just enrolled in
    SELECT section INTO v_section FROM public.courses WHERE id = NEW.course_id;
    
    IF v_section IS NOT NULL THEN
      -- Enroll the student in all other courses sharing the same section
      INSERT INTO public.course_members (course_id, profile_id)
      SELECT c.id AS course_id, NEW.profile_id
      FROM public.courses c
      WHERE c.section = v_section
        AND c.id != NEW.course_id
        AND (c.teacher_id IS NULL OR c.teacher_id != NEW.profile_id)
      ON CONFLICT (course_id, profile_id) DO NOTHING;
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 4. Trigger on course_members table
DROP TRIGGER IF EXISTS trigger_sync_new_student_to_section_courses ON public.course_members;
CREATE TRIGGER trigger_sync_new_student_to_section_courses
AFTER INSERT ON public.course_members
FOR EACH ROW
EXECUTE FUNCTION public.sync_new_student_to_section_courses();


-- =========================================================
-- Migration: 20260608030000_add_duration_to_tasks.sql
-- =========================================================

-- ================================================================
-- Migration: Add duration to tasks and started_at to submissions
-- ================================================================

-- 1. Add duration_minutes column to tasks table (optional, for exam task types)
ALTER TABLE public.tasks ADD COLUMN IF NOT EXISTS duration_minutes INTEGER;

-- 2. Add started_at column to submissions table (optional, tracks when a student starts an exam)
ALTER TABLE public.submissions ADD COLUMN IF NOT EXISTS started_at TIMESTAMPTZ;


-- =========================================================
-- Migration: 20260616000000_academic_periods.sql
-- =========================================================

-- ================================================================
-- Migration: Academic Periods (Cierre de Año)
-- ================================================================

CREATE TABLE IF NOT EXISTS public.academic_periods (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  year_label TEXT NOT NULL,
  start_year INTEGER NOT NULL,
  end_year INTEGER NOT NULL,
  closed_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  closed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  total_students INTEGER NOT NULL DEFAULT 0,
  total_teachers INTEGER NOT NULL DEFAULT 0,
  total_courses INTEGER NOT NULL DEFAULT 0,
  total_tasks INTEGER NOT NULL DEFAULT 0,
  total_submissions INTEGER NOT NULL DEFAULT 0,
  total_notices INTEGER NOT NULL DEFAULT 0,
  total_resources INTEGER NOT NULL DEFAULT 0,

  archived_courses JSONB NOT NULL DEFAULT '[]',
  archived_notices JSONB NOT NULL DEFAULT '[]',
  archived_resources JSONB NOT NULL DEFAULT '[]',

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.academic_periods ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins can view academic periods" ON public.academic_periods;
CREATE POLICY "Admins can view academic periods"
ON public.academic_periods FOR SELECT
USING (
  (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'admin'
);

DROP POLICY IF EXISTS "Admins can insert academic periods" ON public.academic_periods;
CREATE POLICY "Admins can insert academic periods"
ON public.academic_periods FOR INSERT
WITH CHECK (
  (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'admin'
);

DROP POLICY IF EXISTS "Admins can delete academic periods" ON public.academic_periods;
CREATE POLICY "Admins can delete academic periods"
ON public.academic_periods FOR DELETE
USING (
  (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'admin'
);



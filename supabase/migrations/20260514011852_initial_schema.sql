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

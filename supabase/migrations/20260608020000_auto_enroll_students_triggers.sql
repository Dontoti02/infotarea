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

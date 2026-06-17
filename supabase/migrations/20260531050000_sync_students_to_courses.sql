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

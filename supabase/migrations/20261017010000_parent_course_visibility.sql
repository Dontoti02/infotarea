-- ================================================================
-- Migration: Visibilidad del aula para padres de familia
-- ================================================================
-- PROBLEMA:
--   Las políticas RLS de course_members y courses no contemplaban
--   al rol 'parent'. Un padre vinculado a su hijo no podía leer su
--   matrícula ni el curso/grado/sección, por lo que el panel familiar
--   mostraba "Sin aula asignada" y 0 cursos.
--
-- SOLUCIÓN (siguiendo el patrón de helpers SECURITY DEFINER para
-- evitar recursión de políticas):
--   1. Helper is_parent_of_student(profile_id): el usuario actual
--      es padre vinculado a ese estudiante (parent_children).
--   2. Helper parent_enrolled_in_course(course_id): el usuario actual
--      tiene un hijo vinculado matriculado en ese curso.
--   3. Políticas SELECT adicionales para course_members y courses.
--      NO se otorga acceso a submissions ni tasks (calificaciones y
--      tareas siguen protegidas).
-- ================================================================

-- ----------------------------------------------------------------
-- 1. Helper: padre vinculado a un estudiante
-- ----------------------------------------------------------------
CREATE OR REPLACE FUNCTION is_parent_of_student(p_student_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM parent_children
    WHERE student_profile_id = p_student_id
      AND parent_profile_id = auth.uid()
  );
$$;

-- ----------------------------------------------------------------
-- 2. Helper: curso donde el usuario tiene un hijo vinculado
-- ----------------------------------------------------------------
CREATE OR REPLACE FUNCTION parent_enrolled_in_course(p_course_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM course_members cm
    JOIN parent_children pc ON pc.student_profile_id = cm.profile_id
    WHERE cm.course_id = p_course_id
      AND pc.parent_profile_id = auth.uid()
  );
$$;

-- ----------------------------------------------------------------
-- 3. course_members: los padres ven la matrícula de sus hijos
-- ----------------------------------------------------------------
DROP POLICY IF EXISTS "course_members_parent_select" ON course_members;
CREATE POLICY "course_members_parent_select"
ON course_members FOR SELECT
USING (
  is_parent_of_student(profile_id)
);

-- ----------------------------------------------------------------
-- 4. courses: los padres ven los cursos de sus hijos vinculados
-- ----------------------------------------------------------------
DROP POLICY IF EXISTS "courses_parent_select" ON courses;
CREATE POLICY "courses_parent_select"
ON courses FOR SELECT
USING (
  parent_enrolled_in_course(id)
);

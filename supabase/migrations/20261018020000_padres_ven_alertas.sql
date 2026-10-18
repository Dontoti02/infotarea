-- ================================================================
-- Migration: Los padres ven las alertas de sus hijos
-- ================================================================
-- PROBLEMA:
--   Las políticas RLS de smart_alerts cubrían dirección, docentes y
--   estudiantes, pero no al rol 'parent'. El padre recibía el correo
--   del bajo rendimiento y no podía ver el aviso en su panel familiar.
-- SOLUCIÓN:
--   Política SELECT adicional que reutiliza el helper SECURITY DEFINER
--   is_parent_of_student() (vínculos de parent_children). Cada padre ve
--   solo las alertas asociadas a sus hijos vinculados; nada más cambia.
-- ================================================================

GRANT SELECT ON TABLE public.smart_alerts TO authenticated;

DROP POLICY IF EXISTS "Padres ven las alertas de sus hijos" ON public.smart_alerts;
CREATE POLICY "Padres ven las alertas de sus hijos"
ON public.smart_alerts FOR SELECT
USING (
  student_id IS NOT NULL AND public.is_parent_of_student(student_id)
);

-- ================================================================
-- Migration: Los archivos de la biblioteca solo los gestionan
--            dirección y docentes
-- ================================================================
-- PROBLEMA:
--   Las políticas de storage.objects del bucket `contenidos` permitían a
--   cualquier usuario autenticado subir, reemplazar o borrar archivos.
--   Con el borrado de materiales desde la Biblioteca, un estudiante podía
--   eliminar archivos directamente por la API de Storage aunque la tabla
--   `resources` ya no se lo permitía.
-- SOLUCIÓN:
--   Reemplazar las políticas del bucket `contenidos` para que solo dirección
--   y docentes (el mismo criterio que la tabla `resources`) puedan subir,
--   reemplazar y borrar. La lectura pública de los archivos se mantiene.
-- ================================================================

DROP POLICY IF EXISTS "Authenticated Upload contenidos" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated Update contenidos" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated Delete contenidos" ON storage.objects;

DROP POLICY IF EXISTS "Direccion y docentes suben contenidos" ON storage.objects;
CREATE POLICY "Direccion y docentes suben contenidos"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'contenidos'
  AND (SELECT role FROM public.profiles WHERE id = auth.uid()) IN ('admin', 'teacher')
);

DROP POLICY IF EXISTS "Direccion y docentes actualizan contenidos" ON storage.objects;
CREATE POLICY "Direccion y docentes actualizan contenidos"
ON storage.objects FOR UPDATE TO authenticated
USING (
  bucket_id = 'contenidos'
  AND (SELECT role FROM public.profiles WHERE id = auth.uid()) IN ('admin', 'teacher')
)
WITH CHECK (
  bucket_id = 'contenidos'
  AND (SELECT role FROM public.profiles WHERE id = auth.uid()) IN ('admin', 'teacher')
);

DROP POLICY IF EXISTS "Direccion y docentes borran contenidos" ON storage.objects;
CREATE POLICY "Direccion y docentes borran contenidos"
ON storage.objects FOR DELETE TO authenticated
USING (
  bucket_id = 'contenidos'
  AND (SELECT role FROM public.profiles WHERE id = auth.uid()) IN ('admin', 'teacher')
);

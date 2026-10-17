-- ================================================================
-- Migration: Create the storage buckets used by the app
-- Buckets que el código usa y no existían en el proyecto:
--   img_cursos   -> imágenes de cursos (CourseList)
--   img_perfiles -> fotos de perfil (ProfileSettings)
--   contenidos   -> archivos de contenido (CourseDetails, ContentLibrary)
-- docs_tareas ya existía (20260531100000_setup_storage_bucket.sql)
-- ================================================================

INSERT INTO storage.buckets (id, name, public) VALUES
  ('img_cursos',   'img_cursos',   true),
  ('img_perfiles', 'img_perfiles', true),
  ('contenidos',   'contenidos',   true)
ON CONFLICT (id) DO UPDATE SET public = true;

-- Lectura pública (las imágenes se muestran con getPublicUrl) y
-- carga/edición/borrado para usuarios autenticados.
DO $$
DECLARE b text;
BEGIN
  FOREACH b IN ARRAY ARRAY['img_cursos', 'img_perfiles', 'contenidos'] LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON storage.objects', 'Public Read ' || b);
    EXECUTE format('CREATE POLICY %I ON storage.objects FOR SELECT TO public USING (bucket_id = %L)', 'Public Read ' || b, b);

    EXECUTE format('DROP POLICY IF EXISTS %I ON storage.objects', 'Authenticated Upload ' || b);
    EXECUTE format('CREATE POLICY %I ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = %L)', 'Authenticated Upload ' || b, b);

    EXECUTE format('DROP POLICY IF EXISTS %I ON storage.objects', 'Authenticated Update ' || b);
    EXECUTE format('CREATE POLICY %I ON storage.objects FOR UPDATE TO authenticated USING (bucket_id = %L) WITH CHECK (bucket_id = %L)', 'Authenticated Update ' || b, b, b);

    EXECUTE format('DROP POLICY IF EXISTS %I ON storage.objects', 'Authenticated Delete ' || b);
    EXECUTE format('CREATE POLICY %I ON storage.objects FOR DELETE TO authenticated USING (bucket_id = %L)', 'Authenticated Delete ' || b, b);
  END LOOP;
END $$;

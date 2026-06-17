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

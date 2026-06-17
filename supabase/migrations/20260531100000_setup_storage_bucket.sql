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

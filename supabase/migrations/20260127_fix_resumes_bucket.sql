-- Migration: Fix resumes storage bucket to be public
-- Date: 2026-01-27

-- Create storage bucket for resumes if it doesn't exist (public = true)
INSERT INTO storage.buckets (id, name, public)
VALUES ('resumes', 'resumes', true)
ON CONFLICT (id) DO UPDATE
SET public = true;

-- Drop existing storage policies if they exist
DROP POLICY IF EXISTS "Rushees can upload their resumes" ON storage.objects;
DROP POLICY IF EXISTS "Users can view their own resume" ON storage.objects;
DROP POLICY IF EXISTS "Admins and brothers can view all resumes" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete their own resume" ON storage.objects;
DROP POLICY IF EXISTS "Public can view resumes" ON storage.objects;

-- Storage policies for resumes
CREATE POLICY "Rushees can upload their resumes"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'resumes' AND
  auth.uid()::text = (storage.foldername(name))[1]
);

CREATE POLICY "Users can view their own resume"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'resumes' AND
  auth.uid()::text = (storage.foldername(name))[1]
);

CREATE POLICY "Admins and brothers can view all resumes"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'resumes' AND
  EXISTS (
    SELECT 1 FROM brothers
    WHERE brothers.id = auth.uid()
  )
);

CREATE POLICY "Users can delete their own resume"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'resumes' AND
  auth.uid()::text = (storage.foldername(name))[1]
);

-- Allow public access to resumes (since bucket is public)
CREATE POLICY "Public can view resumes"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'resumes');

-- Storage setup for attendance photos
-- Run this in the Supabase SQL Editor

-- Create the attendance-photos storage bucket (public access to view photos)
INSERT INTO storage.buckets (id, name, public)
VALUES ('attendance-photos', 'attendance-photos', true)
ON CONFLICT (id) DO NOTHING;

-- Policy: Allow authenticated users to upload attendance photos
CREATE POLICY "Authenticated users can upload attendance photos"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'attendance-photos'
);

-- Policy: Allow authenticated users to view all attendance photos
CREATE POLICY "Authenticated users can view attendance photos"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'attendance-photos'
);

-- Policy: Allow users to update their own attendance photos
CREATE POLICY "Users can update their own attendance photos"
ON storage.objects FOR UPDATE
TO authenticated
USING (
  bucket_id = 'attendance-photos' AND
  (storage.foldername(name))[1] = auth.uid()::text
);

-- Policy: Allow users to delete their own attendance photos
CREATE POLICY "Users can delete their own attendance photos"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'attendance-photos' AND
  (storage.foldername(name))[1] = auth.uid()::text
);

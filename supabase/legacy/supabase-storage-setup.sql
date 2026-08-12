-- Supabase Storage Bucket Setup for Profile Photos
-- Run this in the Supabase SQL Editor

-- Create the profile-photos storage bucket
INSERT INTO storage.buckets (id, name, public)
VALUES ('profile-photos', 'profile-photos', true);

-- Set up storage policies for profile-photos bucket

-- Policy: Allow authenticated users to upload their own profile photo
CREATE POLICY "Users can upload their own profile photo"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'profile-photos' AND
  (storage.foldername(name))[1] = auth.uid()::text
);

-- Policy: Allow authenticated users to update their own profile photo
CREATE POLICY "Users can update their own profile photo"
ON storage.objects FOR UPDATE
TO authenticated
USING (
  bucket_id = 'profile-photos' AND
  (storage.foldername(name))[1] = auth.uid()::text
);

-- Policy: Allow authenticated users to delete their own profile photo
CREATE POLICY "Users can delete their own profile photo"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'profile-photos' AND
  (storage.foldername(name))[1] = auth.uid()::text
);

-- Policy: Allow everyone to view profile photos (public bucket)
CREATE POLICY "Anyone can view profile photos"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'profile-photos');

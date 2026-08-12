-- Migration: Update applications table with new questions
-- Date: 2026-01-09

-- Drop old columns
ALTER TABLE applications
DROP COLUMN IF EXISTS why_akpsi,
DROP COLUMN IF EXISTS career_interests,
DROP COLUMN IF EXISTS brother_connection,
DROP COLUMN IF EXISTS rushee_connection,
DROP COLUMN IF EXISTS personal_description,
DROP COLUMN IF EXISTS pillar_resonance,
DROP COLUMN IF EXISTS pronouns,
DROP COLUMN IF EXISTS race,
DROP COLUMN IF EXISTS gpa,
DROP COLUMN IF EXISTS acknowledgement;

-- Add new columns for personal information
ALTER TABLE applications
ADD COLUMN legal_name TEXT,
ADD COLUMN preferred_name TEXT,
ADD COLUMN pronouns TEXT,
ADD COLUMN phone_number TEXT,
ADD COLUMN email TEXT;

-- Add new columns for academic information
ALTER TABLE applications
ADD COLUMN major TEXT,
ADD COLUMN minor TEXT,
ADD COLUMN gpa TEXT,
ADD COLUMN expected_graduation_date DATE,
ADD COLUMN resume_url TEXT;

-- Add new essay question columns
ALTER TABLE applications
ADD COLUMN outside_involvements TEXT,
ADD COLUMN how_heard_about_akpsi TEXT,
ADD COLUMN why_interested TEXT,
ADD COLUMN pillar_relation TEXT,
ADD COLUMN monopoly_piece TEXT,
ADD COLUMN monopoly_theme_lesson TEXT;

-- Create storage bucket for resumes if it doesn't exist
INSERT INTO storage.buckets (id, name, public)
VALUES ('resumes', 'resumes', false)
ON CONFLICT (id) DO NOTHING;

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
    SELECT 1 FROM user_profiles
    WHERE user_profiles.id = auth.uid()
    AND user_profiles.account_type IN ('brother', 'admin')
  )
);

CREATE POLICY "Users can delete their own resume"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'resumes' AND
  auth.uid()::text = (storage.foldername(name))[1]
);

-- Migration: Update applications table with new questions (v2)
-- Date: 2026-01-09

-- First, check if old columns exist and drop them
DO $$
BEGIN
  -- Drop old columns if they exist
  IF EXISTS (SELECT 1 FROM information_schema.columns
             WHERE table_name='applications' AND column_name='why_akpsi') THEN
    ALTER TABLE applications DROP COLUMN why_akpsi;
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.columns
             WHERE table_name='applications' AND column_name='career_interests') THEN
    ALTER TABLE applications DROP COLUMN career_interests;
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.columns
             WHERE table_name='applications' AND column_name='brother_connection') THEN
    ALTER TABLE applications DROP COLUMN brother_connection;
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.columns
             WHERE table_name='applications' AND column_name='rushee_connection') THEN
    ALTER TABLE applications DROP COLUMN rushee_connection;
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.columns
             WHERE table_name='applications' AND column_name='personal_description') THEN
    ALTER TABLE applications DROP COLUMN personal_description;
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.columns
             WHERE table_name='applications' AND column_name='pillar_resonance') THEN
    ALTER TABLE applications DROP COLUMN pillar_resonance;
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.columns
             WHERE table_name='applications' AND column_name='pronouns') THEN
    ALTER TABLE applications DROP COLUMN pronouns;
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.columns
             WHERE table_name='applications' AND column_name='race') THEN
    ALTER TABLE applications DROP COLUMN race;
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.columns
             WHERE table_name='applications' AND column_name='gpa') THEN
    ALTER TABLE applications DROP COLUMN gpa;
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.columns
             WHERE table_name='applications' AND column_name='acknowledgement') THEN
    ALTER TABLE applications DROP COLUMN acknowledgement;
  END IF;
END $$;

-- Add new columns for personal information (only if they don't exist)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                 WHERE table_name='applications' AND column_name='legal_name') THEN
    ALTER TABLE applications ADD COLUMN legal_name TEXT;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                 WHERE table_name='applications' AND column_name='preferred_name') THEN
    ALTER TABLE applications ADD COLUMN preferred_name TEXT;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                 WHERE table_name='applications' AND column_name='pronouns') THEN
    ALTER TABLE applications ADD COLUMN pronouns TEXT;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                 WHERE table_name='applications' AND column_name='phone_number') THEN
    ALTER TABLE applications ADD COLUMN phone_number TEXT;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                 WHERE table_name='applications' AND column_name='email') THEN
    ALTER TABLE applications ADD COLUMN email TEXT;
  END IF;
END $$;

-- Add new columns for academic information
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                 WHERE table_name='applications' AND column_name='major') THEN
    ALTER TABLE applications ADD COLUMN major TEXT;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                 WHERE table_name='applications' AND column_name='minor') THEN
    ALTER TABLE applications ADD COLUMN minor TEXT;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                 WHERE table_name='applications' AND column_name='gpa') THEN
    ALTER TABLE applications ADD COLUMN gpa TEXT;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                 WHERE table_name='applications' AND column_name='expected_graduation_date') THEN
    ALTER TABLE applications ADD COLUMN expected_graduation_date DATE;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                 WHERE table_name='applications' AND column_name='resume_url') THEN
    ALTER TABLE applications ADD COLUMN resume_url TEXT;
  END IF;
END $$;

-- Add new essay question columns
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                 WHERE table_name='applications' AND column_name='outside_involvements') THEN
    ALTER TABLE applications ADD COLUMN outside_involvements TEXT;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                 WHERE table_name='applications' AND column_name='how_heard_about_akpsi') THEN
    ALTER TABLE applications ADD COLUMN how_heard_about_akpsi TEXT;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                 WHERE table_name='applications' AND column_name='why_interested') THEN
    ALTER TABLE applications ADD COLUMN why_interested TEXT;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                 WHERE table_name='applications' AND column_name='pillar_relation') THEN
    ALTER TABLE applications ADD COLUMN pillar_relation TEXT;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                 WHERE table_name='applications' AND column_name='monopoly_piece') THEN
    ALTER TABLE applications ADD COLUMN monopoly_piece TEXT;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                 WHERE table_name='applications' AND column_name='monopoly_theme_lesson') THEN
    ALTER TABLE applications ADD COLUMN monopoly_theme_lesson TEXT;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                 WHERE table_name='applications' AND column_name='is_submitted') THEN
    ALTER TABLE applications ADD COLUMN is_submitted BOOLEAN DEFAULT FALSE;
  END IF;
END $$;

-- Create storage bucket for resumes if it doesn't exist
INSERT INTO storage.buckets (id, name, public)
VALUES ('resumes', 'resumes', false)
ON CONFLICT (id) DO NOTHING;

-- Drop existing storage policies if they exist
DROP POLICY IF EXISTS "Rushees can upload their resumes" ON storage.objects;
DROP POLICY IF EXISTS "Users can view their own resume" ON storage.objects;
DROP POLICY IF EXISTS "Admins and brothers can view all resumes" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete their own resume" ON storage.objects;

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

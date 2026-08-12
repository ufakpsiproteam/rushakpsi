-- Drop existing check constraints if they exist
ALTER TABLE rushees DROP CONSTRAINT IF EXISTS rushees_professional_interview_score_check;
ALTER TABLE rushees DROP CONSTRAINT IF EXISTS rushees_casual_interview_score_check;

-- Add interview score and comment fields to rushees table (if they don't exist)
ALTER TABLE rushees
ADD COLUMN IF NOT EXISTS professional_interview_score DECIMAL(4,1),
ADD COLUMN IF NOT EXISTS professional_interview_comment TEXT,
ADD COLUMN IF NOT EXISTS casual_interview_score DECIMAL(3,1),
ADD COLUMN IF NOT EXISTS casual_interview_comment TEXT;

-- Alter the professional_interview_score column type to support 0-20 range
ALTER TABLE rushees
ALTER COLUMN professional_interview_score TYPE DECIMAL(4,1);

-- Add new check constraints - professional out of 20, casual out of 10
ALTER TABLE rushees
ADD CONSTRAINT rushees_professional_interview_score_check
  CHECK (professional_interview_score >= 0 AND professional_interview_score <= 20);

ALTER TABLE rushees
ADD CONSTRAINT rushees_casual_interview_score_check
  CHECK (casual_interview_score >= 0 AND casual_interview_score <= 10);

-- Drop policy if exists and recreate
-- Grant update permissions to admins and professional team
DROP POLICY IF EXISTS "Admins and Professional team can update interview scores" ON rushees;

CREATE POLICY "Admins and Professional team can update interview scores"
ON rushees
FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM brothers
    WHERE brothers.id = auth.uid()
    AND brothers.access_level IN ('admin', 'pro')
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM brothers
    WHERE brothers.id = auth.uid()
    AND brothers.access_level IN ('admin', 'pro')
  )
);

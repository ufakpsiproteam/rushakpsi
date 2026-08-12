-- Allow professional_score to be 0 (N/A - Can't speak to professionalism)
-- This is needed when a brother hasn't had enough interaction to rate professional skills

-- Drop existing check constraint if it exists (common constraint names)
ALTER TABLE evaluations DROP CONSTRAINT IF EXISTS evaluations_professional_score_check;
ALTER TABLE evaluations DROP CONSTRAINT IF EXISTS professional_score_check;
ALTER TABLE evaluations DROP CONSTRAINT IF EXISTS check_professional_score;

-- Add new check constraint that allows 0-5 for professional_score
ALTER TABLE evaluations ADD CONSTRAINT evaluations_professional_score_check
  CHECK (professional_score >= 0 AND professional_score <= 5);

-- Ensure personal_score still requires 1-5
ALTER TABLE evaluations DROP CONSTRAINT IF EXISTS evaluations_personal_score_check;
ALTER TABLE evaluations DROP CONSTRAINT IF EXISTS personal_score_check;
ALTER TABLE evaluations DROP CONSTRAINT IF EXISTS check_personal_score;

ALTER TABLE evaluations ADD CONSTRAINT evaluations_personal_score_check
  CHECK (personal_score >= 1 AND personal_score <= 5);

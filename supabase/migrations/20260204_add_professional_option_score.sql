-- Add professional option score field to rushees table
ALTER TABLE rushees ADD COLUMN professional_option_score DECIMAL(2,1) CHECK (professional_option_score >= 0 AND professional_option_score <= 5);

-- Add comment to document the column
COMMENT ON COLUMN rushees.professional_option_score IS 'Professional option score after interview (1-5 scale)';

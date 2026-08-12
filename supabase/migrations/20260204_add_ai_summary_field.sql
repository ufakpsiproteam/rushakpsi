-- Add AI summary field to rushees table
ALTER TABLE rushees ADD COLUMN ai_summary TEXT;

-- Add comment to document the column
COMMENT ON COLUMN rushees.ai_summary IS 'AI-generated summary of all brother evaluations for this rushee';

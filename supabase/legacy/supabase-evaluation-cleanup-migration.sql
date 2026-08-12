-- Migration: Clean up duplicate evaluations before applying unique constraint
-- Step 1: Find and keep only the most recent evaluation per brother-rushee pair

-- First, let's see what duplicates exist (for reference)
-- Uncomment to see duplicates:
-- SELECT brother_id, rushee_id, COUNT(*) as count
-- FROM evaluations
-- GROUP BY brother_id, rushee_id
-- HAVING COUNT(*) > 1;

-- Step 2: Delete older duplicates, keeping only the most recent evaluation
-- This will merge multiple evaluations into one (the latest one)
WITH ranked_evaluations AS (
  SELECT
    id,
    brother_id,
    rushee_id,
    ROW_NUMBER() OVER (
      PARTITION BY brother_id, rushee_id
      ORDER BY updated_at DESC, created_at DESC
    ) as rn
  FROM evaluations
)
DELETE FROM evaluations
WHERE id IN (
  SELECT id
  FROM ranked_evaluations
  WHERE rn > 1
);

-- Step 3: Now drop the old unique constraint
ALTER TABLE evaluations DROP CONSTRAINT IF EXISTS evaluations_brother_id_rushee_id_event_id_key;

-- Step 4: Add new unique constraint (one evaluation per brother-rushee pair)
ALTER TABLE evaluations ADD CONSTRAINT evaluations_brother_rushee_unique UNIQUE(brother_id, rushee_id);

-- Step 5: Add an index for faster lookups
CREATE INDEX IF NOT EXISTS idx_evaluations_brother_rushee ON evaluations(brother_id, rushee_id);

-- Step 6: Create a function to upsert evaluations (insert or update)
CREATE OR REPLACE FUNCTION upsert_evaluation(
  p_brother_id UUID,
  p_rushee_id UUID,
  p_event_id UUID,
  p_professional_score INTEGER,
  p_personal_score INTEGER,
  p_knows_personally BOOLEAN,
  p_qualities TEXT[],
  p_comments TEXT
)
RETURNS TABLE (
  id UUID,
  brother_id UUID,
  rushee_id UUID,
  event_id UUID,
  professional_score INTEGER,
  personal_score INTEGER,
  knows_personally BOOLEAN,
  qualities TEXT[],
  comments TEXT,
  created_at TIMESTAMP WITH TIME ZONE,
  updated_at TIMESTAMP WITH TIME ZONE
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  INSERT INTO evaluations (
    brother_id,
    rushee_id,
    event_id,
    professional_score,
    personal_score,
    knows_personally,
    qualities,
    comments,
    updated_at
  )
  VALUES (
    p_brother_id,
    p_rushee_id,
    p_event_id,
    p_professional_score,
    p_personal_score,
    p_knows_personally,
    p_qualities,
    p_comments,
    NOW()
  )
  ON CONFLICT (brother_id, rushee_id)
  DO UPDATE SET
    event_id = p_event_id,
    professional_score = p_professional_score,
    personal_score = p_personal_score,
    knows_personally = p_knows_personally,
    qualities = p_qualities,
    comments = p_comments,
    updated_at = NOW()
  RETURNING *;
END;
$$;

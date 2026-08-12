-- Migration: Change evaluations to one per brother-rushee pair (instead of per event)
-- This allows brothers to update their evaluation of a rushee across all events

-- 1. Drop the old unique constraint
ALTER TABLE evaluations DROP CONSTRAINT IF EXISTS evaluations_brother_id_rushee_id_event_id_key;

-- 2. Add new unique constraint (one evaluation per brother-rushee pair)
ALTER TABLE evaluations ADD CONSTRAINT evaluations_brother_rushee_unique UNIQUE(brother_id, rushee_id);

-- 3. Make event_id nullable (since evaluation is no longer tied to specific event)
-- It's already nullable (ON DELETE SET NULL), so this is just for clarity

-- 4. Add an index for faster lookups
CREATE INDEX IF NOT EXISTS idx_evaluations_brother_rushee ON evaluations(brother_id, rushee_id);

-- 5. Create a function to upsert evaluations (insert or update)
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

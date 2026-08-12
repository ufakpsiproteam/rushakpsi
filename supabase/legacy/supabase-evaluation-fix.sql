-- Fix the upsert_evaluation function to handle ambiguous column names

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
    event_id = EXCLUDED.event_id,
    professional_score = EXCLUDED.professional_score,
    personal_score = EXCLUDED.personal_score,
    knows_personally = EXCLUDED.knows_personally,
    qualities = EXCLUDED.qualities,
    comments = EXCLUDED.comments,
    updated_at = NOW()
  RETURNING
    evaluations.id,
    evaluations.brother_id,
    evaluations.rushee_id,
    evaluations.event_id,
    evaluations.professional_score,
    evaluations.personal_score,
    evaluations.knows_personally,
    evaluations.qualities,
    evaluations.comments,
    evaluations.created_at,
    evaluations.updated_at;
END;
$$;

-- Simpler upsert function that avoids ambiguity issues

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
DECLARE
  v_exists BOOLEAN;
  v_eval_id UUID;
BEGIN
  -- Check if evaluation already exists
  SELECT EXISTS(
    SELECT 1 FROM evaluations e
    WHERE e.brother_id = p_brother_id AND e.rushee_id = p_rushee_id
  ) INTO v_exists;

  IF v_exists THEN
    -- Update existing evaluation
    UPDATE evaluations e
    SET
      event_id = p_event_id,
      professional_score = p_professional_score,
      personal_score = p_personal_score,
      knows_personally = p_knows_personally,
      qualities = p_qualities,
      comments = p_comments,
      updated_at = NOW()
    WHERE e.brother_id = p_brother_id AND e.rushee_id = p_rushee_id
    RETURNING e.id INTO v_eval_id;
  ELSE
    -- Insert new evaluation
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
    RETURNING evaluations.id INTO v_eval_id;
  END IF;

  -- Return the evaluation record
  RETURN QUERY
  SELECT
    e.id,
    e.brother_id,
    e.rushee_id,
    e.event_id,
    e.professional_score,
    e.personal_score,
    e.knows_personally,
    e.qualities,
    e.comments,
    e.created_at,
    e.updated_at
  FROM evaluations e
  WHERE e.id = v_eval_id;
END;
$$;

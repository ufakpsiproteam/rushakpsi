-- Interview flow batch fixes (see plan: interview flow — batch fixes).
-- Server-side backstop for rules enforced client-side in
-- app/brother/interviews/{page,actions}.tsx:
--   1. Professional interviews are capped to exactly one rushee.
--   2/3. Casual interviews (1 brother : 1 rushee model) must have every
--        selected rushee covered by at least one panelist assignment —
--        this is the actual invariant that matters; the "brothers >=
--        rushees" ratio enforced client-side is just what makes this
--        achievable, so only coverage is re-checked here.
--   4. A flagged casual conflict no longer blocks submission — it stays
--      visible on the row (conflict_flagged_at) for leadership instead
--      of hard-blocking the panelist from completing their rubric.
-- Safe to re-run.

CREATE OR REPLACE FUNCTION fn_start_interview(
  p_type INTERVIEW_TYPE,
  p_rushee_ids UUID[],
  p_assignments JSONB
) RETURNS UUID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_caller UUID := auth.uid();
  v_interview_id UUID;
  v_missing UUID;
  v_entry JSONB;
  v_brother_id UUID;
  v_rid UUID;
  v_lock_key UUID;
BEGIN
  IF v_caller IS NOT NULL AND NOT fn_can_manage_interviews() THEN
    RAISE EXCEPTION 'Only recruitment directors, professional team, or admins may start an interview';
  END IF;

  IF p_rushee_ids IS NULL OR array_length(p_rushee_ids, 1) IS NULL THEN
    RAISE EXCEPTION 'At least one rushee is required';
  END IF;

  IF p_type = 'professional' AND array_length(p_rushee_ids, 1) <> 1 THEN
    RAISE EXCEPTION 'Professional interviews are for a single rushee';
  END IF;

  SELECT r INTO v_missing FROM unnest(p_rushee_ids) r
    WHERE NOT EXISTS (SELECT 1 FROM rushees WHERE id = r) LIMIT 1;
  IF v_missing IS NOT NULL THEN
    RAISE EXCEPTION 'Unknown rushee %', v_missing;
  END IF;

  SELECT (e ->> 'brother_id')::UUID INTO v_missing
  FROM jsonb_array_elements(p_assignments) e
  WHERE NOT EXISTS (SELECT 1 FROM brothers WHERE id = (e ->> 'brother_id')::UUID)
  LIMIT 1;
  IF v_missing IS NOT NULL THEN
    RAISE EXCEPTION 'Unknown brother %', v_missing;
  END IF;

  -- Every selected rushee must have at least one panelist assigned to
  -- them (R3) — the actual invariant; the caller's "brothers >= rushees"
  -- ratio (R2) is just what makes this achievable under the casual 1:1
  -- model, so this coverage check is what's authoritative here and is
  -- checked regardless of type (trivially satisfied by professional's
  -- cross-product with the single-rushee cap above).
  SELECT r INTO v_missing FROM unnest(p_rushee_ids) r
    WHERE NOT EXISTS (
      SELECT 1 FROM jsonb_array_elements(p_assignments) e,
        jsonb_array_elements_text(e -> 'rushee_ids') rid
      WHERE rid::UUID = r
    )
  LIMIT 1;
  IF v_missing IS NOT NULL THEN
    RAISE EXCEPTION 'Rushee % has no assigned panelist', v_missing;
  END IF;

  -- Advisory locks, one per rushee being started, fixed ascending
  -- order so two concurrent calls covering overlapping rushee sets
  -- can't deadlock each other. This is what actually serializes
  -- concurrent starts on the same rushee/type — not the trigger.
  FOR v_lock_key IN SELECT r FROM unnest(p_rushee_ids) r ORDER BY r LOOP
    PERFORM pg_advisory_xact_lock(hashtext(v_lock_key::text || ':' || p_type::text)::bigint);
  END LOOP;

  INSERT INTO interviews (type, status, started_by)
  VALUES (p_type, 'in_progress', v_caller)
  RETURNING id INTO v_interview_id;

  FOR v_entry IN SELECT * FROM jsonb_array_elements(p_assignments) LOOP
    v_brother_id := (v_entry ->> 'brother_id')::UUID;
    FOR v_rid IN SELECT jsonb_array_elements_text(v_entry -> 'rushee_ids')::UUID LOOP
      INSERT INTO interview_assignments (interview_id, brother_id, rushee_id)
      VALUES (v_interview_id, v_brother_id, v_rid);
    END LOOP;
  END LOOP;

  INSERT INTO audit_log (actor_id, action, entity_type, entity_id, after)
    VALUES (v_caller, 'interview.start', 'interview', v_interview_id, jsonb_build_object('type', p_type, 'rushee_ids', p_rushee_ids));
  INSERT INTO audit_log (actor_id, action, entity_type, entity_id, after)
    VALUES (v_caller, 'interview.assign', 'interview', v_interview_id, jsonb_build_object('assignments', p_assignments));

  RETURN v_interview_id;
END;
$$;

-- fn_submit_assignment — same as before except the flagged-conflict
-- block is removed (R4): a casual conflict of interest no longer
-- blocks the panelist from completing and submitting their rubric.
-- conflict_flagged_at stays on the row, still visible to leadership in
-- the Manage Sessions panel — it's a note, not a gate.
CREATE OR REPLACE FUNCTION fn_submit_assignment(
  p_interview_id UUID, p_rushee_id UUID, p_recommendation SMALLINT, p_recommendation_notes TEXT
) RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_caller UUID := auth.uid();
  v_iv_status interview_status;
  v_conflict TIMESTAMPTZ;
  v_bad_question UUID;
BEGIN
  IF v_caller IS NULL THEN
    RAISE EXCEPTION 'fn_submit_assignment must be called by an authenticated brother';
  END IF;

  SELECT iv.status, ia.conflict_flagged_at INTO v_iv_status, v_conflict
  FROM interview_assignments ia JOIN interviews iv ON iv.id = ia.interview_id
  WHERE ia.interview_id = p_interview_id AND ia.brother_id = v_caller AND ia.rushee_id = p_rushee_id
    AND ia.status = 'pending';

  IF v_iv_status IS NULL THEN
    RAISE EXCEPTION 'No pending assignment found for this interview/rushee';
  END IF;
  IF v_iv_status <> 'in_progress' THEN
    RAISE EXCEPTION 'Interview is not in progress';
  END IF;

  -- Every is_scored question needs a score.
  SELECT q.id INTO v_bad_question
  FROM interview_questions q
  JOIN interviews iv ON iv.id = p_interview_id
  LEFT JOIN interview_answers a ON a.interview_id = p_interview_id AND a.brother_id = v_caller
    AND a.rushee_id = p_rushee_id AND a.question_id = q.id
  WHERE q.is_active AND q.type = iv.type AND q.is_scored AND q.field_type = 'score_notes' AND a.score IS NULL
  LIMIT 1;
  IF v_bad_question IS NOT NULL THEN
    RAISE EXCEPTION 'Question % is missing a score', v_bad_question;
  END IF;

  -- Every yes_no question (scored or not, e.g. casual Q7) needs an answer.
  -- Deliberately a separate check from the one above: "every scored
  -- question has a score" alone would let an is_scored=false yes_no
  -- question be skipped entirely.
  SELECT q.id INTO v_bad_question
  FROM interview_questions q
  JOIN interviews iv ON iv.id = p_interview_id
  LEFT JOIN interview_answers a ON a.interview_id = p_interview_id AND a.brother_id = v_caller
    AND a.rushee_id = p_rushee_id AND a.question_id = q.id
  WHERE q.is_active AND q.type = iv.type AND q.field_type = 'yes_no' AND a.yes_no IS NULL
  LIMIT 1;
  IF v_bad_question IS NOT NULL THEN
    RAISE EXCEPTION 'Question % is missing a yes/no answer', v_bad_question;
  END IF;

  -- Every notes_required question needs non-empty notes.
  SELECT q.id INTO v_bad_question
  FROM interview_questions q
  JOIN interviews iv ON iv.id = p_interview_id
  LEFT JOIN interview_answers a ON a.interview_id = p_interview_id AND a.brother_id = v_caller
    AND a.rushee_id = p_rushee_id AND a.question_id = q.id
  WHERE q.is_active AND q.type = iv.type AND q.notes_required AND (a.notes IS NULL OR btrim(a.notes) = '')
  LIMIT 1;
  IF v_bad_question IS NOT NULL THEN
    RAISE EXCEPTION 'Question % is missing required notes', v_bad_question;
  END IF;

  IF p_recommendation IS NULL OR p_recommendation_notes IS NULL OR btrim(p_recommendation_notes) = '' THEN
    RAISE EXCEPTION 'A recommendation and recommendation notes are required';
  END IF;

  UPDATE interview_assignments
    SET status = 'submitted', submitted_at = now(),
        recommendation = p_recommendation, recommendation_notes = p_recommendation_notes
    WHERE interview_id = p_interview_id AND brother_id = v_caller AND rushee_id = p_rushee_id
      AND status = 'pending';

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Assignment was no longer pending at submit time (removed or already submitted)';
  END IF;

  INSERT INTO audit_log (actor_id, action, entity_type, entity_id, after)
    VALUES (v_caller, 'interview.submit', 'interview_assignment', p_interview_id,
            jsonb_build_object('rushee_id', p_rushee_id, 'recommendation', p_recommendation));

  PERFORM fn_try_complete_interview(p_interview_id);
END;
$$;

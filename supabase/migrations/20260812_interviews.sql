-- =====================================================================
-- Interviews — casual and professional, panel-scored.
-- Adapted from INTERVIEWS-IMPLEMENTATION-PROMPT.md for this repo's
-- actual state: no cycles table exists, so nothing here is cycle-scoped
-- (matches evaluations/rushees, also not cycle-scoped today). Brother
-- accounts live in `brothers`, not `profiles`.
--
-- All state-changing operations (start/reassign/drop/remove/cancel/
-- submit/conflict-flag) are SECURITY DEFINER RPC functions that check
-- authorization internally via auth.uid(), mirroring the existing
-- create_manual_attendance() pattern
-- (20260811_drop_qr_checkin_harden_manual_attendance.sql). They MUST be
-- invoked from application code using the caller's own session-scoped
-- Supabase client (cookies/JWT), never the service-role client — the
-- service-role bypass (auth.uid() IS NULL) exists only so the service
-- client / seed migrations can call them administratively, not so an
-- application server action can skip authorization.
--
-- Safe to re-run.
-- =====================================================================

DO $$ BEGIN
  CREATE TYPE interview_type AS ENUM ('casual', 'professional');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE interview_status AS ENUM ('in_progress', 'completed', 'cancelled');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE assignment_status AS ENUM ('pending', 'submitted', 'removed');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ---------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS interview_questions (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  type               interview_type NOT NULL,
  order_index        INT NOT NULL,
  prompt             TEXT NOT NULL,
  help_text          TEXT,
  is_scored          BOOLEAN NOT NULL DEFAULT true,
  field_type         TEXT NOT NULL DEFAULT 'score_notes' CHECK (field_type IN ('score_notes', 'yes_no')),
  score_options      JSONB,
  timer_seconds      INT,
  notes_required     BOOLEAN NOT NULL DEFAULT true,
  needs_human_review BOOLEAN NOT NULL DEFAULT false,
  review_reason      TEXT,
  is_active          BOOLEAN NOT NULL DEFAULT true,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (type, order_index)
);

CREATE TABLE IF NOT EXISTS interview_scripts (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  type       interview_type NOT NULL,
  kind       TEXT NOT NULL CHECK (kind IN ('opening', 'closing', 'interviewer_notes', 'conflict_script')),
  position   INT NOT NULL DEFAULT 0,
  content    TEXT NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_by UUID REFERENCES brothers(id)
);
CREATE INDEX IF NOT EXISTS idx_interview_scripts_type_kind ON interview_scripts (type, kind, position);

CREATE TABLE IF NOT EXISTS interviews (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  type          interview_type NOT NULL,
  status        interview_status NOT NULL DEFAULT 'in_progress',
  started_by    UUID NOT NULL REFERENCES brothers(id),
  started_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at  TIMESTAMPTZ,
  cancelled_by  UUID REFERENCES brothers(id),
  cancelled_at  TIMESTAMPTZ,
  cancel_reason TEXT
);
CREATE INDEX IF NOT EXISTS idx_interviews_status ON interviews (status);

CREATE TABLE IF NOT EXISTS interview_assignments (
  interview_id         UUID NOT NULL REFERENCES interviews(id) ON DELETE CASCADE,
  brother_id           UUID NOT NULL REFERENCES brothers(id) ON DELETE CASCADE,
  rushee_id            UUID NOT NULL REFERENCES rushees(id) ON DELETE CASCADE,
  status               assignment_status NOT NULL DEFAULT 'pending',
  knows_personally     BOOLEAN NOT NULL DEFAULT false,
  conflict_flagged_at  TIMESTAMPTZ,
  recommendation       SMALLINT CHECK (recommendation BETWEEN 1 AND 5),
  recommendation_notes TEXT,
  submitted_at         TIMESTAMPTZ,
  removed_by           UUID REFERENCES brothers(id),
  removed_at           TIMESTAMPTZ,
  created_at           TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (interview_id, brother_id, rushee_id),
  CHECK (status <> 'submitted' OR (recommendation IS NOT NULL AND submitted_at IS NOT NULL))
);
CREATE INDEX IF NOT EXISTS idx_interview_assignments_brother ON interview_assignments (brother_id, status);
CREATE INDEX IF NOT EXISTS idx_interview_assignments_rushee  ON interview_assignments (rushee_id, status);

CREATE TABLE IF NOT EXISTS interview_answers (
  interview_id UUID NOT NULL,
  brother_id   UUID NOT NULL,
  rushee_id    UUID NOT NULL,
  question_id  UUID NOT NULL REFERENCES interview_questions(id),
  score        NUMERIC(3,1),
  yes_no       BOOLEAN,
  notes        TEXT,
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (interview_id, brother_id, rushee_id, question_id),
  FOREIGN KEY (interview_id, brother_id, rushee_id)
    REFERENCES interview_assignments (interview_id, brother_id, rushee_id) ON DELETE CASCADE
);

-- ---------------------------------------------------------------------
-- Triggers — validation and duplicate/lock guards.
-- NOTE: the duplicate-interview and panelist-lock triggers are a
-- backstop for any direct write, not the concurrency mechanism.
-- BEFORE INSERT triggers that SELECT give no protection under READ
-- COMMITTED (two concurrent inserts both see "no conflict" before
-- either commits). The real guard is pg_advisory_xact_lock inside
-- fn_start_interview, below.
-- ---------------------------------------------------------------------

CREATE OR REPLACE FUNCTION fn_guard_duplicate_interview()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  conflict_id UUID;
  iv_type interview_type;
BEGIN
  SELECT type INTO iv_type FROM interviews WHERE id = NEW.interview_id;

  SELECT ia.interview_id INTO conflict_id
  FROM interview_assignments ia
  JOIN interviews iv ON iv.id = ia.interview_id
  WHERE ia.rushee_id = NEW.rushee_id
    AND iv.type = iv_type
    AND iv.status = 'in_progress'
    AND ia.interview_id <> NEW.interview_id
  LIMIT 1;

  IF conflict_id IS NOT NULL THEN
    RAISE EXCEPTION 'Rushee % already has an in-progress % interview (%)',
      NEW.rushee_id, iv_type, conflict_id;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_guard_duplicate_interview ON interview_assignments;
CREATE TRIGGER trg_guard_duplicate_interview
  BEFORE INSERT ON interview_assignments
  FOR EACH ROW EXECUTE FUNCTION fn_guard_duplicate_interview();

CREATE OR REPLACE FUNCTION fn_guard_panelist_lock()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  blocker RECORD;
BEGIN
  -- Scoped to a DIFFERENT interview_id: a brother assigned two rushees
  -- within the SAME interview (the many-to-many case this feature
  -- exists to support) must not trip this guard.
  SELECT ia.interview_id, iv.type, ia.rushee_id INTO blocker
  FROM interview_assignments ia
  JOIN interviews iv ON iv.id = ia.interview_id
  WHERE ia.brother_id = NEW.brother_id
    AND ia.status = 'pending'
    AND ia.interview_id <> NEW.interview_id
  LIMIT 1;

  IF blocker.interview_id IS NOT NULL THEN
    RAISE EXCEPTION
      'Brother % already has a pending % interview assignment (interview %, rushee %) and cannot be added to a new interview until it is resolved',
      NEW.brother_id, blocker.type, blocker.interview_id, blocker.rushee_id;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_guard_panelist_lock ON interview_assignments;
CREATE TRIGGER trg_guard_panelist_lock
  BEFORE INSERT ON interview_assignments
  FOR EACH ROW EXECUTE FUNCTION fn_guard_panelist_lock();

CREATE OR REPLACE FUNCTION fn_guard_interview_answer()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  q RECORD;
  iv_type interview_type;
  valid_value BOOLEAN;
BEGIN
  SELECT type, is_scored, field_type, score_options INTO q
  FROM interview_questions WHERE id = NEW.question_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Unknown interview question %', NEW.question_id;
  END IF;

  SELECT type INTO iv_type FROM interviews WHERE id = NEW.interview_id;
  IF iv_type IS DISTINCT FROM q.type THEN
    RAISE EXCEPTION 'Question % belongs to type % but interview % is type %',
      NEW.question_id, q.type, NEW.interview_id, iv_type;
  END IF;

  IF q.field_type = 'yes_no' THEN
    NEW.score := NULL;
  ELSIF q.is_scored THEN
    IF NEW.score IS NOT NULL THEN
      SELECT EXISTS (
        SELECT 1 FROM jsonb_array_elements(q.score_options) opt
        WHERE (opt ->> 'value')::NUMERIC = NEW.score
      ) INTO valid_value;
      IF NOT valid_value THEN
        RAISE EXCEPTION 'Score % is not a valid option for question %', NEW.score, NEW.question_id;
      END IF;
    END IF;
    NEW.yes_no := NULL;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_guard_interview_answer ON interview_answers;
CREATE TRIGGER trg_guard_interview_answer
  BEFORE INSERT OR UPDATE ON interview_answers
  FOR EACH ROW EXECUTE FUNCTION fn_guard_interview_answer();

-- ---------------------------------------------------------------------
-- Authorization predicates
-- ---------------------------------------------------------------------

-- Write access: start/reassign/drop/remove/cancel. Deliberately
-- excludes professional_chair, per the permission matrix.
CREATE OR REPLACE FUNCTION fn_can_manage_interviews()
RETURNS BOOLEAN LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT fn_is_admin()
    OR EXISTS (SELECT 1 FROM brothers WHERE id = auth.uid() AND access_level IN ('pro', 'recruitment'))
    OR EXISTS (
      SELECT 1 FROM brother_roles
      WHERE brother_id = auth.uid() AND role IN ('recruitment_director', 'professional_team')
    );
$$;

-- Read access: all of the above, plus professional_chair (full read,
-- no manage capability — the matrix's deliberate split).
CREATE OR REPLACE FUNCTION fn_can_read_interviews()
RETURNS BOOLEAN LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT fn_can_manage_interviews()
    OR EXISTS (
      SELECT 1 FROM brother_roles WHERE brother_id = auth.uid() AND role = 'professional_chair'
    );
$$;

-- ---------------------------------------------------------------------
-- fn_try_complete_interview — single atomic completion check, called
-- from every path that can leave an interview with no pending
-- assignments (submit, remove, drop). Not just submit — otherwise a
-- rushee dropped as the last outstanding assignment, or a panelist
-- removed as the last one, would leave the interview in_progress
-- forever, permanently locking out every remaining panelist.
-- ---------------------------------------------------------------------

CREATE OR REPLACE FUNCTION fn_try_complete_interview(p_interview_id UUID)
RETURNS BOOLEAN LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  UPDATE interviews SET status = 'completed', completed_at = now()
    WHERE id = p_interview_id AND status = 'in_progress'
      AND NOT EXISTS (
        SELECT 1 FROM interview_assignments WHERE interview_id = p_interview_id AND status = 'pending'
      );
  IF FOUND THEN
    INSERT INTO audit_log (actor_id, action, entity_type, entity_id)
      VALUES (auth.uid(), 'interview.complete', 'interview', p_interview_id);
    RETURN true;
  END IF;
  RETURN false;
END;
$$;

-- ---------------------------------------------------------------------
-- fn_start_interview — the only path that creates interview_assignments
-- rows in bulk. Authorizes internally, validates targets, takes
-- per-rushee advisory locks (the actual concurrency guard — see note
-- above the triggers), inserts interview + assignments in one
-- transaction, audits interview.start and interview.assign.
--
-- p_assignments shape: [{"brother_id": "<uuid>", "rushee_ids": ["<uuid>", ...]}, ...]
-- ---------------------------------------------------------------------

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

-- ---------------------------------------------------------------------
-- fn_reassign_panelist — DELETE then INSERT, not UPDATE. rushee_id is
-- part of interview_assignments' primary key and interview_answers has
-- a composite FK into it; updating the PK either errors or (if a
-- cascade were added) would carry the old rushee's answers onto the
-- new rushee, the opposite of "reassigning discards answers".
-- ---------------------------------------------------------------------

CREATE OR REPLACE FUNCTION fn_reassign_panelist(
  p_interview_id UUID, p_brother_id UUID, p_old_rushee_id UUID, p_new_rushee_id UUID
) RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_caller UUID := auth.uid();
  v_status interview_status;
  v_old_status assignment_status;
BEGIN
  SELECT status INTO v_status FROM interviews WHERE id = p_interview_id;
  IF v_status IS NULL THEN RAISE EXCEPTION 'Unknown interview %', p_interview_id; END IF;
  IF v_caller IS NOT NULL AND NOT (fn_is_admin() OR (fn_can_manage_interviews() AND v_status = 'in_progress')) THEN
    RAISE EXCEPTION 'Not authorized to reassign panelists on this interview';
  END IF;

  SELECT status INTO v_old_status FROM interview_assignments
    WHERE interview_id = p_interview_id AND brother_id = p_brother_id AND rushee_id = p_old_rushee_id;
  IF v_old_status IS NULL THEN RAISE EXCEPTION 'No such assignment to reassign'; END IF;
  IF v_old_status <> 'pending' THEN RAISE EXCEPTION 'Can only reassign a pending assignment'; END IF;

  DELETE FROM interview_assignments
    WHERE interview_id = p_interview_id AND brother_id = p_brother_id AND rushee_id = p_old_rushee_id;

  INSERT INTO interview_assignments (interview_id, brother_id, rushee_id)
    VALUES (p_interview_id, p_brother_id, p_new_rushee_id);

  INSERT INTO audit_log (actor_id, action, entity_type, entity_id, before, after)
    VALUES (v_caller, 'interview.reassign', 'interview_assignment', p_interview_id,
            jsonb_build_object('brother_id', p_brother_id, 'rushee_id', p_old_rushee_id),
            jsonb_build_object('brother_id', p_brother_id, 'rushee_id', p_new_rushee_id));
END;
$$;

-- ---------------------------------------------------------------------
-- fn_drop_rushee — one explicit UPDATE covering every panelist
-- assigned to the rushee, so the stuck-interview display (which reads
-- status='pending' directly) reflects the drop immediately rather than
-- depending on the panelist-lock trigger's passivity (it only fires on
-- INSERT and has no opinion about display state).
-- ---------------------------------------------------------------------

CREATE OR REPLACE FUNCTION fn_drop_rushee(p_interview_id UUID, p_rushee_id UUID)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_caller UUID := auth.uid();
  v_status interview_status;
BEGIN
  SELECT status INTO v_status FROM interviews WHERE id = p_interview_id;
  IF v_status IS NULL THEN RAISE EXCEPTION 'Unknown interview %', p_interview_id; END IF;
  IF v_caller IS NOT NULL AND NOT (fn_is_admin() OR (fn_can_manage_interviews() AND v_status = 'in_progress')) THEN
    RAISE EXCEPTION 'Not authorized to drop a rushee from this interview';
  END IF;

  UPDATE interview_assignments
    SET status = 'removed', removed_by = v_caller, removed_at = now()
    WHERE interview_id = p_interview_id AND rushee_id = p_rushee_id AND status = 'pending';

  INSERT INTO audit_log (actor_id, action, entity_type, entity_id, after)
    VALUES (v_caller, 'interview.rushee_drop', 'interview', p_interview_id, jsonb_build_object('rushee_id', p_rushee_id));

  PERFORM fn_try_complete_interview(p_interview_id);
END;
$$;

CREATE OR REPLACE FUNCTION fn_remove_panelist(p_interview_id UUID, p_brother_id UUID, p_rushee_id UUID)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_caller UUID := auth.uid();
  v_status interview_status;
BEGIN
  SELECT status INTO v_status FROM interviews WHERE id = p_interview_id;
  IF v_status IS NULL THEN RAISE EXCEPTION 'Unknown interview %', p_interview_id; END IF;
  IF v_caller IS NOT NULL AND NOT (fn_is_admin() OR (fn_can_manage_interviews() AND v_status IN ('in_progress', 'completed'))) THEN
    RAISE EXCEPTION 'Not authorized to remove this panelist';
  END IF;

  UPDATE interview_assignments
    SET status = 'removed', removed_by = v_caller, removed_at = now()
    WHERE interview_id = p_interview_id AND brother_id = p_brother_id AND rushee_id = p_rushee_id
      AND status <> 'removed';

  INSERT INTO audit_log (actor_id, action, entity_type, entity_id, after)
    VALUES (v_caller, 'interview.panelist_remove', 'interview', p_interview_id,
            jsonb_build_object('brother_id', p_brother_id, 'rushee_id', p_rushee_id));

  PERFORM fn_try_complete_interview(p_interview_id);
END;
$$;

-- ---------------------------------------------------------------------
-- fn_cancel_interview — must ALSO release every remaining pending
-- assignment. The panelist-lock trigger only checks status='pending',
-- not the parent interview's status, so skipping this would leave
-- those panelists locked out of every future interview forever even
-- though the interview they're stuck in is cancelled.
-- ---------------------------------------------------------------------

CREATE OR REPLACE FUNCTION fn_cancel_interview(p_interview_id UUID, p_reason TEXT)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_caller UUID := auth.uid();
  v_status interview_status;
BEGIN
  SELECT status INTO v_status FROM interviews WHERE id = p_interview_id;
  IF v_status IS NULL THEN RAISE EXCEPTION 'Unknown interview %', p_interview_id; END IF;
  IF v_caller IS NOT NULL AND NOT (fn_is_admin() OR (fn_can_manage_interviews() AND v_status = 'in_progress')) THEN
    RAISE EXCEPTION 'Not authorized to cancel this interview';
  END IF;
  IF p_reason IS NULL OR btrim(p_reason) = '' THEN
    RAISE EXCEPTION 'Cancellation requires a reason';
  END IF;

  UPDATE interviews SET status = 'cancelled', cancelled_by = v_caller, cancelled_at = now(), cancel_reason = p_reason
    WHERE id = p_interview_id;

  UPDATE interview_assignments
    SET status = 'removed', removed_by = v_caller, removed_at = now()
    WHERE interview_id = p_interview_id AND status = 'pending';

  INSERT INTO audit_log (actor_id, action, entity_type, entity_id, after)
    VALUES (v_caller, 'interview.cancel', 'interview', p_interview_id, jsonb_build_object('reason', p_reason));
END;
$$;

-- ---------------------------------------------------------------------
-- fn_submit_assignment — the submit path. Re-validates everything
-- server-side (never trust the client's earlier soft checks), and uses
-- a single atomic UPDATE ... WHERE status='pending' (checked via
-- GET DIAGNOSTICS / FOUND) rather than SELECT-then-UPDATE, closing the
-- submit-vs-removal race: if removePanelist wins, this UPDATE simply
-- matches zero rows and fails cleanly.
-- ---------------------------------------------------------------------

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
  IF v_conflict IS NOT NULL THEN
    RAISE EXCEPTION 'A flagged conflict blocks submission for this assignment';
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

CREATE OR REPLACE FUNCTION fn_flag_casual_conflict(p_interview_id UUID, p_rushee_id UUID)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_caller UUID := auth.uid();
BEGIN
  IF v_caller IS NULL THEN RAISE EXCEPTION 'Must be authenticated'; END IF;
  UPDATE interview_assignments SET conflict_flagged_at = now()
    WHERE interview_id = p_interview_id AND brother_id = v_caller AND rushee_id = p_rushee_id AND status = 'pending';
  IF NOT FOUND THEN RAISE EXCEPTION 'No pending assignment to flag'; END IF;
END;
$$;

CREATE OR REPLACE FUNCTION fn_flag_professional_conflict(p_interview_id UUID, p_rushee_id UUID)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_caller UUID := auth.uid();
BEGIN
  IF v_caller IS NULL THEN RAISE EXCEPTION 'Must be authenticated'; END IF;
  UPDATE interview_assignments SET knows_personally = true
    WHERE interview_id = p_interview_id AND brother_id = v_caller AND rushee_id = p_rushee_id AND status = 'pending';
  IF NOT FOUND THEN RAISE EXCEPTION 'No pending assignment to flag'; END IF;
END;
$$;

-- ---------------------------------------------------------------------
-- fn_interview_progress — counts only, deliberately no interview_id.
-- Any brother can already read interview_assignments rows where
-- brother_id = auth.uid(); if this also returned interview_id, a
-- regular brother could join it against their own visible rows to
-- infer who else is on a panel and whether those panelists have
-- submitted. The grid only needs rushee/type/status/counts.
-- SECURITY DEFINER (not a security_invoker view) because a regular
-- brother's only SELECT policy on interview_assignments is own-row —
-- a security_invoker aggregate would under-count for every
-- non-leadership brother, which is most of this function's callers.
-- ---------------------------------------------------------------------

CREATE OR REPLACE FUNCTION fn_interview_progress()
RETURNS TABLE (rushee_id UUID, type interview_type, interview_status interview_status,
               pending_count INT, submitted_count INT, removed_count INT, started_at TIMESTAMPTZ)
LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT r.id, iv.type, iv.status,
    COUNT(*) FILTER (WHERE ia.status = 'pending')::INT,
    COUNT(*) FILTER (WHERE ia.status = 'submitted')::INT,
    COUNT(*) FILTER (WHERE ia.status = 'removed')::INT,
    iv.started_at
  FROM rushees r
  JOIN interview_assignments ia ON ia.rushee_id = r.id
  JOIN interviews iv ON iv.id = ia.interview_id
  GROUP BY r.id, iv.type, iv.status, iv.started_at;
$$;

GRANT EXECUTE ON FUNCTION
  fn_can_manage_interviews(), fn_can_read_interviews(), fn_try_complete_interview(UUID),
  fn_start_interview(INTERVIEW_TYPE, UUID[], JSONB),
  fn_reassign_panelist(UUID, UUID, UUID, UUID), fn_drop_rushee(UUID, UUID),
  fn_remove_panelist(UUID, UUID, UUID), fn_cancel_interview(UUID, TEXT),
  fn_submit_assignment(UUID, UUID, SMALLINT, TEXT),
  fn_flag_casual_conflict(UUID, UUID), fn_flag_professional_conflict(UUID, UUID),
  fn_interview_progress()
  TO authenticated;

-- ---------------------------------------------------------------------
-- RLS — split per identity class, never one policy OR-ing "own row"
-- with "leadership" (this repo learned that lesson the hard way, see
-- docs/CHANGELOG-2026-08-11.md §2.4-2.5).
-- ---------------------------------------------------------------------

ALTER TABLE interview_questions   ENABLE ROW LEVEL SECURITY;
ALTER TABLE interview_scripts     ENABLE ROW LEVEL SECURITY;
ALTER TABLE interviews            ENABLE ROW LEVEL SECURITY;
ALTER TABLE interview_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE interview_answers     ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Brothers can read interview questions" ON interview_questions;
CREATE POLICY "Brothers can read interview questions" ON interview_questions
  FOR SELECT TO authenticated USING (fn_is_brother());
DROP POLICY IF EXISTS "Admins manage interview questions" ON interview_questions;
CREATE POLICY "Admins manage interview questions" ON interview_questions
  FOR ALL TO authenticated USING (fn_is_admin()) WITH CHECK (fn_is_admin());

DROP POLICY IF EXISTS "Brothers can read interview scripts" ON interview_scripts;
CREATE POLICY "Brothers can read interview scripts" ON interview_scripts
  FOR SELECT TO authenticated USING (fn_is_brother());
DROP POLICY IF EXISTS "Admins manage interview scripts" ON interview_scripts;
CREATE POLICY "Admins manage interview scripts" ON interview_scripts
  FOR ALL TO authenticated USING (fn_is_admin()) WITH CHECK (fn_is_admin());

DROP POLICY IF EXISTS "Brothers can read interviews" ON interviews;
CREATE POLICY "Brothers can read interviews" ON interviews
  FOR SELECT TO authenticated USING (fn_is_brother());

DROP POLICY IF EXISTS "Brothers read own assignments" ON interview_assignments;
CREATE POLICY "Brothers read own assignments" ON interview_assignments
  FOR SELECT TO authenticated USING (brother_id = auth.uid());
DROP POLICY IF EXISTS "Leadership reads all assignments" ON interview_assignments;
CREATE POLICY "Leadership reads all assignments" ON interview_assignments
  FOR SELECT TO authenticated USING (fn_can_read_interviews());
-- No client-facing INSERT/UPDATE/DELETE policy: all mutation goes
-- through the SECURITY DEFINER functions above.

DROP POLICY IF EXISTS "Brothers read own answers" ON interview_answers;
CREATE POLICY "Brothers read own answers" ON interview_answers
  FOR SELECT TO authenticated USING (brother_id = auth.uid());
DROP POLICY IF EXISTS "Leadership reads all answers" ON interview_answers;
CREATE POLICY "Leadership reads all answers" ON interview_answers
  FOR SELECT TO authenticated USING (fn_can_read_interviews());

DROP POLICY IF EXISTS "Brothers write own pending answers" ON interview_answers;
CREATE POLICY "Brothers write own pending answers" ON interview_answers
  FOR INSERT TO authenticated
  WITH CHECK (
    brother_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM interview_assignments ia
      JOIN interviews iv ON iv.id = ia.interview_id
      WHERE ia.interview_id = interview_answers.interview_id
        AND ia.brother_id = interview_answers.brother_id
        AND ia.rushee_id = interview_answers.rushee_id
        AND ia.status = 'pending' AND iv.status = 'in_progress'
    )
  );
DROP POLICY IF EXISTS "Brothers update own pending answers" ON interview_answers;
CREATE POLICY "Brothers update own pending answers" ON interview_answers
  FOR UPDATE TO authenticated
  USING (brother_id = auth.uid())
  WITH CHECK (
    brother_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM interview_assignments ia
      JOIN interviews iv ON iv.id = ia.interview_id
      WHERE ia.interview_id = interview_answers.interview_id
        AND ia.brother_id = interview_answers.brother_id
        AND ia.rushee_id = interview_answers.rushee_id
        AND ia.status = 'pending' AND iv.status = 'in_progress'
    )
  );
-- No DELETE policy for anyone.

-- ---------------------------------------------------------------------
-- app_config additions
-- ---------------------------------------------------------------------

UPDATE app_config
SET settings = jsonb_set(settings, '{interviews}', '{
  "max_casual_rushees": 3,
  "stale_after_minutes": 120,
  "recommendation_scale": [
    {"value": 5, "label": "Exceptional", "description": "Rushee is a must for the frat. They possess valuable skills and experiences, as well as enthusiasm and detailed responses. They would put their all into this opportunity and contribute positively to our community and the pledge class."},
    {"value": 4, "label": "Above Average", "description": "Rushee is a solid contender for the frat. They possess valuable skills and experiences, as well as enthusiasm. They would contribute positively to our community and the pledge class. Their responses could use more detail."},
    {"value": 3, "label": "Average", "description": "Rushee is a maybe for the frat. They possess valuable skills and experiences but lack enthusiasm or thoughtful responses."},
    {"value": 2, "label": "Below Average", "description": "Rushee is not the best for the frat. They might have valuable skills or experiences but lacked enthusiasm and thoughtful responses."},
    {"value": 1, "label": "Inadequate", "description": "Would not recommend rushee for the frat."}
  ]
}'::jsonb, true)
WHERE id = true AND NOT (settings ? 'interviews');

-- =====================================================================
-- PRD alignment — configuration, audit, staging, and the derived views
-- the PRD requires so that each rule has exactly one definition.
--
-- Covers: PRD §1.4 (rules live in one place), §4.3 (stage vs publish),
-- §5.4 (R23 professional N/A vs unanswered), §6.2.2/S7 (brother invites),
-- §6.3.8 (server-side letter read state), §6.5.4 (R38 review marks),
-- §7.6 (audit log), §7.8 (derived views).
--
-- Safe to re-run.
-- =====================================================================


-- ---------------------------------------------------------------------
-- 1. app_config — a single tunable settings row
--
-- The PRD scopes settings to a recruitment cycle (§7.1). Cycles are not
-- modelled yet, so this is the one-cycle stepping stone: the same JSONB
-- shape, on a singleton row, so moving to `cycles.settings` later is a
-- rename rather than a redesign.
-- ---------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS app_config (
  id         BOOLEAN PRIMARY KEY DEFAULT true CHECK (id),
  settings   JSONB NOT NULL DEFAULT '{}'::jsonb,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_by UUID REFERENCES brothers(id)
);

INSERT INTO app_config (id, settings)
VALUES (true, '{
  "eligibility":  { "min_casual": 1, "min_professional": 1, "min_total": 3 },
  "evaluation":   { "target_per_brother": 15,
                    "comment_char_limit": 1000,
                    "qualities": ["Drive","Passion","Professionalism",
                                  "Genuine","Responsible","Culture Fit"] },
  "checkin":      { "countdown_seconds": 3, "token_ttl_minutes": 5,
                    "default_groups": 5 },
  "application":  { "autosave_debounce_ms": 2000, "resume_max_mb": 10,
                    "gpa_ceiling": 4.50, "essay_char_limit": 500 },
  "voting":       { "threshold_fraction": 0.25, "quorum_fraction": 0.60,
                    "discussion_seconds": 120, "voting_seconds": 60,
                    "extension_seconds": 60, "max_extensions": 1,
                    "admins_see_ballots": false },
  "invites":      { "ttl_days": 14 },
  "security":     { "min_password_length": 10 }
}'::jsonb)
ON CONFLICT (id) DO NOTHING;

ALTER TABLE app_config ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can read config"   ON app_config;
DROP POLICY IF EXISTS "Admins can write config"  ON app_config;

-- Readable by everyone: the landing page FAQ has to advertise the same
-- minimums the application gate enforces (PRD R2).
CREATE POLICY "Anyone can read config" ON app_config
  FOR SELECT USING (true);

CREATE POLICY "Admins can write config" ON app_config
  FOR ALL TO authenticated
  USING (fn_is_admin()) WITH CHECK (fn_is_admin());


-- ---------------------------------------------------------------------
-- 2. audit_log — append-only record of privileged mutations (PRD §7.6, S8)
-- ---------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS audit_log (
  id          BIGSERIAL PRIMARY KEY,
  actor_id    UUID,
  action      TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id   UUID,
  before      JSONB,
  after       JSONB,
  metadata    JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_audit_log_created  ON audit_log (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_log_entity   ON audit_log (entity_type, entity_id);

ALTER TABLE audit_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Leadership can read audit log" ON audit_log;
DROP POLICY IF EXISTS "Authenticated can append audit log" ON audit_log;

CREATE POLICY "Leadership can read audit log" ON audit_log
  FOR SELECT TO authenticated USING (fn_is_leadership());

-- Insert-only: no UPDATE or DELETE policy exists for any role, so the
-- log is append-only by construction (PRD §7.6).
CREATE POLICY "Authenticated can append audit log" ON audit_log
  FOR INSERT TO authenticated WITH CHECK (actor_id = auth.uid());


-- ---------------------------------------------------------------------
-- 3. rushee_standing_staging — decide and publish are separate actions
--    (PRD §4.3, §6.7.4, S11)
--
-- Staged decisions live in their own admin-only table rather than a
-- column on `rushees`, because RLS is row-level: a column on `rushees`
-- would be readable by the rushee through their own-row SELECT policy,
-- which is precisely what S11 forbids.
-- ---------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS rushee_standing_staging (
  rushee_id       UUID PRIMARY KEY REFERENCES rushees(id) ON DELETE CASCADE,
  staged_standing TEXT NOT NULL,
  staged_by       UUID REFERENCES brothers(id),
  staged_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE rushee_standing_staging ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins manage staged standings" ON rushee_standing_staging;
CREATE POLICY "Admins manage staged standings" ON rushee_standing_staging
  FOR ALL TO authenticated
  USING (fn_is_admin()) WITH CHECK (fn_is_admin());


-- ---------------------------------------------------------------------
-- 4. review_marks — reviewer marks belong server-side (PRD R38, §6.5.4)
--
-- These were previously kept in localStorage, which made the consensus
-- view impossible: no reviewer could see any other reviewer's marks.
-- ---------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS review_marks (
  reviewer_id UUID NOT NULL REFERENCES brothers(id) ON DELETE CASCADE,
  rushee_id   UUID NOT NULL REFERENCES rushees(id)  ON DELETE CASCADE,
  mark        TEXT NOT NULL DEFAULT 'undecided'
              CHECK (mark IN ('undecided', 'strong_yes', 'maybe', 'no')),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (reviewer_id, rushee_id)
);

ALTER TABLE review_marks ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Reviewers manage their own marks" ON review_marks;
DROP POLICY IF EXISTS "Leadership can read all marks"    ON review_marks;

CREATE POLICY "Reviewers manage their own marks" ON review_marks
  FOR ALL TO authenticated
  USING (reviewer_id = auth.uid() AND fn_is_leadership())
  WITH CHECK (reviewer_id = auth.uid() AND fn_is_leadership());

CREATE POLICY "Leadership can read all marks" ON review_marks
  FOR SELECT TO authenticated USING (fn_is_leadership());


-- ---------------------------------------------------------------------
-- 5. letter_reads — envelope read state, per user, server-side
--    (PRD §6.3.8: "correct on any device and never leaks between
--     accounts sharing a browser")
-- ---------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS letter_reads (
  rushee_id  UUID NOT NULL REFERENCES rushees(id) ON DELETE CASCADE,
  letter_key TEXT NOT NULL,
  read_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (rushee_id, letter_key)
);

ALTER TABLE letter_reads ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Rushees manage their own letter reads" ON letter_reads;
CREATE POLICY "Rushees manage their own letter reads" ON letter_reads
  FOR ALL TO authenticated
  USING (rushee_id = auth.uid()) WITH CHECK (rushee_id = auth.uid());


-- ---------------------------------------------------------------------
-- 6. brother_invites — provisioned, not self-served (PRD §6.2.2, S7, R51)
--
-- Replaces the shared "RUSH26" access code that shipped in the client
-- bundle. Only the SHA-256 hash of the token is stored, never the token.
-- ---------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS brother_invites (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  token_hash  TEXT UNIQUE NOT NULL,
  email       TEXT NOT NULL,
  full_name   TEXT NOT NULL,
  issued_by   UUID REFERENCES brothers(id),
  expires_at  TIMESTAMPTZ NOT NULL,
  accepted_at TIMESTAMPTZ,
  accepted_by UUID REFERENCES brothers(id),
  revoked_at  TIMESTAMPTZ,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_brother_invites_email ON brother_invites (lower(email));

ALTER TABLE brother_invites ENABLE ROW LEVEL SECURITY;

-- No anon or authenticated policy at all: invites are only ever touched
-- by server handlers using the service role, after they have verified
-- the caller. Acceptance happens through /api/invites/accept.
DROP POLICY IF EXISTS "Admins manage invites" ON brother_invites;
CREATE POLICY "Admins manage invites" ON brother_invites
  FOR ALL TO authenticated
  USING (fn_is_admin()) WITH CHECK (fn_is_admin());


-- ---------------------------------------------------------------------
-- 7. evaluations — "not yet rated" and "deliberately N/A" stored
--    distinctly (PRD R23, §7.4)
--
-- Previously professional_score was NOT NULL and 0 doubled as N/A, so
-- an evaluation nobody had touched was indistinguishable from one where
-- a brother explicitly declined to rate. The evaluation form defaulted
-- to 0, which meant most evaluations silently claimed "N/A".
-- ---------------------------------------------------------------------

ALTER TABLE evaluations ADD COLUMN IF NOT EXISTS professional_na BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE evaluations ALTER COLUMN professional_score DROP NOT NULL;

-- Existing 0s carried the "N/A" meaning under the old scheme; migrate
-- them to the explicit flag.
UPDATE evaluations
SET professional_na = true, professional_score = NULL
WHERE professional_score = 0;

ALTER TABLE evaluations DROP CONSTRAINT IF EXISTS evaluations_professional_score_check;
ALTER TABLE evaluations ADD CONSTRAINT evaluations_professional_score_check
  CHECK (professional_score IS NULL OR (professional_score >= 1 AND professional_score <= 5));

ALTER TABLE evaluations DROP CONSTRAINT IF EXISTS evaluations_professional_na_check;
ALTER TABLE evaluations ADD CONSTRAINT evaluations_professional_na_check
  CHECK (NOT (professional_na AND professional_score IS NOT NULL));

-- PRD R29: comments capped at 1,000 characters. NOT VALID so any
-- historical row over the cap is left alone; new writes are checked.
ALTER TABLE evaluations DROP CONSTRAINT IF EXISTS evaluations_comments_length_check;
ALTER TABLE evaluations ADD CONSTRAINT evaluations_comments_length_check
  CHECK (comments IS NULL OR char_length(comments) <= 1000) NOT VALID;

COMMENT ON COLUMN evaluations.event_id IS
  'Originating event. PRD §4.4: set once on creation, never overwritten, so per-event attribution survives later revisions.';


-- ---------------------------------------------------------------------
-- 8. Derived views — one definition per rule (PRD §7.8)
--
-- security_invoker so the caller''s RLS still applies; these are a
-- single source of truth, not a way around permissions.
-- ---------------------------------------------------------------------

CREATE OR REPLACE VIEW v_rushee_attendance_counts
WITH (security_invoker = true) AS
SELECT
  r.id AS rushee_id,
  COUNT(*) FILTER (WHERE e.type = 'Casual'       AND a.status = 'approved') AS casual_approved,
  COUNT(*) FILTER (WHERE e.type = 'Professional' AND a.status = 'approved') AS professional_approved,
  COUNT(*) FILTER (WHERE a.status = 'approved')                             AS total_approved
FROM rushees r
LEFT JOIN event_attendance a ON a.rushee_id = r.id
LEFT JOIN events e           ON e.id = a.event_id
GROUP BY r.id;

-- PRD R2: the single eligibility formula. The landing-page FAQ, the
-- progress rings, the application gate and standing auto-derivation all
-- read this, so the advertised rule and the enforced rule cannot diverge.
CREATE OR REPLACE FUNCTION fn_minimums_met(target_rushee UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  cfg          JSONB;
  min_casual   INT;
  min_pro      INT;
  min_total    INT;
  counts       RECORD;
BEGIN
  SELECT settings -> 'eligibility' INTO cfg FROM app_config WHERE id;
  min_casual := COALESCE((cfg ->> 'min_casual')::INT, 1);
  min_pro    := COALESCE((cfg ->> 'min_professional')::INT, 1);
  min_total  := COALESCE((cfg ->> 'min_total')::INT, 3);

  SELECT
    COUNT(*) FILTER (WHERE e.type = 'Casual'       AND a.status = 'approved') AS casual,
    COUNT(*) FILTER (WHERE e.type = 'Professional' AND a.status = 'approved') AS pro,
    COUNT(*) FILTER (WHERE a.status = 'approved')                             AS total
  INTO counts
  FROM event_attendance a
  JOIN events e ON e.id = a.event_id
  WHERE a.rushee_id = target_rushee;

  RETURN counts.casual >= min_casual
     AND counts.pro    >= min_pro
     AND counts.total  >= min_total;
END;
$$;

GRANT EXECUTE ON FUNCTION fn_minimums_met(UUID) TO authenticated;

-- PRD R36: average professional / personal / overall, each with the
-- evidence count behind it. N/A evaluations are excluded from the
-- professional average but still count as evaluations.
CREATE OR REPLACE VIEW v_rushee_scores
WITH (security_invoker = true) AS
SELECT
  r.id AS rushee_id,
  AVG(ev.professional_score) FILTER (WHERE ev.professional_score IS NOT NULL) AS avg_professional,
  COUNT(ev.professional_score) FILTER (WHERE ev.professional_score IS NOT NULL) AS professional_count,
  AVG(ev.personal_score)     FILTER (WHERE ev.personal_score IS NOT NULL)     AS avg_personal,
  COUNT(ev.personal_score)   FILTER (WHERE ev.personal_score IS NOT NULL)     AS personal_count,
  COUNT(ev.id)                                                                AS evaluation_count,
  CASE
    WHEN COUNT(ev.professional_score) FILTER (WHERE ev.professional_score IS NOT NULL) > 0
     AND COUNT(ev.personal_score)     FILTER (WHERE ev.personal_score IS NOT NULL)     > 0
      THEN (AVG(ev.professional_score) FILTER (WHERE ev.professional_score IS NOT NULL)
          + AVG(ev.personal_score)     FILTER (WHERE ev.personal_score IS NOT NULL)) / 2
    WHEN COUNT(ev.personal_score) FILTER (WHERE ev.personal_score IS NOT NULL) > 0
      THEN AVG(ev.personal_score) FILTER (WHERE ev.personal_score IS NOT NULL)
    WHEN COUNT(ev.professional_score) FILTER (WHERE ev.professional_score IS NOT NULL) > 0
      THEN AVG(ev.professional_score) FILTER (WHERE ev.professional_score IS NOT NULL)
    ELSE NULL
  END AS overall
FROM rushees r
LEFT JOIN evaluations ev ON ev.rushee_id = r.id
GROUP BY r.id;

-- PRD R34: interaction count is the number of DISTINCT brothers who
-- interacted with a rushee, across all events.
CREATE OR REPLACE VIEW v_rushee_interactions
WITH (security_invoker = true) AS
SELECT
  r.id AS rushee_id,
  COUNT(DISTINCT i.brother_id) AS interaction_count
FROM rushees r
LEFT JOIN brother_rushee_interactions i ON i.rushee_id = r.id
GROUP BY r.id;

-- PRD §7.8: the one row the review board, standings table, deck and
-- admin dashboard all read, so there is exactly one definition of a
-- rushee's numbers.
CREATE OR REPLACE VIEW v_rushee_board
WITH (security_invoker = true) AS
SELECT
  r.id,
  r.name,
  r.email,
  r.major,
  r.year,
  r.photo,
  r.gpa,
  r.standing,
  r.standing_published_at,
  ac.casual_approved,
  ac.professional_approved,
  ac.total_approved,
  sc.avg_professional,
  sc.professional_count,
  sc.avg_personal,
  sc.personal_count,
  sc.overall,
  sc.evaluation_count,
  ic.interaction_count,
  r.professional_interview_score,
  r.professional_option_score,
  r.casual_interview_score
FROM rushees r
LEFT JOIN v_rushee_attendance_counts ac ON ac.rushee_id = r.id
LEFT JOIN v_rushee_scores            sc ON sc.rushee_id = r.id
LEFT JOIN v_rushee_interactions      ic ON ic.rushee_id = r.id;

-- PRD §6.7.7 / R32: per-brother participation against the target.
CREATE OR REPLACE VIEW v_brother_participation
WITH (security_invoker = true) AS
SELECT
  b.id AS brother_id,
  b.name,
  b.email,
  (SELECT COUNT(*) FROM brother_event_attendance bea WHERE bea.brother_id = b.id)               AS events_attended,
  (SELECT COUNT(DISTINCT ev.rushee_id) FROM evaluations ev WHERE ev.brother_id = b.id)          AS rushees_evaluated,
  (SELECT COUNT(*) FROM brother_rushee_interactions i WHERE i.brother_id = b.id)                AS interactions_logged,
  (SELECT MAX(ev.updated_at) FROM evaluations ev WHERE ev.brother_id = b.id)                    AS last_activity
FROM brothers b;

GRANT SELECT ON v_rushee_attendance_counts, v_rushee_scores, v_rushee_interactions,
                v_rushee_board, v_brother_participation TO authenticated;

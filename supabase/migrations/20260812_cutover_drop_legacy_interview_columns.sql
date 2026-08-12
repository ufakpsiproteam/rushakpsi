-- Cutover: remove COALESCE transition shims and drop the 5 legacy
-- interview columns from rushees. Safe to run only after interview mode
-- is live and in use (see build order in the plan).
--
-- Order matters: recreate the view BEFORE dropping columns so
-- Postgres never sees a view that references dropped columns.

-- Step 1: replace v_rushee_board — direct vi.* references, no COALESCE.
-- Column names, order, and types are preserved exactly so existing
-- queries don't break. professional_option_score has no equivalent in
-- the new schema; kept as NULL to avoid shifting column positions.
CREATE OR REPLACE VIEW v_rushee_board
WITH (security_invoker = true) AS
SELECT
  r.id, r.name, r.email, r.major, r.year, r.photo, r.gpa,
  r.invite_only, r.bid_status, r.invite_only_published_at, r.bid_status_published_at,
  ac.casual_approved, ac.professional_approved, ac.total_approved,
  sc.avg_professional, sc.professional_count, sc.avg_personal, sc.personal_count,
  sc.overall, sc.evaluation_count, ic.interaction_count,
  vi.professional_score::NUMERIC(4,1)          AS professional_interview_score,
  CAST(NULL AS NUMERIC(2,1))                   AS professional_option_score,
  vi.casual_score::NUMERIC(3,1)                AS casual_interview_score,
  vi.casual_n::BIGINT                          AS casual_interview_n,
  vi.casual_recommendation,
  vi.professional_n::BIGINT                    AS professional_interview_n,
  vi.professional_recommendation,
  vi.invite_only_available
FROM rushees r
LEFT JOIN v_rushee_attendance_counts ac ON ac.rushee_id = r.id
LEFT JOIN v_rushee_scores            sc ON sc.rushee_id = r.id
LEFT JOIN v_rushee_interactions      ic ON ic.rushee_id = r.id
LEFT JOIN v_rushee_interviews        vi ON vi.rushee_id = r.id;

GRANT SELECT ON v_rushee_board TO authenticated;

-- Step 2: drop the 5 legacy rushees interview columns.
-- The view above no longer references them, so this is safe.
ALTER TABLE rushees
  DROP COLUMN IF EXISTS professional_interview_score,
  DROP COLUMN IF EXISTS professional_interview_comment,
  DROP COLUMN IF EXISTS professional_option_score,
  DROP COLUMN IF EXISTS casual_interview_score,
  DROP COLUMN IF EXISTS casual_interview_comment;

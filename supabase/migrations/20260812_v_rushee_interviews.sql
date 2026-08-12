-- v_rushee_interviews — per rushee, per type: average total score, n
-- (evidence count, submitted assignments only), average recommendation.
-- Only `submitted` assignments count; `pending`/`removed` contribute
-- nothing (mirrors R3/R36's evidence-count convention already used by
-- v_rushee_scores). Total = SUM(score) over that assignment's answers.
--
-- security_invoker = true so the caller's own RLS still applies —
-- same convention as v_rushee_scores/v_rushee_board
-- (20260811_prd_alignment.sql).

CREATE OR REPLACE VIEW v_rushee_interviews
WITH (security_invoker = true) AS
WITH totals AS (
  SELECT
    ia.interview_id, ia.brother_id, ia.rushee_id, iv.type,
    ia.status, ia.submitted_at, ia.recommendation,
    SUM(a.score) FILTER (WHERE a.score IS NOT NULL) AS total_score
  FROM interview_assignments ia
  JOIN interviews iv ON iv.id = ia.interview_id
  LEFT JOIN interview_answers a
    ON a.interview_id = ia.interview_id AND a.brother_id = ia.brother_id AND a.rushee_id = ia.rushee_id
  GROUP BY ia.interview_id, ia.brother_id, ia.rushee_id, iv.type, ia.status, ia.submitted_at, ia.recommendation
),
invite_availability AS (
  SELECT DISTINCT ON (t.rushee_id)
    t.rushee_id, a.yes_no AS invite_only_available
  FROM totals t
  JOIN interview_questions q ON q.type = 'casual' AND q.field_type = 'yes_no' AND q.is_active
  JOIN interview_answers a
    ON a.interview_id = t.interview_id AND a.brother_id = t.brother_id
   AND a.rushee_id = t.rushee_id AND a.question_id = q.id
  WHERE t.type = 'casual' AND t.status = 'submitted'
  ORDER BY t.rushee_id, t.submitted_at DESC
)
SELECT
  r.id AS rushee_id,
  AVG(t.total_score)    FILTER (WHERE t.type = 'casual'       AND t.status = 'submitted') AS casual_score,
  COUNT(*)               FILTER (WHERE t.type = 'casual'       AND t.status = 'submitted') AS casual_n,
  AVG(t.recommendation) FILTER (WHERE t.type = 'casual'       AND t.status = 'submitted') AS casual_recommendation,
  AVG(t.total_score)    FILTER (WHERE t.type = 'professional' AND t.status = 'submitted') AS professional_score,
  COUNT(*)               FILTER (WHERE t.type = 'professional' AND t.status = 'submitted') AS professional_n,
  AVG(t.recommendation) FILTER (WHERE t.type = 'professional' AND t.status = 'submitted') AS professional_recommendation,
  ia2.invite_only_available
FROM rushees r
LEFT JOIN totals t ON t.rushee_id = r.id
LEFT JOIN invite_availability ia2 ON ia2.rushee_id = r.id
GROUP BY r.id, ia2.invite_only_available;

GRANT SELECT ON v_rushee_interviews TO authenticated;

-- Repoint v_rushee_board. Legacy data must not vanish during the
-- transition: the manual-entry page (app/admin/interviews) stays live
-- until interview mode ships (see build order in the plan), so
-- existing hand-typed rushees.professional_interview_score etc. are
-- real data, not placeholder. COALESCE the new view against the
-- legacy columns; new-table data wins once it exists. Remove this
-- COALESCE and the legacy columns together in the final cutover
-- migration, once interview mode is live and in use.
-- CREATE OR REPLACE VIEW requires existing column names to stay in
-- their original ordinal position (Postgres 42P16) — the first 24
-- columns below preserve the exact order/names of the view being
-- replaced; every interview-related addition is appended after.
CREATE OR REPLACE VIEW v_rushee_board
WITH (security_invoker = true) AS
SELECT
  r.id, r.name, r.email, r.major, r.year, r.photo, r.gpa,
  r.invite_only, r.bid_status, r.invite_only_published_at, r.bid_status_published_at,
  ac.casual_approved, ac.professional_approved, ac.total_approved,
  sc.avg_professional, sc.professional_count, sc.avg_personal, sc.personal_count,
  sc.overall, sc.evaluation_count, ic.interaction_count,
  COALESCE(vi.professional_score, r.professional_interview_score)::NUMERIC(4,1) AS professional_interview_score,
  r.professional_option_score,
  COALESCE(vi.casual_score, r.casual_interview_score)::NUMERIC(3,1) AS casual_interview_score,
  COALESCE(vi.casual_n, CASE WHEN r.casual_interview_score IS NOT NULL THEN 1 END) AS casual_interview_n,
  vi.casual_recommendation,
  COALESCE(vi.professional_n, CASE WHEN r.professional_interview_score IS NOT NULL THEN 1 END) AS professional_interview_n,
  vi.professional_recommendation,
  vi.invite_only_available
FROM rushees r
LEFT JOIN v_rushee_attendance_counts ac ON ac.rushee_id = r.id
LEFT JOIN v_rushee_scores            sc ON sc.rushee_id = r.id
LEFT JOIN v_rushee_interactions      ic ON ic.rushee_id = r.id
LEFT JOIN v_rushee_interviews        vi ON vi.rushee_id = r.id;

GRANT SELECT ON v_rushee_board TO authenticated;

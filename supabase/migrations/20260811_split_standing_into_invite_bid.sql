-- =====================================================================
-- Split rushees.standing into two independent, admin-published
-- decisions: invite_only and bid_status.
--
-- The old single text column conflated two different things: a live,
-- never-really-stored "has this rushee met event minimums yet" progress
-- indicator, and two sequential admin decisions ("Invite Only (Y/N)",
-- "Bid (Y/N)"). The progress indicator was always re-derivable from
-- attendance (see fn_minimums_met / lib/policy.ts evaluateEligibility)
-- so it is not stored at all going forward — only the two real
-- decisions are columns.
--
-- invite_only / bid_status are nullable booleans: NULL = not yet
-- decided, true = Yes, false = No. This preserves the three-way
-- distinction the old text values encoded (a rushee who hasn't been
-- decided on yet must not look identical to one who was rejected).
--
-- Safe to re-run.
-- =====================================================================


-- ---------------------------------------------------------------------
-- 1. New columns on rushees
-- ---------------------------------------------------------------------

ALTER TABLE rushees
  ADD COLUMN IF NOT EXISTS invite_only BOOLEAN,
  ADD COLUMN IF NOT EXISTS bid_status BOOLEAN,
  ADD COLUMN IF NOT EXISTS invite_only_published_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS invite_only_published_by UUID REFERENCES brothers(id),
  ADD COLUMN IF NOT EXISTS bid_status_published_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS bid_status_published_by UUID REFERENCES brothers(id);


-- ---------------------------------------------------------------------
-- 2. Backfill from the legacy `standing` column, if this database ever
--    had one. No migration in this repo's history actually creates
--    `standing` — the codebase referenced a column that isn't
--    reproducible from a clean migration replay — so this step is
--    guarded and does nothing on a fresh database.
-- ---------------------------------------------------------------------

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'rushees' AND column_name = 'standing'
  ) THEN
    UPDATE rushees SET
      invite_only = CASE standing
        WHEN 'Invite Only (Y)' THEN true
        WHEN 'Invite Only (N)' THEN false
        WHEN 'Bid (Y)'         THEN true
        WHEN 'Bid (N)'         THEN true  -- got the invite; the bid itself is what was declined
        ELSE NULL
      END,
      bid_status = CASE standing
        WHEN 'Bid (Y)' THEN true
        WHEN 'Bid (N)' THEN false
        ELSE NULL
      END,
      invite_only_published_at = standing_published_at,
      invite_only_published_by = standing_published_by,
      bid_status_published_at = CASE WHEN standing IN ('Bid (Y)', 'Bid (N)') THEN standing_published_at ELSE NULL END,
      bid_status_published_by = CASE WHEN standing IN ('Bid (Y)', 'Bid (N)') THEN standing_published_by ELSE NULL END
    WHERE standing IS NOT NULL;
  END IF;
END $$;


-- ---------------------------------------------------------------------
-- 3. rushee_standing_staging — restructured for two independent staged
--    decisions instead of one staged text value, so an admin can stage
--    and publish Invite Only and Bid separately (they happen weeks
--    apart in the real recruitment calendar).
-- ---------------------------------------------------------------------

ALTER TABLE rushee_standing_staging
  ADD COLUMN IF NOT EXISTS staged_invite_only BOOLEAN,
  ADD COLUMN IF NOT EXISTS staged_invite_only_by UUID REFERENCES brothers(id),
  ADD COLUMN IF NOT EXISTS staged_invite_only_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS staged_bid_status BOOLEAN,
  ADD COLUMN IF NOT EXISTS staged_bid_status_by UUID REFERENCES brothers(id),
  ADD COLUMN IF NOT EXISTS staged_bid_status_at TIMESTAMPTZ;

ALTER TABLE rushee_standing_staging ALTER COLUMN staged_standing DROP NOT NULL;


-- ---------------------------------------------------------------------
-- 4. fn_guard_rushee_privileged_columns — rewritten for the two new
--    columns. Non-admins remain fully blocked from touching them (as
--    before). New for this migration, per explicit product decision:
--    admins are now blocked too once a decision is terminal —
--    bid_status can only be set after invite_only has published Yes,
--    and a published No (at either stage) can never be changed again.
--    A support fix, if ever needed, goes through the service role,
--    which bypasses this trigger entirely (auth.uid() IS NULL).
-- ---------------------------------------------------------------------

CREATE OR REPLACE FUNCTION fn_guard_rushee_privileged_columns()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  touched BOOLEAN;
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN NEW;
  END IF;

  touched := (
    NEW.invite_only IS DISTINCT FROM OLD.invite_only
    OR NEW.bid_status IS DISTINCT FROM OLD.bid_status
    OR NEW.invite_only_published_at IS DISTINCT FROM OLD.invite_only_published_at
    OR NEW.invite_only_published_by IS DISTINCT FROM OLD.invite_only_published_by
    OR NEW.bid_status_published_at IS DISTINCT FROM OLD.bid_status_published_at
    OR NEW.bid_status_published_by IS DISTINCT FROM OLD.bid_status_published_by
  );

  IF NOT touched THEN
    RETURN NEW;
  END IF;

  IF NOT fn_is_admin() THEN
    RAISE EXCEPTION 'Only an admin may change a rushee''s invite/bid decision or publication state';
  END IF;

  IF OLD.invite_only IS FALSE THEN
    RAISE EXCEPTION 'This rushee was not invited; the decision is final and cannot be changed';
  END IF;

  IF OLD.bid_status IS FALSE AND NEW.bid_status IS DISTINCT FROM OLD.bid_status THEN
    RAISE EXCEPTION 'This rushee''s bid decision is final and cannot be changed';
  END IF;

  IF NEW.bid_status IS NOT NULL AND NEW.invite_only IS NOT TRUE THEN
    RAISE EXCEPTION 'Cannot set a bid decision before Invite Only has been published as Yes';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_guard_rushee_privileged_columns ON rushees;
CREATE TRIGGER trg_guard_rushee_privileged_columns
  BEFORE UPDATE ON rushees
  FOR EACH ROW
  EXECUTE FUNCTION fn_guard_rushee_privileged_columns();


-- ---------------------------------------------------------------------
-- 5. v_rushee_board — drop the standing columns, expose the new ones.
--    Recreated before the old columns are dropped so nothing depends
--    on them at drop time.
-- ---------------------------------------------------------------------

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
  r.invite_only,
  r.bid_status,
  r.invite_only_published_at,
  r.bid_status_published_at,
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


-- ---------------------------------------------------------------------
-- 6. Drop the old columns, now that nothing references them.
-- ---------------------------------------------------------------------

ALTER TABLE rushees DROP COLUMN IF EXISTS standing;
ALTER TABLE rushees DROP COLUMN IF EXISTS standing_published_at;
ALTER TABLE rushees DROP COLUMN IF EXISTS standing_published_by;

ALTER TABLE rushee_standing_staging DROP COLUMN IF EXISTS staged_standing;
ALTER TABLE rushee_standing_staging DROP COLUMN IF EXISTS staged_by;
ALTER TABLE rushee_standing_staging DROP COLUMN IF EXISTS staged_at;

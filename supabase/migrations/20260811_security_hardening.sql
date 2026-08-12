-- =====================================================================
-- Security hardening — brings RLS and storage in line with PRD §3.3
-- (S1, S3, S5, S6, S11) and §7.9.
--
-- Context: several earlier migrations left permissive policies in place
-- because their DROP statements referenced policy names that were never
-- created. Postgres OR's row-level policies together, so those leftovers
-- silently widened access. This migration drops them by their real names
-- and replaces them with scoped equivalents.
--
-- Safe to re-run.
-- =====================================================================


-- ---------------------------------------------------------------------
-- 0. Shared authorization helpers
--
-- SECURITY DEFINER so policies can call them without the caller needing
-- SELECT on `brothers`, and so we have exactly one definition of
-- "is an admin" rather than an EXISTS subquery copy-pasted into every
-- policy (PRD §1.4, principle 1).
-- ---------------------------------------------------------------------

CREATE OR REPLACE FUNCTION fn_is_brother()
RETURNS BOOLEAN
LANGUAGE SQL
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT EXISTS (SELECT 1 FROM brothers WHERE brothers.id = auth.uid());
$$;

CREATE OR REPLACE FUNCTION fn_is_admin()
RETURNS BOOLEAN
LANGUAGE SQL
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM brothers
    WHERE brothers.id = auth.uid()
      AND brothers.access_level = 'admin'
  );
$$;

-- "Leadership" = anyone permitted to read the review board:
-- admin, professional team/chair (access_level 'pro'), recruitment
-- directors (access_level 'recruitment'), plus anyone holding an
-- additive role in brother_roles.
CREATE OR REPLACE FUNCTION fn_is_leadership()
RETURNS BOOLEAN
LANGUAGE SQL
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM brothers
    WHERE brothers.id = auth.uid()
      AND brothers.access_level IN ('admin', 'pro', 'recruitment')
  ) OR EXISTS (
    SELECT 1 FROM brother_roles WHERE brother_roles.brother_id = auth.uid()
  );
$$;

CREATE OR REPLACE FUNCTION fn_has_role(target_role brother_role)
RETURNS BOOLEAN
LANGUAGE SQL
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT fn_is_admin() OR EXISTS (
    SELECT 1 FROM brother_roles
    WHERE brother_roles.brother_id = auth.uid()
      AND brother_roles.role = target_role
  );
$$;

GRANT EXECUTE ON FUNCTION fn_is_brother()   TO authenticated, anon;
GRANT EXECUTE ON FUNCTION fn_is_admin()     TO authenticated, anon;
GRANT EXECUTE ON FUNCTION fn_is_leadership() TO authenticated, anon;
GRANT EXECUTE ON FUNCTION fn_has_role(brother_role) TO authenticated, anon;


-- ---------------------------------------------------------------------
-- 1. brother_role enum — add professional_chair (PRD §3.1)
--
-- The enum shipped with only recruitment_director and professional_team,
-- so there was no way to grant the Professional Chair role the PRD's
-- permission matrix depends on.
-- ---------------------------------------------------------------------

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_enum e
    JOIN pg_type t ON t.oid = e.enumtypid
    WHERE t.typname = 'brother_role' AND e.enumlabel = 'professional_chair'
  ) THEN
    ALTER TYPE brother_role ADD VALUE 'professional_chair';
  END IF;
END$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_enum e
    JOIN pg_type t ON t.oid = e.enumtypid
    WHERE t.typname = 'brother_role' AND e.enumlabel = 'admin'
  ) THEN
    ALTER TYPE brother_role ADD VALUE 'admin';
  END IF;
END$$;


-- ---------------------------------------------------------------------
-- 2. events — stop exposing every event to the public internet
--
-- Previously TWO policies each granted unconditional read:
--   "Anyone can view events"        USING (true)
--   "Brothers can view all events"  USING (EXISTS(...) OR TRUE)
-- so locked, unlisted, internal events were world-readable.
-- PRD §6.1.1: the public read policy is restricted to publicly-listed
-- events; nothing else is readable unauthenticated.
-- ---------------------------------------------------------------------

ALTER TABLE events ADD COLUMN IF NOT EXISTS is_public BOOLEAN NOT NULL DEFAULT true;

DROP POLICY IF EXISTS "Anyone can view events"            ON events;
DROP POLICY IF EXISTS "Everyone can view events"          ON events;
DROP POLICY IF EXISTS "Authenticated users can view events" ON events;
DROP POLICY IF EXISTS "Brothers can view all events"      ON events;
DROP POLICY IF EXISTS "Public can view listed events"     ON events;
DROP POLICY IF EXISTS "Authenticated can view events"     ON events;

-- Landing page (unauthenticated): publicly-listed events only.
CREATE POLICY "Public can view listed events" ON events
  FOR SELECT TO anon
  USING (is_public = true);

-- Signed-in rushees and brothers see the full calendar.
CREATE POLICY "Authenticated can view events" ON events
  FOR SELECT TO authenticated
  USING (true);


-- ---------------------------------------------------------------------
-- 3. event_attendance — remove the "any authenticated user" read
--
-- 20260109_fix_all_select_policies.sql created:
--   "Brothers can view rushee attendance" USING (auth.role() = 'authenticated')
-- and 20260127 tried to replace it but dropped a policy name that never
-- existed, so it stayed live. Effect: any signed-in rushee could read
-- every other rushee's attendance rows, photo paths and rejection
-- reasons.
-- ---------------------------------------------------------------------

DROP POLICY IF EXISTS "Brothers can view rushee attendance" ON event_attendance;
DROP POLICY IF EXISTS "Brothers with access can view all attendance" ON event_attendance;
DROP POLICY IF EXISTS "Anyone can view attendance" ON event_attendance;
DROP POLICY IF EXISTS "Brothers can view all attendance" ON event_attendance;

CREATE POLICY "Brothers can view all attendance" ON event_attendance
  FOR SELECT TO authenticated
  USING (fn_is_brother() OR auth.uid() = rushee_id);

ALTER TABLE event_attendance ADD COLUMN IF NOT EXISTS reject_reason TEXT;


-- ---------------------------------------------------------------------
-- 4. rushees — close the privilege-escalation hole on standing
--
-- 20260121 correctly restricted UPDATE to admins. 20260130 then added a
-- SECOND, uncolumn-scoped UPDATE policy for interview scores allowing
-- access_level IN ('admin','pro'). Because Postgres OR's row-level
-- policies, that re-opened full-row UPDATE — including `standing` — to
-- every Professional Team member, who the PRD permission matrix (§3.2)
-- explicitly denies both "stage standing changes" and "publish
-- decisions".
--
-- Rather than fight overlapping row policies (PRD S6 warns against
-- exactly this), we keep the policy and add a column guard trigger:
-- only admins may alter the decision-bearing columns.
-- ---------------------------------------------------------------------

ALTER TABLE rushees ADD COLUMN IF NOT EXISTS standing_published_at TIMESTAMPTZ;
ALTER TABLE rushees ADD COLUMN IF NOT EXISTS standing_published_by UUID REFERENCES brothers(id);

CREATE OR REPLACE FUNCTION fn_guard_rushee_privileged_columns()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- The service role bypasses RLS entirely and is used only by verified
  -- server handlers, so let it through.
  IF auth.uid() IS NULL THEN
    RETURN NEW;
  END IF;

  IF fn_is_admin() THEN
    RETURN NEW;
  END IF;

  IF NEW.standing IS DISTINCT FROM OLD.standing
     OR NEW.standing_published_at IS DISTINCT FROM OLD.standing_published_at
     OR NEW.standing_published_by IS DISTINCT FROM OLD.standing_published_by THEN
    RAISE EXCEPTION
      'Only an admin may change a rushee''s standing or publication state';
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
-- 5. Storage — every bucket private, no public read policies (PRD S5, §7.9)
--
-- 20260127_fix_resumes_bucket.sql flipped `resumes` to public and added
-- a `TO public` SELECT policy, so anyone who obtained or guessed a path
-- could download a resume (full legal name, phone, address, GPA).
-- ---------------------------------------------------------------------

UPDATE storage.buckets SET public = false WHERE id IN ('resumes', 'attendance-photos', 'profile-pictures', 'profile-photos');

INSERT INTO storage.buckets (id, name, public)
VALUES ('resumes', 'resumes', false)
ON CONFLICT (id) DO UPDATE SET public = false;

INSERT INTO storage.buckets (id, name, public)
VALUES ('attendance-photos', 'attendance-photos', false)
ON CONFLICT (id) DO UPDATE SET public = false;

INSERT INTO storage.buckets (id, name, public)
VALUES ('profile-pictures', 'profile-pictures', false)
ON CONFLICT (id) DO UPDATE SET public = false;

DROP POLICY IF EXISTS "Public can view resumes"            ON storage.objects;
DROP POLICY IF EXISTS "Public can view attendance photos"  ON storage.objects;
DROP POLICY IF EXISTS "Public can view profile pictures"   ON storage.objects;
DROP POLICY IF EXISTS "Anyone can view attendance photos"  ON storage.objects;

-- Check-in selfies: the rushee who took it, and brothers (who need them
-- for the "Reveal Attendance" step of the evaluation flow, PRD §6.4.4).
DROP POLICY IF EXISTS "Attendance photos readable by owner and brothers" ON storage.objects;
CREATE POLICY "Attendance photos readable by owner and brothers"
ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'attendance-photos'
  AND (fn_is_brother() OR auth.uid()::text = (storage.foldername(name))[1])
);

-- Resumes: the rushee who uploaded it, and leadership only — not every
-- brother (PRD §2.2: a regular brother does not see applications).
DROP POLICY IF EXISTS "Admins and brothers can view all resumes" ON storage.objects;
DROP POLICY IF EXISTS "Resumes readable by owner and leadership"  ON storage.objects;
CREATE POLICY "Resumes readable by owner and leadership"
ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'resumes'
  AND (fn_is_leadership() OR auth.uid()::text = (storage.foldername(name))[1])
);

-- Profile photos: any authenticated user (PRD §7.9).
DROP POLICY IF EXISTS "Profile pictures readable by authenticated" ON storage.objects;
CREATE POLICY "Profile pictures readable by authenticated"
ON storage.objects FOR SELECT TO authenticated
USING (bucket_id IN ('profile-pictures', 'profile-photos'));


-- ---------------------------------------------------------------------
-- 6. applications — a regular brother must not read applications
--    (PRD §2.2 / §3.2: review board is leadership-only)
-- ---------------------------------------------------------------------

DROP POLICY IF EXISTS "Brothers can view all applications" ON applications;
DROP POLICY IF EXISTS "Leadership can view applications"   ON applications;

CREATE POLICY "Leadership can view applications" ON applications
  FOR SELECT TO authenticated
  USING (fn_is_leadership() OR auth.uid() = rushee_id);


-- ---------------------------------------------------------------------
-- 7. Bid-night session control is admin-only (PRD §3.2)
--
-- 20260130_create_voting_system.sql granted FOR ALL to
-- access_level IN ('admin','pro'), letting Professional Team members
-- open and close voting.
-- ---------------------------------------------------------------------

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_tables WHERE tablename = 'voting_sessions') THEN
    EXECUTE 'DROP POLICY IF EXISTS "Admins and pro can manage voting sessions" ON voting_sessions';
    EXECUTE 'DROP POLICY IF EXISTS "Admins can manage voting sessions" ON voting_sessions';
    EXECUTE 'CREATE POLICY "Admins can manage voting sessions" ON voting_sessions FOR ALL TO authenticated USING (fn_is_admin()) WITH CHECK (fn_is_admin())';
    EXECUTE 'DROP POLICY IF EXISTS "Leadership can read voting sessions" ON voting_sessions';
    EXECUTE 'CREATE POLICY "Leadership can read voting sessions" ON voting_sessions FOR SELECT TO authenticated USING (fn_is_brother())';
  END IF;

  IF EXISTS (SELECT 1 FROM pg_tables WHERE tablename = 'session_rushees') THEN
    EXECUTE 'DROP POLICY IF EXISTS "Admins and pro can manage session rushees" ON session_rushees';
    EXECUTE 'DROP POLICY IF EXISTS "Admins can manage session rushees" ON session_rushees';
    EXECUTE 'CREATE POLICY "Admins can manage session rushees" ON session_rushees FOR ALL TO authenticated USING (fn_is_admin()) WITH CHECK (fn_is_admin())';
    EXECUTE 'DROP POLICY IF EXISTS "Brothers can read session rushees" ON session_rushees';
    EXECUTE 'CREATE POLICY "Brothers can read session rushees" ON session_rushees FOR SELECT TO authenticated USING (fn_is_brother())';
  END IF;
END$$;

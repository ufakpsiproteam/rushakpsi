-- =====================================================================
-- One-off cleanup: remove QA/test fixtures from himvltqfmbgpbjgbjogt.
-- Run once in the Supabase SQL editor. Not a schema migration — safe to
-- delete this file after running, or leave it as a record of what ran.
--
-- Scope (reviewed row-by-row before writing this):
--   - 33 rushees + rushee "oh boy" (ohlolsiesdigitydang@gmail.com)
--   - 9 brothers matching qa-*@example.com
--   - 4 brother invites (3 qa-invitee*, 1 TEST2_ from this session's audit)
--   - 1 event ("QA Test Event")
--
-- Deliberately NOT touched:
--   - Brother "Kush Mirchandani" (kmirchandani.edu@gmail.com) — kept per
--     explicit instruction, even though it was created in the same
--     batch/minute as the qa- fixtures.
--   - Event "Halle Taylor Spaceship Showcase" (dated year 2000) — odd but
--     not qa-prefixed, named after a real admin, left alone.
--   - Rushee/brother "Kush Mirchandani" (kmirchandani@ufl.edu, clean
--     email) — real-looking, left alone.
--   - Halle Taylor, Greyson Payne, Luke Nevins (both rushee and brother
--     rows), the two real admin accounts — all real-looking, untouched.
--
-- rushees.id and brothers.id both cascade from auth.users(id), so
-- deleting the auth.users row cleans up evaluations, event_attendance,
-- applications, interactions, starred/notes/marks/letter-reads, etc.
-- automatically. The UPDATEs below only clear a handful of separate
-- "who did this" columns that are NOT part of that cascade chain, so the
-- final deletes don't hit a foreign-key error.
-- =====================================================================

BEGIN;

UPDATE app_config SET updated_by = NULL
  WHERE updated_by IN (SELECT id FROM brothers WHERE email LIKE 'qa-%@example.com');
UPDATE brother_roles SET granted_by = NULL
  WHERE granted_by IN (SELECT id FROM brothers WHERE email LIKE 'qa-%@example.com');
UPDATE interview_assignments SET removed_by = NULL
  WHERE removed_by IN (SELECT id FROM brothers WHERE email LIKE 'qa-%@example.com');
UPDATE interview_scripts SET updated_by = NULL
  WHERE updated_by IN (SELECT id FROM brothers WHERE email LIKE 'qa-%@example.com');
UPDATE interviews SET started_by = NULL
  WHERE started_by IN (SELECT id FROM brothers WHERE email LIKE 'qa-%@example.com');
UPDATE interviews SET cancelled_by = NULL
  WHERE cancelled_by IN (SELECT id FROM brothers WHERE email LIKE 'qa-%@example.com');
UPDATE rushee_standing_staging SET staged_invite_only_by = NULL
  WHERE staged_invite_only_by IN (SELECT id FROM brothers WHERE email LIKE 'qa-%@example.com');
UPDATE rushee_standing_staging SET staged_bid_status_by = NULL
  WHERE staged_bid_status_by IN (SELECT id FROM brothers WHERE email LIKE 'qa-%@example.com');
UPDATE rushees SET bid_status_published_by = NULL
  WHERE bid_status_published_by IN (SELECT id FROM brothers WHERE email LIKE 'qa-%@example.com');
UPDATE rushees SET invite_only_published_by = NULL
  WHERE invite_only_published_by IN (SELECT id FROM brothers WHERE email LIKE 'qa-%@example.com');
UPDATE voting_sessions SET created_by = NULL
  WHERE created_by IN (SELECT id FROM brothers WHERE email LIKE 'qa-%@example.com');

-- Test invites: the 3 qa-invitee* rows plus this session's own TEST2_ one.
DELETE FROM brother_invites
  WHERE email LIKE 'qa-%@example.com' OR email = 'test2-brother-invite@example.com';

-- Test event.
DELETE FROM events WHERE title = 'QA Test Event';

-- Test rushees: qa-* fixtures plus "oh boy" (per explicit instruction).
-- Cascades through applications, evaluations, event_attendance,
-- interactions, starred/notes/marks/letter-reads, interview assignments.
DELETE FROM auth.users
  WHERE id IN (
    SELECT id FROM rushees
    WHERE email LIKE 'qa-%@example.com' OR email = 'ohlolsiesdigitydang@gmail.com'
  );

-- Test brothers: qa-* fixtures only. "Kush Mirchandani"
-- (kmirchandani.edu@gmail.com) is deliberately excluded — kept per
-- explicit instruction.
DELETE FROM auth.users
  WHERE id IN (SELECT id FROM brothers WHERE email LIKE 'qa-%@example.com');

COMMIT;

-- Verify: every one of these should return 0 after running.
SELECT
  (SELECT count(*) FROM rushees WHERE email LIKE 'qa-%@example.com' OR email = 'ohlolsiesdigitydang@gmail.com') AS remaining_test_rushees,
  (SELECT count(*) FROM brothers WHERE email LIKE 'qa-%@example.com') AS remaining_test_brothers,
  (SELECT count(*) FROM brother_invites WHERE email LIKE 'qa-%@example.com' OR email = 'test2-brother-invite@example.com') AS remaining_test_invites,
  (SELECT count(*) FROM events WHERE title = 'QA Test Event') AS remaining_test_events;

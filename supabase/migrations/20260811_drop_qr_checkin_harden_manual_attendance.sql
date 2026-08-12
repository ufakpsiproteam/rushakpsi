-- =====================================================================
-- Drop the QR-token check-in system; harden manual attendance.
--
-- The QR-token model (check_in_tokens table, a per-rushee single-use
-- token an admin generates on the spot) modeled a kiosk-style flow that
-- isn't how check-in actually works: a rushee logs into their own
-- account, opens the live event on their own phone, and submits a
-- selfie directly (event_attendance RLS: auth.uid() = rushee_id) — no
-- token involved. Three support functions this depended on
-- (validate_check_in_token, mark_token_used, submit_qr_attendance) were
-- never actually created anywhere in this repo's migration history, so
-- the flow was already dead in practice. This migration removes the
-- pieces that *were* created (guarded, so it's safe to run whether or
-- not this project ever had them).
--
-- Manual attendance (an admin/recruitment director adding a rushee
-- directly, no photo) stays — but create_manual_attendance previously
-- had no internal authorization check at all. Any authenticated caller,
-- including a rushee calling the RPC directly rather than through the
-- admin UI, could mark themselves 'approved' for any event. The
-- function now checks the caller's access_level itself, so the rule is
-- enforced server-side rather than only by the admin page not showing
-- the button.
--
-- Safe to re-run.
-- =====================================================================

DROP FUNCTION IF EXISTS cleanup_expired_tokens();
DROP FUNCTION IF EXISTS validate_check_in_token(TEXT);
DROP FUNCTION IF EXISTS mark_token_used(TEXT);
DROP FUNCTION IF EXISTS submit_qr_attendance(UUID, UUID, TEXT);
DROP TABLE IF EXISTS check_in_tokens;

-- The original signature took a caller-supplied p_admin_id; that's now
-- derived from auth.uid() internally instead (a 3-arg overload can't be
-- CREATE OR REPLACE'd into a 2-arg one — they're different functions).
DROP FUNCTION IF EXISTS create_manual_attendance(UUID, UUID, UUID);

CREATE OR REPLACE FUNCTION create_manual_attendance(
  p_event_id UUID,
  p_rushee_id UUID
)
RETURNS TABLE (
  id UUID,
  event_id UUID,
  rushee_id UUID,
  photo_url TEXT,
  status TEXT,
  group_number INTEGER,
  created_at TIMESTAMP WITH TIME ZONE
)
SECURITY DEFINER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM brothers
    WHERE brothers.id = auth.uid()
      AND brothers.access_level IN ('admin', 'recruitment')
  ) THEN
    RAISE EXCEPTION 'Only admins and recruitment directors may add attendance manually';
  END IF;

  RETURN QUERY
  INSERT INTO event_attendance (event_id, rushee_id, photo_url, status, reviewed_by, reviewed_at)
  VALUES (p_event_id, p_rushee_id, 'manual-checkin', 'approved', auth.uid(), NOW())
  RETURNING
    event_attendance.id,
    event_attendance.event_id,
    event_attendance.rushee_id,
    event_attendance.photo_url,
    event_attendance.status,
    event_attendance.group_number,
    event_attendance.created_at;
END;
$$;

REVOKE ALL ON FUNCTION create_manual_attendance(UUID, UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION create_manual_attendance(UUID, UUID) TO authenticated;

-- =====================================================================
-- Fix: manual-add errors when re-adding a previously removed/rejected
-- rushee.
--
-- event_attendance has UNIQUE(event_id, rushee_id) (confirmed live).
-- Removing a rushee (or the pre-existing photo-review reject) doesn't
-- delete their row, it sets status='removed'/'rejected'. create_manual_
-- attendance did a plain INSERT, which then hits the unique constraint
-- and errors instead of re-adding them.
--
-- Fix: upsert on (event_id, rushee_id) — reactivates the existing row
-- as 'approved' instead of inserting a duplicate. group_number is left
-- untouched (the rushee keeps their prior group; admin can hit
-- "Refresh Groups" separately if they want it reassigned).
--
-- The conflict target must reference the constraint by name
-- (event_attendance_event_id_rushee_id_key), not by column list
-- (event_id, rushee_id) — RETURNS TABLE(..., event_id, rushee_id, ...)
-- makes those two names PL/pgSQL variables in scope, which collide
-- with the unqualified column names in ON CONFLICT (event_id,
-- rushee_id) and raise "column reference is ambiguous".
-- =====================================================================

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
  ON CONFLICT ON CONSTRAINT event_attendance_event_id_rushee_id_key DO UPDATE
  SET status = 'approved',
      photo_url = 'manual-checkin',
      reviewed_by = auth.uid(),
      reviewed_at = NOW(),
      reject_reason = NULL
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

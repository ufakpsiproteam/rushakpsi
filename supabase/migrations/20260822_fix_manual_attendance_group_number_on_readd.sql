-- Fix create_manual_attendance() leaving group_number untouched on re-add.
-- The ON CONFLICT ... DO UPDATE branch (used when re-adding a previously
-- removed/rejected rushee) never fires the assign_group_number() BEFORE
-- INSERT trigger, since UPDATE statements don't trigger BEFORE INSERT. The
-- prior version deliberately left group_number alone on that branch, so a
-- re-added rushee kept whatever stale group_number their original row had
-- (frequently 1, from the pre-fix assign_group_number() bug). This computes
-- a fresh group_number using the same round-robin formula the trigger uses,
-- excluding the rushee's own (about-to-be-reactivated) row from the count,
-- and applies it on both the fresh-insert and re-add paths.
CREATE OR REPLACE FUNCTION create_manual_attendance(
  p_event_id UUID,
  p_rushee_id UUID
)
RETURNS TABLE (
  id UUID, event_id UUID, rushee_id UUID, photo_url TEXT,
  status TEXT, group_number INTEGER, created_at TIMESTAMP WITH TIME ZONE
)
SECURITY DEFINER
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_num_groups INTEGER;
  v_current_count INTEGER;
  v_assigned_group INTEGER;
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM brothers
    WHERE brothers.id = auth.uid()
      AND brothers.access_level IN ('admin', 'recruitment')
  ) THEN
    RAISE EXCEPTION 'Only admins and recruitment directors may add attendance manually';
  END IF;

  SELECT events.number_of_groups INTO v_num_groups
  FROM events
  WHERE events.id = p_event_id;

  IF v_num_groups IS NULL THEN
    v_num_groups := 5;
  END IF;

  SELECT COUNT(*) INTO v_current_count
  FROM event_attendance ea
  WHERE ea.event_id = p_event_id
    AND ea.status IN ('pending', 'approved')
    AND ea.rushee_id != p_rushee_id;

  v_assigned_group := (v_current_count % v_num_groups) + 1;

  RETURN QUERY
  INSERT INTO event_attendance (event_id, rushee_id, photo_url, status, group_number, reviewed_by, reviewed_at)
  VALUES (p_event_id, p_rushee_id, 'manual-checkin', 'approved', v_assigned_group, auth.uid(), NOW())
  ON CONFLICT ON CONSTRAINT event_attendance_event_id_rushee_id_key DO UPDATE
  SET status = 'approved',
      photo_url = 'manual-checkin',
      group_number = v_assigned_group,
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

-- =====================================================================
-- Harden event_attendance status changes + group redistribution.
--
-- event_attendance has RLS enabled with SELECT and INSERT policies only
-- (confirmed live: "Brothers can view all attendance", "Rushees can
-- view their attendance", "Rushees can create attendance") — there has
-- never been an UPDATE policy. Every admin write to event_attendance
-- (approve, reject, the "Remove" button) went through a plain client
-- .update(), which RLS silently matched 0 rows on. PostgREST returns no
-- error on a 0-row UPDATE, so the admin UI updated local state and
-- looked like it worked while nothing persisted.
--
-- redistribute_event_groups() was hit by the same gap: it's
-- SECURITY INVOKER, so its internal UPDATE event_attendance loop was
-- also silently blocked, whether called via the "Refresh Groups" button
-- or via trigger_event_groups_changed firing on events.number_of_groups.
--
-- Fix follows the same pattern already used for create_manual_attendance
-- (SECURITY DEFINER + internal brothers.access_level check) rather than
-- opening a broad RLS UPDATE policy.
-- =====================================================================

-- Step 1: add a distinct 'removed' status, separate from 'rejected'
-- (rejected = photo-review rejection during check-in; removed = admin
-- revoking a previously pending/approved attendance later).
ALTER TABLE event_attendance DROP CONSTRAINT IF EXISTS event_attendance_status_check;
ALTER TABLE event_attendance ADD CONSTRAINT event_attendance_status_check
  CHECK (status IN ('pending', 'approved', 'rejected', 'removed'));

-- Step 2: SECURITY DEFINER RPC for all admin status changes.
CREATE OR REPLACE FUNCTION update_attendance_status(
  p_attendance_id UUID,
  p_status TEXT,
  p_reject_reason TEXT DEFAULT NULL
)
RETURNS event_attendance
SECURITY DEFINER
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_record event_attendance;
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM brothers
    WHERE brothers.id = auth.uid()
      AND brothers.access_level IN ('admin', 'recruitment')
  ) THEN
    RAISE EXCEPTION 'Only admins and recruitment directors may change attendance status';
  END IF;

  IF p_status NOT IN ('approved', 'rejected', 'removed') THEN
    RAISE EXCEPTION 'Invalid status: %', p_status;
  END IF;

  UPDATE event_attendance
  SET status = p_status,
      reviewed_by = auth.uid(),
      reviewed_at = NOW(),
      reject_reason = CASE WHEN p_status = 'rejected' THEN p_reject_reason ELSE NULL END
  WHERE id = p_attendance_id
  RETURNING * INTO v_record;

  IF v_record.id IS NULL THEN
    RAISE EXCEPTION 'Attendance record not found: %', p_attendance_id;
  END IF;

  RETURN v_record;
END;
$$;

REVOKE ALL ON FUNCTION update_attendance_status(UUID, TEXT, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION update_attendance_status(UUID, TEXT, TEXT) TO authenticated;

-- Step 3: re-harden the group-assignment functions (SECURITY DEFINER +
-- search_path, plus an explicit auth check now that RLS is no longer
-- the gate for redistribute_event_groups).
CREATE OR REPLACE FUNCTION assign_group_number()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_num_groups INTEGER;
  v_current_count INTEGER;
  v_assigned_group INTEGER;
BEGIN
  SELECT number_of_groups INTO v_num_groups
  FROM events
  WHERE id = NEW.event_id;

  IF v_num_groups IS NULL THEN
    v_num_groups := 5;
  END IF;

  SELECT COUNT(*) INTO v_current_count
  FROM event_attendance
  WHERE event_id = NEW.event_id
    AND status IN ('pending', 'approved');

  v_assigned_group := (v_current_count % v_num_groups) + 1;
  NEW.group_number := v_assigned_group;

  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION redistribute_event_groups(p_event_id UUID)
RETURNS void
SECURITY DEFINER
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_num_groups INTEGER;
  v_record RECORD;
  v_counter INTEGER := 0;
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM brothers
    WHERE brothers.id = auth.uid()
      AND brothers.access_level IN ('admin', 'recruitment')
  ) THEN
    RAISE EXCEPTION 'Only admins and recruitment directors may redistribute groups';
  END IF;

  SELECT number_of_groups INTO v_num_groups
  FROM events
  WHERE id = p_event_id;

  IF v_num_groups IS NULL THEN
    RAISE EXCEPTION 'Event not found or number_of_groups is NULL';
  END IF;

  FOR v_record IN
    SELECT id
    FROM event_attendance
    WHERE event_id = p_event_id
      AND status IN ('pending', 'approved')
    ORDER BY created_at ASC
  LOOP
    UPDATE event_attendance
    SET group_number = (v_counter % v_num_groups) + 1
    WHERE id = v_record.id;

    v_counter := v_counter + 1;
  END LOOP;
END;
$$;

REVOKE ALL ON FUNCTION redistribute_event_groups(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION redistribute_event_groups(UUID) TO authenticated;

-- Step 4: new RPC to change an event's group count and redistribute in
-- one atomic call. Runs as definer so it doesn't depend on the events
-- table's UPDATE RLS policy (which still checks a legacy user_profiles
-- model, not brothers — a separate, unfixed gap).
CREATE OR REPLACE FUNCTION set_event_group_count(
  p_event_id UUID,
  p_number_of_groups INTEGER
)
RETURNS void
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
    RAISE EXCEPTION 'Only admins and recruitment directors may change group count';
  END IF;

  IF p_number_of_groups < 1 OR p_number_of_groups > 20 THEN
    RAISE EXCEPTION 'number_of_groups must be between 1 and 20';
  END IF;

  UPDATE events
  SET number_of_groups = p_number_of_groups
  WHERE id = p_event_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Event not found: %', p_event_id;
  END IF;

  PERFORM redistribute_event_groups(p_event_id);
END;
$$;

REVOKE ALL ON FUNCTION set_event_group_count(UUID, INTEGER) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION set_event_group_count(UUID, INTEGER) TO authenticated;

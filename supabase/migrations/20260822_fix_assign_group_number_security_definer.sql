-- Fix assign_group_number() computing group 1 for every rushee self check-in.
-- The function was SECURITY INVOKER, so its internal COUNT(*) over
-- event_attendance was subject to RLS ("Rushees can view their attendance":
-- auth.uid() = rushee_id). Since UNIQUE(event_id, rushee_id) guarantees a
-- checking-in rushee has zero prior rows for this event, the RLS-filtered
-- count was always 0, so every self check-in computed
-- (0 % number_of_groups) + 1 = 1 regardless of how many others already
-- checked in. SECURITY DEFINER makes the count bypass RLS, matching the
-- pattern already used by redistribute_event_groups/set_event_group_count/
-- create_manual_attendance.
CREATE OR REPLACE FUNCTION assign_group_number()
RETURNS TRIGGER
SECURITY DEFINER
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

-- Migration: Add group assignment functionality to events
-- Date: 2025-12-08
-- Description: Adds automatic group assignment to event attendance with configurable group count per event

-- Step 1: Add number_of_groups column to events table
ALTER TABLE events
ADD COLUMN number_of_groups INTEGER NOT NULL DEFAULT 5
CHECK (number_of_groups >= 1 AND number_of_groups <= 20);

-- Add comment for documentation
COMMENT ON COLUMN events.number_of_groups IS 'Number of groups for this event. Rushees are distributed evenly across groups. Default is 5.';

-- Step 2: Add group_number column to event_attendance table
ALTER TABLE event_attendance
ADD COLUMN group_number INTEGER;

-- Add constraint to ensure group_number is within valid range
ALTER TABLE event_attendance
ADD CONSTRAINT valid_group_number
CHECK (group_number IS NULL OR (group_number >= 1 AND group_number <= 20));

-- Add comment for documentation
COMMENT ON COLUMN event_attendance.group_number IS 'Automatically assigned group number for this attendee (1 to number_of_groups)';

-- Step 3: Create index on event_attendance for efficient group assignment queries
CREATE INDEX idx_event_attendance_event_group
ON event_attendance(event_id, group_number)
WHERE group_number IS NOT NULL;

-- Step 4: Create function to assign group number
CREATE OR REPLACE FUNCTION assign_group_number()
RETURNS TRIGGER AS $$
DECLARE
  v_num_groups INTEGER;
  v_current_count INTEGER;
  v_assigned_group INTEGER;
BEGIN
  -- Get the number of groups for this event
  SELECT number_of_groups INTO v_num_groups
  FROM events
  WHERE id = NEW.event_id;

  -- If event not found or number_of_groups is NULL, default to 5
  IF v_num_groups IS NULL THEN
    v_num_groups := 5;
  END IF;

  -- Count existing approved/pending attendees for this event
  -- (excluding rejected, as they don't count for group distribution)
  SELECT COUNT(*) INTO v_current_count
  FROM event_attendance
  WHERE event_id = NEW.event_id
    AND status IN ('pending', 'approved');

  -- Calculate group assignment (round-robin: 1,2,3,...,N,1,2,3,...)
  -- Using modulo operation: (count % num_groups) + 1
  v_assigned_group := (v_current_count % v_num_groups) + 1;

  -- Assign the group number to the new record
  NEW.group_number := v_assigned_group;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Step 5: Create trigger to auto-assign group on INSERT
CREATE TRIGGER trigger_assign_group_number
  BEFORE INSERT ON event_attendance
  FOR EACH ROW
  EXECUTE FUNCTION assign_group_number();

-- Step 6: Create function to redistribute groups when number_of_groups changes
CREATE OR REPLACE FUNCTION redistribute_event_groups(p_event_id UUID)
RETURNS void AS $$
DECLARE
  v_num_groups INTEGER;
  v_record RECORD;
  v_counter INTEGER := 0;
BEGIN
  -- Get the number of groups for this event
  SELECT number_of_groups INTO v_num_groups
  FROM events
  WHERE id = p_event_id;

  IF v_num_groups IS NULL THEN
    RAISE EXCEPTION 'Event not found or number_of_groups is NULL';
  END IF;

  -- Update all attendance records for this event in order
  -- Assign groups sequentially to maintain even distribution
  FOR v_record IN
    SELECT id
    FROM event_attendance
    WHERE event_id = p_event_id
      AND status IN ('pending', 'approved')
    ORDER BY created_at ASC
  LOOP
    -- Assign group number using round-robin
    UPDATE event_attendance
    SET group_number = (v_counter % v_num_groups) + 1
    WHERE id = v_record.id;

    v_counter := v_counter + 1;
  END LOOP;
END;
$$ LANGUAGE plpgsql;

-- Step 7: Create trigger to auto-redistribute when number_of_groups changes
CREATE OR REPLACE FUNCTION trigger_redistribute_groups()
RETURNS TRIGGER AS $$
BEGIN
  -- Only redistribute if number_of_groups actually changed
  IF NEW.number_of_groups IS DISTINCT FROM OLD.number_of_groups THEN
    PERFORM redistribute_event_groups(NEW.id);
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_event_groups_changed
  AFTER UPDATE OF number_of_groups ON events
  FOR EACH ROW
  EXECUTE FUNCTION trigger_redistribute_groups();

-- Step 8: Backfill existing attendance records with group assignments
-- This assigns groups to any existing attendance records
DO $$
DECLARE
  v_event RECORD;
BEGIN
  FOR v_event IN SELECT DISTINCT id FROM events LOOP
    PERFORM redistribute_event_groups(v_event.id);
  END LOOP;
END $$;

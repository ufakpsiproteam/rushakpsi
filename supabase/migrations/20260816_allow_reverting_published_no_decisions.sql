-- ---------------------------------------------------------------------
-- Allow admins to revert a published "No" on invite_only / bid_status.
--
-- fn_guard_rushee_privileged_columns (20260811_split_standing_into_invite_bid.sql)
-- originally made a published No terminal on both columns, matching the
-- terminal behavior a published Yes never had. In practice this meant an
-- admin mistake (publishing No for the wrong rushee) could never be
-- corrected. Yes was never locked and stays that way; No is no longer
-- locked either. The sequencing rule (a bid decision requires invite_only
-- already published Yes) is unchanged.
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

  IF NEW.bid_status IS NOT NULL AND NEW.invite_only IS NOT TRUE THEN
    RAISE EXCEPTION 'Cannot set a bid decision before Invite Only has been published as Yes';
  END IF;

  RETURN NEW;
END;
$$;

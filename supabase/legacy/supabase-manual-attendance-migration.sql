-- Migration: Add manual attendance functionality with QR code check-in
-- Date: 2025-12-08
-- Description: Enables admins to manually add attendance via skip photo or QR code token

-- Step 1: Create check_in_tokens table for QR code-based check-ins
CREATE TABLE check_in_tokens (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  token TEXT UNIQUE NOT NULL,  -- Random secure token for QR code
  event_id UUID REFERENCES events(id) ON DELETE CASCADE NOT NULL,
  rushee_id UUID REFERENCES rushees(id) ON DELETE CASCADE NOT NULL,
  created_by UUID NOT NULL,  -- Admin/Brother who created it (no FK constraint for flexibility)
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
  used_at TIMESTAMP WITH TIME ZONE,  -- NULL until used, prevents reuse
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Step 2: Add indexes for efficient token lookup
CREATE INDEX idx_check_in_tokens_token
ON check_in_tokens(token)
WHERE used_at IS NULL;

CREATE INDEX idx_check_in_tokens_expires
ON check_in_tokens(expires_at)
WHERE used_at IS NULL;

-- Step 3: Add comment for documentation
COMMENT ON TABLE check_in_tokens IS 'One-time tokens for QR code-based manual check-ins. Tokens expire after 5 minutes or one use.';

-- Step 4: Create function to clean up expired tokens
CREATE OR REPLACE FUNCTION cleanup_expired_tokens()
RETURNS void AS $$
BEGIN
  DELETE FROM check_in_tokens
  WHERE expires_at < NOW()
    OR (used_at IS NOT NULL AND used_at < NOW() - INTERVAL '1 hour');
END;
$$ LANGUAGE plpgsql;

-- Step 4b: Create function for manual attendance insertion (bypasses RLS)
CREATE OR REPLACE FUNCTION create_manual_attendance(
  p_event_id UUID,
  p_rushee_id UUID,
  p_admin_id UUID
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
AS $$
BEGIN
  RETURN QUERY
  INSERT INTO event_attendance (event_id, rushee_id, photo_url, status, reviewed_by, reviewed_at)
  VALUES (p_event_id, p_rushee_id, 'manual-checkin', 'approved', p_admin_id, NOW())
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

-- Step 5: Add RLS policies for check_in_tokens table
ALTER TABLE check_in_tokens ENABLE ROW LEVEL SECURITY;

-- Brothers/Admins can create tokens
CREATE POLICY "Brothers can create check-in tokens"
ON check_in_tokens
FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM brothers
    WHERE brothers.id = auth.uid()
  )
);

-- Anyone can read valid tokens (needed for QR check-in page)
CREATE POLICY "Anyone can read valid tokens"
ON check_in_tokens
FOR SELECT
TO authenticated
USING (used_at IS NULL AND expires_at > NOW());

-- Anyone can update tokens (mark as used)
CREATE POLICY "Anyone can update tokens"
ON check_in_tokens
FOR UPDATE
TO authenticated
USING (true);

-- Fix all SELECT policies to avoid circular dependencies and allow proper data access

-- EVALUATIONS TABLE
DROP POLICY IF EXISTS "Brothers can manage their own evaluations" ON evaluations;
DROP POLICY IF EXISTS "Brothers can view their evaluations" ON evaluations;
DROP POLICY IF EXISTS "Brothers can create evaluations" ON evaluations;
DROP POLICY IF EXISTS "Brothers can update evaluations" ON evaluations;
DROP POLICY IF EXISTS "Admins can view all evaluations" ON evaluations;

-- Brothers can view and manage their own evaluations
CREATE POLICY "Brothers can view their evaluations" ON evaluations
  FOR SELECT USING (auth.uid() = brother_id);

CREATE POLICY "Brothers can create evaluations" ON evaluations
  FOR INSERT WITH CHECK (auth.uid() = brother_id);

CREATE POLICY "Brothers can update evaluations" ON evaluations
  FOR UPDATE USING (auth.uid() = brother_id);

CREATE POLICY "Brothers can delete evaluations" ON evaluations
  FOR DELETE USING (auth.uid() = brother_id);

-- Admins can view all evaluations
CREATE POLICY "Admins can view all evaluations" ON evaluations
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM brothers
      WHERE brothers.id = auth.uid()
      AND brothers.access_level = 'admin'
    )
  );

-- STARRED_RUSHEES TABLE
DROP POLICY IF EXISTS "Brothers can manage their stars" ON starred_rushees;
DROP POLICY IF EXISTS "Brothers can view their stars" ON starred_rushees;
DROP POLICY IF EXISTS "Brothers can create stars" ON starred_rushees;
DROP POLICY IF EXISTS "Brothers can delete stars" ON starred_rushees;

CREATE POLICY "Brothers can view their stars" ON starred_rushees
  FOR SELECT USING (auth.uid() = brother_id);

CREATE POLICY "Brothers can create stars" ON starred_rushees
  FOR INSERT WITH CHECK (auth.uid() = brother_id);

CREATE POLICY "Brothers can delete stars" ON starred_rushees
  FOR DELETE USING (auth.uid() = brother_id);

-- BROTHER_EVENT_ATTENDANCE TABLE
DROP POLICY IF EXISTS "Brothers can view their own event attendance" ON brother_event_attendance;
DROP POLICY IF EXISTS "Brothers can create their own event attendance" ON brother_event_attendance;
DROP POLICY IF EXISTS "Admins can view all brother event attendance" ON brother_event_attendance;

CREATE POLICY "Brothers can view their attendance" ON brother_event_attendance
  FOR SELECT USING (auth.uid() = brother_id);

CREATE POLICY "Brothers can create attendance" ON brother_event_attendance
  FOR INSERT WITH CHECK (auth.uid() = brother_id);

CREATE POLICY "Admins can view all attendance" ON brother_event_attendance
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM brothers
      WHERE brothers.id = auth.uid()
      AND brothers.access_level = 'admin'
    )
  );

-- EVENT_ATTENDANCE TABLE (rushee attendance)
DROP POLICY IF EXISTS "Brothers and admins can view all attendance" ON event_attendance;

CREATE POLICY "Brothers can view rushee attendance" ON event_attendance
  FOR SELECT USING (
    auth.role() = 'authenticated'
  );

CREATE POLICY "Rushees can view their attendance" ON event_attendance
  FOR SELECT USING (auth.uid() = rushee_id);

CREATE POLICY "Rushees can create attendance" ON event_attendance
  FOR INSERT WITH CHECK (auth.uid() = rushee_id);

-- EVENTS TABLE
DROP POLICY IF EXISTS "Everyone can view events" ON events;
DROP POLICY IF EXISTS "Authenticated users can view events" ON events;

-- Allow public access to view events (landing page is public)
CREATE POLICY "Anyone can view events" ON events
  FOR SELECT USING (true);

-- PERSONAL NOTES TABLE
DROP POLICY IF EXISTS "Brothers can manage notes" ON personal_notes;
DROP POLICY IF EXISTS "Brothers can view their notes" ON personal_notes;
DROP POLICY IF EXISTS "Brothers can create notes" ON personal_notes;
DROP POLICY IF EXISTS "Brothers can update notes" ON personal_notes;
DROP POLICY IF EXISTS "Brothers can delete notes" ON personal_notes;

CREATE POLICY "Brothers can view their notes" ON personal_notes
  FOR SELECT USING (auth.uid() = brother_id);

CREATE POLICY "Brothers can create notes" ON personal_notes
  FOR INSERT WITH CHECK (auth.uid() = brother_id);

CREATE POLICY "Brothers can update notes" ON personal_notes
  FOR UPDATE USING (auth.uid() = brother_id);

CREATE POLICY "Brothers can delete notes" ON personal_notes
  FOR DELETE USING (auth.uid() = brother_id);

-- APPLICATIONS TABLE
DROP POLICY IF EXISTS "Rushees can view their application" ON applications;
DROP POLICY IF EXISTS "Rushees can create their application" ON applications;
DROP POLICY IF EXISTS "Rushees can update their application" ON applications;
DROP POLICY IF EXISTS "Brothers can view applications" ON applications;

CREATE POLICY "Rushees can view their application" ON applications
  FOR SELECT USING (auth.uid() = rushee_id);

CREATE POLICY "Rushees can create application" ON applications
  FOR INSERT WITH CHECK (auth.uid() = rushee_id);

CREATE POLICY "Rushees can update application" ON applications
  FOR UPDATE USING (auth.uid() = rushee_id);

CREATE POLICY "Brothers can view all applications" ON applications
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM brothers
      WHERE brothers.id = auth.uid()
    )
  );

-- USER_PROFILES TABLE
DROP POLICY IF EXISTS "Users can view their profile" ON user_profiles;
DROP POLICY IF EXISTS "Users can update their profile" ON user_profiles;

CREATE POLICY "Users can view their profile" ON user_profiles
  FOR SELECT USING (auth.uid() = id);

CREATE POLICY "Users can update their profile" ON user_profiles
  FOR UPDATE USING (auth.uid() = id);

-- CHECK_IN_TOKENS TABLE dropped entirely (20260811_drop_qr_checkin_harden_manual_attendance.sql) —
-- the QR-token check-in system this policy belonged to was never the
-- real check-in path.

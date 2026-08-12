-- Fix RLS policies to allow ALL brothers to view rushees and events
-- Only evaluations and applications should be restricted to elevated roles

-- ============================================
-- RUSHEES TABLE - ALL BROTHERS CAN VIEW
-- ============================================

DROP POLICY IF EXISTS "Brothers with access can view all rushees" ON rushees;

CREATE POLICY "Brothers can view all rushees" ON rushees
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM brothers
      WHERE brothers.id = auth.uid()
    )
    OR auth.uid() = id
  );

-- ============================================
-- EVENTS TABLE - ALL BROTHERS CAN VIEW
-- ============================================

DROP POLICY IF EXISTS "Brothers with access can view all events" ON events;
DROP POLICY IF EXISTS "Brothers can view all events" ON events;

CREATE POLICY "Brothers can view all events" ON events
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM brothers
      WHERE brothers.id = auth.uid()
    )
    OR TRUE  -- Events are generally viewable
  );

-- ============================================
-- EVENT_ATTENDANCE - ALL BROTHERS CAN VIEW
-- ============================================

DROP POLICY IF EXISTS "Brothers with access can view all attendance" ON event_attendance;

CREATE POLICY "Brothers can view all attendance" ON event_attendance
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM brothers
      WHERE brothers.id = auth.uid()
    )
    OR auth.uid() = rushee_id
  );

-- ============================================
-- EVALUATIONS - Keep restricted to elevated roles
-- ============================================
-- (Already correct - no changes needed)

-- ============================================
-- APPLICATIONS - Keep restricted to elevated roles
-- ============================================
-- (Already correct - no changes needed)

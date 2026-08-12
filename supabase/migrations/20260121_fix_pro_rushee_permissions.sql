-- Fix RLS policies: Pro users should only SELECT, not UPDATE rushees
-- This reverses the change made in 20260113_allow_pro_update_rushees.sql
-- Only admins can update rushee standings, while pro users have read-only access

-- Drop and recreate the UPDATE policy to only allow admins
DROP POLICY IF EXISTS "Admins can update rushees" ON rushees;

CREATE POLICY "Admins can update rushees" ON rushees
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM brothers
      WHERE brothers.id = auth.uid()
      AND brothers.access_level = 'admin'
    )
  );

-- Ensure all brothers (including pro) can view rushees
-- This policy should already exist, but we're being explicit
DROP POLICY IF EXISTS "Brothers can view all rushees" ON rushees;

CREATE POLICY "Brothers can view all rushees" ON rushees
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM brothers
      WHERE brothers.id = auth.uid()
    )
  );

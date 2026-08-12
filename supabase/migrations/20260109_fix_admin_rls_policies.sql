-- Fix RLS policies to allow admins (using brothers.access_level) to update rushee standings

-- Drop old policies if they exist
DROP POLICY IF EXISTS "Rushees can view their own profile" ON rushees;
DROP POLICY IF EXISTS "Brothers can view all rushees" ON rushees;
DROP POLICY IF EXISTS "Admins can update rushees" ON rushees;
DROP POLICY IF EXISTS "Admins can insert rushees" ON rushees;
DROP POLICY IF EXISTS "Admins can delete rushees" ON rushees;

-- Allow rushees to view their own profile
CREATE POLICY "Rushees can view their own profile" ON rushees
  FOR SELECT USING (auth.uid() = id);

-- Allow brothers (including admins) to view all rushees
CREATE POLICY "Brothers can view all rushees" ON rushees
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM brothers
      WHERE brothers.id = auth.uid()
    )
  );

-- Create new policy that checks brothers.access_level instead of user_profiles.user_type
CREATE POLICY "Admins can update rushees" ON rushees
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM brothers
      WHERE brothers.id = auth.uid()
      AND brothers.access_level = 'admin'
    )
  );

-- Also add a policy for INSERT if needed
CREATE POLICY "Admins can insert rushees" ON rushees
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM brothers
      WHERE brothers.id = auth.uid()
      AND brothers.access_level = 'admin'
    )
  );

-- Add DELETE policy for admins
CREATE POLICY "Admins can delete rushees" ON rushees
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM brothers
      WHERE brothers.id = auth.uid()
      AND brothers.access_level = 'admin'
    )
  );

-- Fix RLS policies to allow admins to update brother access levels

-- Enable RLS on brothers table if not already enabled
ALTER TABLE brothers ENABLE ROW LEVEL SECURITY;

-- Drop old policies if they exist
DROP POLICY IF EXISTS "Brothers can view all brothers" ON brothers;
DROP POLICY IF EXISTS "Brothers can view their own profile" ON brothers;
DROP POLICY IF EXISTS "Authenticated users can view brothers" ON brothers;
DROP POLICY IF EXISTS "Admins can update brother access levels" ON brothers;
DROP POLICY IF EXISTS "Admins can insert brothers" ON brothers;
DROP POLICY IF EXISTS "Admins can delete brothers" ON brothers;

-- Allow all authenticated users to view brother profiles (avoid circular dependency)
CREATE POLICY "Authenticated users can view brothers" ON brothers
  FOR SELECT USING (auth.role() = 'authenticated');

-- Allow admins to update any brother's access level
CREATE POLICY "Admins can update brother access levels" ON brothers
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM brothers
      WHERE brothers.id = auth.uid()
      AND brothers.access_level = 'admin'
    )
  );

-- Allow admins to insert new brothers
CREATE POLICY "Admins can insert brothers" ON brothers
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM brothers
      WHERE brothers.id = auth.uid()
      AND brothers.access_level = 'admin'
    )
  );

-- Allow admins to delete brothers
CREATE POLICY "Admins can delete brothers" ON brothers
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM brothers
      WHERE brothers.id = auth.uid()
      AND brothers.access_level = 'admin'
    )
  );

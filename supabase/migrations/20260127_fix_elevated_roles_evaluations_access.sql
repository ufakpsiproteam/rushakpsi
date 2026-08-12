-- Fix evaluations and applications access for elevated roles
-- Ensure that brothers with elevated roles can see ALL evaluations and applications

-- ============================================
-- EVALUATIONS TABLE
-- ============================================

DROP POLICY IF EXISTS "Brothers with access can view all evaluations" ON evaluations;
DROP POLICY IF EXISTS "Admins and Pros can view all evaluations" ON evaluations;
DROP POLICY IF EXISTS "Elevated role brothers can view all evaluations" ON evaluations;
DROP POLICY IF EXISTS "Brothers can view own evaluations" ON evaluations;

-- Split into multiple policies for clarity and performance
-- Policy 1: Admins and Pros can see all evaluations
CREATE POLICY "Admins and Pros can view all evaluations" ON evaluations
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM brothers
      WHERE brothers.id = auth.uid()
      AND brothers.access_level IN ('admin', 'pro')
    )
  );

-- Policy 2: Brothers with elevated roles can see all evaluations
CREATE POLICY "Elevated role brothers can view all evaluations" ON evaluations
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM brother_roles
      WHERE brother_roles.brother_id = auth.uid()
      AND brother_roles.role IN ('recruitment_director', 'professional_team')
    )
  );

-- Policy 3: Brothers can see their own evaluations
CREATE POLICY "Brothers can view own evaluations" ON evaluations
  FOR SELECT USING (auth.uid() = brother_id);

-- ============================================
-- APPLICATIONS TABLE
-- ============================================

DROP POLICY IF EXISTS "Brothers with access can view all applications" ON applications;
DROP POLICY IF EXISTS "Admins and Pros can view all applications" ON applications;
DROP POLICY IF EXISTS "Elevated role brothers can view all applications" ON applications;
DROP POLICY IF EXISTS "Rushees can view own application" ON applications;

-- Policy 1: Admins and Pros can see all applications
CREATE POLICY "Admins and Pros can view all applications" ON applications
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM brothers
      WHERE brothers.id = auth.uid()
      AND brothers.access_level IN ('admin', 'pro')
    )
  );

-- Policy 2: Brothers with elevated roles can see all applications
CREATE POLICY "Elevated role brothers can view all applications" ON applications
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM brother_roles
      WHERE brother_roles.brother_id = auth.uid()
      AND brother_roles.role IN ('recruitment_director', 'professional_team')
    )
  );

-- Policy 3: Rushees can see their own application
CREATE POLICY "Rushees can view own application" ON applications
  FOR SELECT USING (auth.uid() = rushee_id);

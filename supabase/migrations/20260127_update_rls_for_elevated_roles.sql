-- Update RLS policies to allow brothers with elevated roles (recruitment_director, professional_team)
-- to view all evaluations and applications just like admins and pros
-- NOTE: Rushees and events remain accessible to ALL brothers

-- ============================================
-- EVALUATIONS TABLE
-- ============================================

-- Drop existing SELECT policy for evaluations
DROP POLICY IF EXISTS "Brothers can view all evaluations" ON evaluations;
DROP POLICY IF EXISTS "Admins and Pros can view all evaluations" ON evaluations;
DROP POLICY IF EXISTS "Brothers with access can view all evaluations" ON evaluations;

-- Recreate with elevated roles support
CREATE POLICY "Brothers with access can view all evaluations" ON evaluations
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM brothers
      WHERE brothers.id = auth.uid()
      AND (
        brothers.access_level IN ('admin', 'pro')
        OR EXISTS (
          SELECT 1 FROM brother_roles
          WHERE brother_roles.brother_id = auth.uid()
          AND brother_roles.role IN ('recruitment_director', 'professional_team')
        )
      )
    )
    OR auth.uid() = brother_id
  );

-- ============================================
-- APPLICATIONS TABLE
-- ============================================

-- Drop existing SELECT policy for applications
DROP POLICY IF EXISTS "Brothers can view all applications" ON applications;
DROP POLICY IF EXISTS "Admins and Pros can view all applications" ON applications;
DROP POLICY IF EXISTS "Brothers with access can view all applications" ON applications;

-- Recreate with elevated roles support
CREATE POLICY "Brothers with access can view all applications" ON applications
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM brothers
      WHERE brothers.id = auth.uid()
      AND (
        brothers.access_level IN ('admin', 'pro')
        OR EXISTS (
          SELECT 1 FROM brother_roles
          WHERE brother_roles.brother_id = auth.uid()
          AND brother_roles.role IN ('recruitment_director', 'professional_team')
        )
      )
    )
    OR auth.uid() = rushee_id
  );

-- ============================================
-- BROTHER_RUSHEE_INTERACTIONS TABLE
-- ============================================

-- Drop existing SELECT policy for interactions
DROP POLICY IF EXISTS "Brothers can view all interactions" ON brother_rushee_interactions;
DROP POLICY IF EXISTS "Admins and Pros can view all interactions" ON brother_rushee_interactions;
DROP POLICY IF EXISTS "Brothers with access can view all interactions" ON brother_rushee_interactions;

-- Recreate with elevated roles support
CREATE POLICY "Brothers with access can view all interactions" ON brother_rushee_interactions
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM brothers
      WHERE brothers.id = auth.uid()
      AND (
        brothers.access_level IN ('admin', 'pro')
        OR EXISTS (
          SELECT 1 FROM brother_roles
          WHERE brother_roles.brother_id = auth.uid()
          AND brother_roles.role IN ('recruitment_director', 'professional_team')
        )
      )
    )
    OR auth.uid() = brother_id
  );

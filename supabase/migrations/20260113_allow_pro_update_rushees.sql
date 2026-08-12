-- Allow pro access level brothers to update rushee standings

DROP POLICY IF EXISTS "Admins can update rushees" ON rushees;

CREATE POLICY "Admins can update rushees" ON rushees
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM brothers
      WHERE brothers.id = auth.uid()
      AND brothers.access_level IN ('admin', 'pro')
    )
  );

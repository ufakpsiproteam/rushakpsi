-- Create roles enum type
CREATE TYPE brother_role AS ENUM (
  'recruitment_director',
  'professional_team'
);

-- Create brother_roles junction table
CREATE TABLE brother_roles (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  brother_id UUID NOT NULL REFERENCES brothers(id) ON DELETE CASCADE,
  role brother_role NOT NULL,
  granted_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  granted_by UUID REFERENCES brothers(id),
  UNIQUE(brother_id, role)
);

-- Enable RLS
ALTER TABLE brother_roles ENABLE ROW LEVEL SECURITY;

-- RLS Policies
-- Brothers can view their own roles
CREATE POLICY "Brothers can view their own roles" ON brother_roles
  FOR SELECT USING (auth.uid() = brother_id);

-- All brothers can view other brothers' roles (for directory purposes)
CREATE POLICY "Brothers can view all roles" ON brother_roles
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM brothers
      WHERE brothers.id = auth.uid()
    )
  );

-- Only admins can grant/revoke roles
CREATE POLICY "Admins can manage roles" ON brother_roles
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM brothers
      WHERE brothers.id = auth.uid()
      AND brothers.access_level = 'admin'
    )
  );

-- Create indexes for performance
CREATE INDEX idx_brother_roles_brother_id ON brother_roles(brother_id);
CREATE INDEX idx_brother_roles_role ON brother_roles(role);

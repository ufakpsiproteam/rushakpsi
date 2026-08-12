-- Create applications table for rushee applications

CREATE TABLE IF NOT EXISTS applications (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  rushee_id UUID REFERENCES rushees(id) ON DELETE CASCADE NOT NULL UNIQUE,

  -- Additional information
  pronouns TEXT,
  race TEXT,
  gpa TEXT NOT NULL,

  -- Essay questions
  why_akpsi TEXT NOT NULL,
  career_interests TEXT NOT NULL,
  brother_connection TEXT NOT NULL,
  rushee_connection TEXT NOT NULL,
  personal_description TEXT NOT NULL,
  pillar_resonance TEXT NOT NULL,

  -- Acknowledgement
  acknowledgement BOOLEAN NOT NULL DEFAULT false,

  -- Status
  is_submitted BOOLEAN NOT NULL DEFAULT false,
  submitted_at TIMESTAMP WITH TIME ZONE,

  -- Timestamps
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_applications_rushee_id ON applications(rushee_id);
CREATE INDEX IF NOT EXISTS idx_applications_submitted ON applications(is_submitted);

-- Enable RLS
ALTER TABLE applications ENABLE ROW LEVEL SECURITY;

-- Policy: Rushees can only see and edit their own application
CREATE POLICY "Rushees can view own application"
  ON applications FOR SELECT
  USING (auth.uid() = rushee_id);

CREATE POLICY "Rushees can insert own application"
  ON applications FOR INSERT
  WITH CHECK (auth.uid() = rushee_id);

CREATE POLICY "Rushees can update own application if not submitted"
  ON applications FOR UPDATE
  USING (auth.uid() = rushee_id AND is_submitted = false)
  WITH CHECK (auth.uid() = rushee_id);

-- Policy: Brothers can view all submitted applications
CREATE POLICY "Brothers can view submitted applications"
  ON applications FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM brothers WHERE brothers.id = auth.uid()
    )
  );

-- Update trigger for updated_at
CREATE OR REPLACE FUNCTION update_applications_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER applications_updated_at
  BEFORE UPDATE ON applications
  FOR EACH ROW
  EXECUTE FUNCTION update_applications_updated_at();

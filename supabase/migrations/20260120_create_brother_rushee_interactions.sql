-- Create table to track brother-rushee interactions
-- An interaction is recorded when a brother selects a rushee during the evaluation flow
-- This is separate from evaluations - a brother can interact with a rushee without evaluating them

CREATE TABLE IF NOT EXISTS brother_rushee_interactions (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  brother_id UUID REFERENCES brothers(id) ON DELETE CASCADE NOT NULL,
  rushee_id UUID REFERENCES rushees(id) ON DELETE CASCADE NOT NULL,
  event_id UUID REFERENCES events(id) ON DELETE CASCADE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(brother_id, rushee_id, event_id)
);

-- Enable RLS
ALTER TABLE brother_rushee_interactions ENABLE ROW LEVEL SECURITY;

-- Brothers can view their own interactions
CREATE POLICY "Brothers can view their own interactions" ON brother_rushee_interactions
  FOR SELECT USING (auth.uid() = brother_id);

-- Brothers can create their own interactions
CREATE POLICY "Brothers can insert their own interactions" ON brother_rushee_interactions
  FOR INSERT WITH CHECK (auth.uid() = brother_id);

-- Brothers can delete their own interactions (if they deselect)
CREATE POLICY "Brothers can delete their own interactions" ON brother_rushee_interactions
  FOR DELETE USING (auth.uid() = brother_id);

-- Admins can view all interactions
CREATE POLICY "Admins can view all interactions" ON brother_rushee_interactions
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM brothers
      WHERE brothers.id = auth.uid()
      AND brothers.access_level = 'admin'
    )
  );

-- Admins can manage all interactions
CREATE POLICY "Admins can manage all interactions" ON brother_rushee_interactions
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM brothers
      WHERE brothers.id = auth.uid()
      AND brothers.access_level = 'admin'
    )
  );

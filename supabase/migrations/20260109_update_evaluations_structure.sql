-- Update evaluations table structure
-- Change from per-event evaluations to per-brother-rushee evaluations
-- This allows brothers to maintain consistent evaluations across multiple events

-- Drop the old unique constraint on (brother_id, rushee_id, event_id)
ALTER TABLE evaluations
DROP CONSTRAINT IF EXISTS evaluations_brother_id_rushee_id_event_id_key;

-- Make event_id nullable since evaluations are now per brother-rushee pair, not per event
ALTER TABLE evaluations
ALTER COLUMN event_id DROP NOT NULL;

-- Add new unique constraint on just (brother_id, rushee_id)
-- This ensures one evaluation per brother-rushee pair
ALTER TABLE evaluations
ADD CONSTRAINT evaluations_brother_id_rushee_id_key UNIQUE (brother_id, rushee_id);

-- Create brother_event_attendance table to track which brothers attended which events
CREATE TABLE IF NOT EXISTS brother_event_attendance (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  event_id UUID REFERENCES events(id) ON DELETE CASCADE NOT NULL,
  brother_id UUID REFERENCES brothers(id) ON DELETE CASCADE NOT NULL,
  attended_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(event_id, brother_id)
);

-- Enable RLS on brother_event_attendance
ALTER TABLE brother_event_attendance ENABLE ROW LEVEL SECURITY;

-- Brothers can view their own attendance
CREATE POLICY "Brothers can view their own event attendance" ON brother_event_attendance
  FOR SELECT USING (auth.uid() = brother_id);

-- Brothers can create their own attendance records
CREATE POLICY "Brothers can create their own event attendance" ON brother_event_attendance
  FOR INSERT WITH CHECK (auth.uid() = brother_id);

-- Admins can view all brother attendance
CREATE POLICY "Admins can view all brother event attendance" ON brother_event_attendance
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM brothers
      WHERE brothers.id = auth.uid()
      AND brothers.access_level = 'admin'
    )
  );

-- Admins can manage all brother attendance
CREATE POLICY "Admins can manage brother event attendance" ON brother_event_attendance
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM brothers
      WHERE brothers.id = auth.uid()
      AND brothers.access_level = 'admin'
    )
  );

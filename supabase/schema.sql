what-- Alpha Kappa Psi Recruitment Platform Database Schema

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Users table (extends Supabase auth.users)
CREATE TABLE IF NOT EXISTS profiles (
  id UUID REFERENCES auth.users(id) PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  full_name TEXT NOT NULL,
  user_type TEXT NOT NULL CHECK (user_type IN ('rushee', 'brother', 'admin')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Rushee profiles (additional info for rushees)
CREATE TABLE IF NOT EXISTS rushee_profiles (
  id UUID REFERENCES profiles(id) PRIMARY KEY,
  major TEXT,
  year TEXT CHECK (year IN ('Freshman', 'Sophomore', 'Junior', 'Senior', 'Graduate')),
  gpa DECIMAL(3,2),
  phone TEXT,
  photo_url TEXT,
  application_submitted BOOLEAN DEFAULT FALSE,
  application_submitted_at TIMESTAMP WITH TIME ZONE,
  standing TEXT DEFAULT 'In Progress' CHECK (standing IN ('In Progress', 'Event Minimums Met', 'Invite Only (Y)', 'Invite Only (N)', 'Bid (Y)', 'Bid (N)')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Events table
CREATE TABLE IF NOT EXISTS events (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  title TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('Casual', 'Professional')),
  description TEXT,
  date DATE NOT NULL,
  time_start TIME NOT NULL,
  time_end TIME NOT NULL,
  location TEXT NOT NULL,
  status TEXT DEFAULT 'locked' CHECK (status IN ('locked', 'attendance', 'evaluation')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Event attendance (photo check-ins)
CREATE TABLE IF NOT EXISTS event_attendance (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  event_id UUID REFERENCES events(id) ON DELETE CASCADE NOT NULL,
  rushee_id UUID REFERENCES rushee_profiles(id) ON DELETE CASCADE NOT NULL,
  photo_url TEXT NOT NULL,
  check_in_time TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  reviewed_by UUID REFERENCES profiles(id),
  reviewed_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(event_id, rushee_id)
);

-- Applications table
CREATE TABLE IF NOT EXISTS applications (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  rushee_id UUID REFERENCES rushee_profiles(id) ON DELETE CASCADE UNIQUE NOT NULL,
  why_akpsi TEXT NOT NULL,
  career_interests TEXT NOT NULL,
  brother_connection TEXT NOT NULL,
  rushee_connection TEXT NOT NULL,
  personal_description TEXT NOT NULL,
  pillar_resonance TEXT NOT NULL,
  submitted_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Brother-Rushee interactions
CREATE TABLE IF NOT EXISTS interactions (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  brother_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  rushee_id UUID REFERENCES rushee_profiles(id) ON DELETE CASCADE NOT NULL,
  event_id UUID REFERENCES events(id) ON DELETE CASCADE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(brother_id, rushee_id, event_id)
);

-- Evaluations table
CREATE TABLE IF NOT EXISTS evaluations (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  brother_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  rushee_id UUID REFERENCES rushee_profiles(id) ON DELETE CASCADE NOT NULL,
  event_id UUID REFERENCES events(id) ON DELETE CASCADE NOT NULL,
  professional_score INTEGER NOT NULL CHECK (professional_score >= 1 AND professional_score <= 10),
  personal_score INTEGER NOT NULL CHECK (personal_score >= 1 AND personal_score <= 10),
  comments TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(brother_id, rushee_id, event_id)
);

-- Brother notes on rushees
CREATE TABLE IF NOT EXISTS brother_notes (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  brother_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  rushee_id UUID REFERENCES rushee_profiles(id) ON DELETE CASCADE NOT NULL,
  notes TEXT,
  starred BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(brother_id, rushee_id)
);

-- Row Level Security (RLS) Policies

-- Enable RLS on all tables
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE rushee_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE events ENABLE ROW LEVEL SECURITY;
ALTER TABLE event_attendance ENABLE ROW LEVEL SECURITY;
ALTER TABLE applications ENABLE ROW LEVEL SECURITY;
ALTER TABLE interactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE evaluations ENABLE ROW LEVEL SECURITY;
ALTER TABLE brother_notes ENABLE ROW LEVEL SECURITY;

-- Profiles policies
CREATE POLICY "Users can view their own profile" ON profiles
  FOR SELECT USING (auth.uid() = id);

CREATE POLICY "Users can update their own profile" ON profiles
  FOR UPDATE USING (auth.uid() = id);

-- Rushee profiles policies
CREATE POLICY "Rushees can view their own profile" ON rushee_profiles
  FOR SELECT USING (auth.uid() = id);

CREATE POLICY "Rushees can update their own profile" ON rushee_profiles
  FOR UPDATE USING (auth.uid() = id);

CREATE POLICY "Brothers can view all rushee profiles" ON rushee_profiles
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.user_type IN ('brother', 'admin')
    )
  );

CREATE POLICY "Admins can update rushee profiles" ON rushee_profiles
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.user_type = 'admin'
    )
  );

-- Events policies
CREATE POLICY "Everyone can view events" ON events
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Admins can manage events" ON events
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.user_type = 'admin'
    )
  );

-- Event attendance policies
CREATE POLICY "Rushees can view their own attendance" ON event_attendance
  FOR SELECT USING (auth.uid() = rushee_id);

CREATE POLICY "Rushees can create attendance records" ON event_attendance
  FOR INSERT WITH CHECK (auth.uid() = rushee_id);

CREATE POLICY "Brothers and admins can view all attendance" ON event_attendance
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.user_type IN ('brother', 'admin')
    )
  );

CREATE POLICY "Admins can manage attendance" ON event_attendance
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.user_type = 'admin'
    )
  );

-- Applications policies
CREATE POLICY "Rushees can view their own application" ON applications
  FOR SELECT USING (auth.uid() = rushee_id);

CREATE POLICY "Rushees can create their application" ON applications
  FOR INSERT WITH CHECK (auth.uid() = rushee_id);

CREATE POLICY "Rushees can update their own application" ON applications
  FOR UPDATE USING (auth.uid() = rushee_id);

CREATE POLICY "Brothers and admins can view applications" ON applications
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.user_type IN ('brother', 'admin')
    )
  );

-- Interactions policies
CREATE POLICY "Brothers can manage their interactions" ON interactions
  FOR ALL USING (auth.uid() = brother_id);

CREATE POLICY "Admins can view all interactions" ON interactions
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.user_type = 'admin'
    )
  );

-- Evaluations policies
CREATE POLICY "Brothers can manage their own evaluations" ON evaluations
  FOR ALL USING (auth.uid() = brother_id);

CREATE POLICY "Admins can view all evaluations" ON evaluations
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.user_type = 'admin'
    )
  );

-- Brother notes policies
CREATE POLICY "Brothers can manage their own notes" ON brother_notes
  FOR ALL USING (auth.uid() = brother_id);

-- Functions

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Triggers to auto-update updated_at
CREATE TRIGGER update_profiles_updated_at BEFORE UPDATE ON profiles
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_rushee_profiles_updated_at BEFORE UPDATE ON rushee_profiles
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_events_updated_at BEFORE UPDATE ON events
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_applications_updated_at BEFORE UPDATE ON applications
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_evaluations_updated_at BEFORE UPDATE ON evaluations
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_brother_notes_updated_at BEFORE UPDATE ON brother_notes
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Create storage bucket for photos
INSERT INTO storage.buckets (id, name, public)
VALUES ('attendance-photos', 'attendance-photos', false)
ON CONFLICT (id) DO NOTHING;

-- Storage policies for attendance photos
CREATE POLICY "Rushees can upload their attendance photos"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'attendance-photos' AND
  auth.uid()::text = (storage.foldername(name))[1]
);

CREATE POLICY "Users can view attendance photos"
ON storage.objects FOR SELECT
TO authenticated
USING (bucket_id = 'attendance-photos');

CREATE POLICY "Admins can delete attendance photos"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'attendance-photos' AND
  EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.id = auth.uid()
    AND profiles.user_type = 'admin'
  )
);

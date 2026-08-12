-- Supabase Database Schema for AKPsi Recruitment

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- User profiles table (extends Supabase auth.users)
-- account_type: 'broth 'rushee'
-- access_level: for brothers - 'admin', 'recruitment', 'pro', or 'basic'
-- access_level: for rushees - alwayer' ors 'basic'
CREATE TABLE user_profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  account_type TEXT NOT NULL CHECK (account_type IN ('brother', 'rushee')),
  access_level TEXT NOT NULL DEFAULT 'basic' CHECK (access_level IN ('admin', 'recruitment', 'pro', 'basic')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Brothers table (linked to user_profiles)
CREATE TABLE brothers (
  id UUID PRIMARY KEY REFERENCES user_profiles(id) ON DELETE CASCADE,
  email TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  access_level TEXT NOT NULL DEFAULT 'basic' CHECK (access_level IN ('admin', 'recruitment', 'pro', 'basic')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Rushees table (linked to user_profiles)
CREATE TABLE rushees (
  id UUID PRIMARY KEY REFERENCES user_profiles(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  email TEXT UNIQUE NOT NULL,
  major TEXT NOT NULL,
  year TEXT NOT NULL,
  photo TEXT DEFAULT '👤',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Events table
CREATE TABLE events (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  title TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('Casual', 'Professional')),
  date DATE NOT NULL,
  time TEXT NOT NULL,
  accepting_evals BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Event attendance table (many-to-many relationship between rushees and events)
CREATE TABLE event_attendance (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  event_id UUID REFERENCES events(id) ON DELETE CASCADE,
  rushee_id UUID REFERENCES rushees(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(event_id, rushee_id)
);

-- Evaluations table
CREATE TABLE evaluations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  brother_id UUID REFERENCES brothers(id) ON DELETE CASCADE,
  rushee_id UUID REFERENCES rushees(id) ON DELETE CASCADE,
  event_id UUID REFERENCES events(id) ON DELETE SET NULL,
  professional_score INTEGER NOT NULL CHECK (professional_score >= 1 AND professional_score <= 5),
  personal_score INTEGER NOT NULL CHECK (personal_score >= 1 AND personal_score <= 5),
  knows_personally BOOLEAN DEFAULT false,
  qualities TEXT[] DEFAULT '{}',
  comments TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(brother_id, rushee_id, event_id)
);

-- Starred rushees table
CREATE TABLE starred_rushees (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  brother_id UUID REFERENCES brothers(id) ON DELETE CASCADE,
  rushee_id UUID REFERENCES rushees(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(brother_id, rushee_id)
);

-- Personal notes table
CREATE TABLE personal_notes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  brother_id UUID REFERENCES brothers(id) ON DELETE CASCADE,
  rushee_id UUID REFERENCES rushees(id) ON DELETE CASCADE,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(brother_id, rushee_id)
);

-- Create indexes for better query performance
CREATE INDEX idx_event_attendance_event ON event_attendance(event_id);
CREATE INDEX idx_event_attendance_rushee ON event_attendance(rushee_id);
CREATE INDEX idx_evaluations_brother ON evaluations(brother_id);
CREATE INDEX idx_evaluations_rushee ON evaluations(rushee_id);
CREATE INDEX idx_evaluations_event ON evaluations(event_id);
CREATE INDEX idx_starred_rushees_brother ON starred_rushees(brother_id);
CREATE INDEX idx_starred_rushees_rushee ON starred_rushees(rushee_id);
CREATE INDEX idx_personal_notes_brother ON personal_notes(brother_id);
CREATE INDEX idx_personal_notes_rushee ON personal_notes(rushee_id);

-- Enable Row Level Security
ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE brothers ENABLE ROW LEVEL SECURITY;
ALTER TABLE rushees ENABLE ROW LEVEL SECURITY;
ALTER TABLE events ENABLE ROW LEVEL SECURITY;
ALTER TABLE event_attendance ENABLE ROW LEVEL SECURITY;
ALTER TABLE evaluations ENABLE ROW LEVEL SECURITY;
ALTER TABLE starred_rushees ENABLE ROW LEVEL SECURITY;
ALTER TABLE personal_notes ENABLE ROW LEVEL SECURITY;

-- RLS Policies for user_profiles
-- Simple approach: users can only see their own profile
CREATE POLICY "Users can view their own profile" ON user_profiles
  FOR SELECT USING (auth.uid() = id);

CREATE POLICY "Users can insert their own profile" ON user_profiles
  FOR INSERT WITH CHECK (auth.uid() = id);

CREATE POLICY "Users can update their own profile" ON user_profiles
  FOR UPDATE USING (auth.uid() = id);

-- RLS Policies for brothers
-- Any authenticated user can view brothers table (needed to check permissions)
CREATE POLICY "Authenticated users can view brothers" ON brothers
  FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "Users can insert their own brother record" ON brothers
  FOR INSERT WITH CHECK (auth.uid() = id);

-- RLS Policies for rushees
-- Any authenticated user from brothers table can view all rushees
CREATE POLICY "Brothers can view all rushees" ON rushees
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM brothers
      WHERE brothers.id = auth.uid()
    )
  );

CREATE POLICY "Rushees can view their own profile" ON rushees
  FOR SELECT USING (auth.uid() = id);

CREATE POLICY "Users can insert their own rushee record" ON rushees
  FOR INSERT WITH CHECK (auth.uid() = id);

CREATE POLICY "Rushees can update their own profile" ON rushees
  FOR UPDATE USING (auth.uid() = id);

-- RLS Policies for events
CREATE POLICY "Everyone can view events" ON events
  FOR SELECT USING (true);

CREATE POLICY "Only admins can manage events" ON events
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.id = auth.uid()
      AND user_profiles.account_type = 'brother'
      AND user_profiles.access_level = 'admin'
    )
  );

-- RLS Policies for evaluations
CREATE POLICY "Brothers can view their own evaluations" ON evaluations
  FOR SELECT USING (auth.uid() = brother_id);

CREATE POLICY "Brothers can create evaluations" ON evaluations
  FOR INSERT WITH CHECK (auth.uid() = brother_id);

CREATE POLICY "Brothers can update their own evaluations" ON evaluations
  FOR UPDATE USING (auth.uid() = brother_id);

CREATE POLICY "Admins can view all evaluations" ON evaluations
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.id = auth.uid()
      AND user_profiles.account_type = 'brother'
      AND user_profiles.access_level = 'admin'
    )
  );

-- RLS Policies for starred_rushees
CREATE POLICY "Brothers can manage their own starred rushees" ON starred_rushees
  FOR ALL USING (auth.uid() = brother_id);

-- RLS Policies for personal_notes
CREATE POLICY "Brothers can manage their own notes" ON personal_notes
  FOR ALL USING (auth.uid() = brother_id);

-- Insert sample data for testing
-- Note: Users must be created through the signup page (this creates proper auth.users entries)
-- We can only insert data that doesn't require user IDs here

-- Sample events
INSERT INTO events (id, title, type, date, time, accepting_evals) VALUES
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'Meet the Chapter', 'Casual', '2025-01-15', '7:00 PM - 9:00 PM', true),
  ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'Professional Panel', 'Professional', '2025-01-17', '6:30 PM - 8:30 PM', true),
  ('cccccccc-cccc-cccc-cccc-cccccccccccc', 'Game Night', 'Casual', '2025-01-19', '7:00 PM - 9:00 PM', false),
  ('dddddddd-dddd-dddd-dddd-dddddddddddd', 'Coffee Chat', 'Casual', '2025-01-22', '3:00 PM - 5:00 PM', true),
  ('eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee', 'Case Study Workshop', 'Professional', '2025-01-24', '6:00 PM - 8:00 PM', true);

-- To populate with users, brothers, rushees, etc.:
-- 1. Go to /auth/signup in the app
-- 2. Create accounts for brothers and rushees
-- 3. Accounts will automatically create user_profiles, and brother/rushee records

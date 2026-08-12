-- Fix events table RLS policy to allow public access for landing page

-- Drop existing event policies
DROP POLICY IF EXISTS "Everyone can view events" ON events;
DROP POLICY IF EXISTS "Authenticated users can view events" ON events;
DROP POLICY IF EXISTS "Anyone can view events" ON events;

-- Allow public access to view events (landing page is public)
CREATE POLICY "Anyone can view events" ON events
  FOR SELECT USING (true);

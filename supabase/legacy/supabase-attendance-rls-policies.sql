-- Row Level Security policies for event_attendance table
-- Run this in the Supabase SQL Editor

-- Enable RLS on event_attendance table (if not already enabled)
ALTER TABLE event_attendance ENABLE ROW LEVEL SECURITY;

-- Policy: Allow authenticated users to insert their own attendance records
CREATE POLICY "Users can insert their own attendance"
ON event_attendance FOR INSERT
TO authenticated
WITH CHECK (
  rushee_id = auth.uid()
);

-- Policy: Allow authenticated users to view their own attendance records
CREATE POLICY "Users can view their own attendance"
ON event_attendance FOR SELECT
TO authenticated
USING (
  rushee_id = auth.uid()
);

-- Policy: Allow admins/brothers to view all attendance records
-- Note: You may need to adjust this based on how you identify admins
CREATE POLICY "Admins can view all attendance"
ON event_attendance FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM brothers WHERE id = auth.uid()
  )
);

-- Policy: Allow admins/brothers to update attendance records (approve/reject)
CREATE POLICY "Admins can update attendance status"
ON event_attendance FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM brothers WHERE id = auth.uid()
  )
);

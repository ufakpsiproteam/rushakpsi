-- Migration: Add photo_url, status, and timestamps to event_attendance table
-- Run this in the Supabase SQL Editor

-- Add photo_url column to store the uploaded photo
ALTER TABLE event_attendance
ADD COLUMN IF NOT EXISTS photo_url TEXT;

-- Add status column with default 'approved' (approved by default, rejected only if needed)
ALTER TABLE event_attendance
ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'approved'
CHECK (status IN ('pending', 'approved', 'rejected'));

-- Add reviewed_by column to track who reviewed the attendance (store UUID without foreign key)
ALTER TABLE event_attendance
ADD COLUMN IF NOT EXISTS reviewed_by UUID;

-- Add reviewed_at timestamp
ALTER TABLE event_attendance
ADD COLUMN IF NOT EXISTS reviewed_at TIMESTAMP WITH TIME ZONE;

-- Create index on status for better query performance
CREATE INDEX IF NOT EXISTS idx_event_attendance_status ON event_attendance(status);

-- Create index on event_id for better query performance
CREATE INDEX IF NOT EXISTS idx_event_attendance_event_id ON event_attendance(event_id);

-- Update existing records to have approved status if NULL
UPDATE event_attendance SET status = 'approved' WHERE status IS NULL;

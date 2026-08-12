-- Migration: Add status, location, and description fields to events table
-- Run this in the Supabase SQL Editor

-- Add status column with default 'locked'
ALTER TABLE events
ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'locked'
CHECK (status IN ('locked', 'attendance', 'evaluation'));

-- Add location column (optional)
ALTER TABLE events
ADD COLUMN IF NOT EXISTS location TEXT;

-- Add description column (optional)
ALTER TABLE events
ADD COLUMN IF NOT EXISTS description TEXT;

-- Create index on status for better query performance
CREATE INDEX IF NOT EXISTS idx_events_status ON events(status);

-- Update existing events to have locked status if NULL
UPDATE events SET status = 'locked' WHERE status IS NULL;

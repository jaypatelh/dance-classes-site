-- Migration: Add visitor_id tracking
-- Run this in your Supabase SQL Editor

-- Add visitor_id column to events table
ALTER TABLE events ADD COLUMN IF NOT EXISTS visitor_id TEXT;

-- Add visitor_id column to sessions table  
ALTER TABLE sessions ADD COLUMN IF NOT EXISTS visitor_id TEXT;

-- Create indexes for faster queries by visitor_id
CREATE INDEX IF NOT EXISTS idx_events_visitor_id ON events(visitor_id);
CREATE INDEX IF NOT EXISTS idx_sessions_visitor_id ON sessions(visitor_id);

-- Verify the changes
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'events' AND column_name = 'visitor_id';

SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'sessions' AND column_name = 'visitor_id';

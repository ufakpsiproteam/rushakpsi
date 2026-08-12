-- Migration: Add UF Address and Brother Connection fields to applications table
-- Date: 2026-01-22

-- Add UF Address field
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                 WHERE table_name='applications' AND column_name='uf_address') THEN
    ALTER TABLE applications ADD COLUMN uf_address TEXT;
  END IF;
END $$;

-- Add Brother Connection Reason field
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                 WHERE table_name='applications' AND column_name='brother_connection_reason') THEN
    ALTER TABLE applications ADD COLUMN brother_connection_reason TEXT;
  END IF;
END $$;

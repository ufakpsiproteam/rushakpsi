-- Step 1: Add the new enum value 'professional_team'
-- This must be in its own transaction and committed before it can be used

ALTER TYPE brother_role ADD VALUE IF NOT EXISTS 'professional_team';

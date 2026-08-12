-- Step 2: Update any existing 'pro_advisor' records to 'professional_team'
-- This runs AFTER the enum value has been committed

UPDATE brother_roles
SET role = 'professional_team'
WHERE role = 'pro_advisor'

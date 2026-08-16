-- ---------------------------------------------------------------------
-- Brother invite kill switch
--
-- Adds settings.invites.brother_signup_enabled to the existing app_config
-- row (see 20260811_prd_alignment.sql). Defaults to true so behavior is
-- unchanged until an admin flips it off from /admin/brothers. Enforcement
-- happens entirely in app code (app/api/invites/*) before any write to
-- brother_invites/brothers/auth.users — this key only holds the flag.
-- ---------------------------------------------------------------------

UPDATE app_config
SET settings = jsonb_set(settings, '{invites,brother_signup_enabled}', 'true', true)
WHERE id = true;

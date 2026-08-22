-- Bid-night voting was never built into a UI (no controller, voter view, or
-- session screen anywhere in app/) and lib/bid-night/votingLogic.ts, the
-- only code that ever referenced these objects, had zero consumers. Product
-- decision (2026-08-22): bid-night voting is not needed. Confirmed via
-- repo-wide grep and a live FK check that nothing else references these
-- tables before dropping.
DROP TRIGGER IF EXISTS trigger_update_vote_counts ON votes;
DROP FUNCTION IF EXISTS update_vote_counts();
DROP FUNCTION IF EXISTS calculate_voting_threshold(INT);
DROP TABLE IF EXISTS votes;
DROP TABLE IF EXISTS session_rushees;
DROP TABLE IF EXISTS voting_sessions;

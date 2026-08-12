-- This project's ALTER DEFAULT PRIVILEGES baseline (see CLAUDE.md)
-- grants EXECUTE directly to anon/authenticated/service_role at
-- function-creation time (confirmed via pg_proc.proacl showing
-- anon=X/postgres — a REVOKE ... FROM PUBLIC does nothing against a
-- direct grant like that). Every interview RPC, including the
-- trigger-only guard functions, was directly callable by anon via
-- /rest/v1/rpc/*. Flagged by get_advisors(security) immediately after
-- applying 20260812_interviews.sql; verified fixed via
-- has_function_privilege('anon', ..., 'EXECUTE') = false below.

REVOKE EXECUTE ON FUNCTION fn_guard_duplicate_interview() FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION fn_guard_panelist_lock() FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION fn_guard_interview_answer() FROM anon, authenticated;

REVOKE EXECUTE ON FUNCTION
  fn_can_manage_interviews(), fn_can_read_interviews(), fn_try_complete_interview(UUID),
  fn_start_interview(INTERVIEW_TYPE, UUID[], JSONB),
  fn_reassign_panelist(UUID, UUID, UUID, UUID), fn_drop_rushee(UUID, UUID),
  fn_remove_panelist(UUID, UUID, UUID), fn_cancel_interview(UUID, TEXT),
  fn_submit_assignment(UUID, UUID, SMALLINT, TEXT),
  fn_flag_casual_conflict(UUID, UUID), fn_flag_professional_conflict(UUID, UUID),
  fn_interview_progress()
  FROM anon;

GRANT EXECUTE ON FUNCTION
  fn_can_manage_interviews(), fn_can_read_interviews(), fn_try_complete_interview(UUID),
  fn_start_interview(INTERVIEW_TYPE, UUID[], JSONB),
  fn_reassign_panelist(UUID, UUID, UUID, UUID), fn_drop_rushee(UUID, UUID),
  fn_remove_panelist(UUID, UUID, UUID), fn_cancel_interview(UUID, TEXT),
  fn_submit_assignment(UUID, UUID, SMALLINT, TEXT),
  fn_flag_casual_conflict(UUID, UUID), fn_flag_professional_conflict(UUID, UUID),
  fn_interview_progress()
  TO authenticated;

-- service_role keeps EXECUTE (untouched above) — the auth.uid() IS
-- NULL bypass inside each function's authorization check exists
-- specifically so administrative/seed code using the service client
-- can call these; service_role already bypasses RLS everywhere else
-- in this project, so this is not a new privilege boundary.

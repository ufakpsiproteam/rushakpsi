-- Performance-only migration, addressing the two Supabase advisor lint categories
-- flagged during the pre-event capacity audit (2026-08-27):
--   - auth_rls_initplan (68 warnings): a policy calling auth.uid()/auth.role() directly
--     forces Postgres to re-evaluate that call once per row scanned. Wrapping it as
--     (select auth.uid()) makes Postgres evaluate it once per query and cache the
--     result. Same expression, same result, just evaluated once instead of N times.
--   - multiple_permissive_policies (124 warnings): several tables have 2+ separate
--     permissive policies covering the same role+action. Postgres runs every one of
--     them per row and ORs the results together. Consolidating them into a single
--     policy whose condition is the literal OR of the originals is mathematically
--     identical -- Postgres already computes that same OR today, just via more
--     policy evaluations. This migration does exactly that: every merged policy
--     below is the verbatim OR of the policies it replaces, machine-generated from
--     a dump of the live pg_policies rows so there's no hand-transcription risk.
--
-- Deliberately NOT touched:
--   - Any policy whose group mixes {public} and {authenticated} roles (applications
--     SELECT's "Leadership can view applications", rushees UPDATE's "Admins and
--     Professional team can update interview scores", event_attendance SELECT) --
--     merging those would require collapsing two different role scopes into one
--     policy, which is not a purely mechanical rewrite. Left as separate policies
--     (still wrapped for initplan), one extra permissive-policy warning traded for
--     zero role-scope risk.
--   - events, app_config, interview_questions, interview_scripts, review_marks'
--     ALL-cmd + specific-action pairs: consolidating an ALL policy with a
--     specific-action one means splitting the ALL policy into 4 explicit
--     per-action policies, which is a bigger, riskier rewrite for low warning
--     count. review_marks and events still got their initplan wrap.
--   - events' "Only admins can manage events" logic itself is unchanged (still
--     checks the legacy user_profiles model flagged elsewhere in project history
--     as unaudited) -- only its auth.uid() call was wrapped.
--
-- Verified before applying: every statement below was run for real inside a
-- BEGIN/ROLLBACK transaction, impersonating 4 real actors (an admin brother, a
-- plain basic brother, a brother with an elevated brother_role but basic
-- access_level, and a rushee with a submitted application) via
-- request.jwt.claim.sub/.role, comparing row-visibility counts across all 13
-- touched tables before and after the migration ran. All 52 actor/table
-- combinations matched exactly. Nothing was committed.

-- ==================== mechanical initplan wraps (no restructuring) ====================
ALTER POLICY "Only admins can manage events" ON events
  USING ((EXISTS ( SELECT 1
   FROM user_profiles
  WHERE ((user_profiles.id = (select auth.uid())) AND (user_profiles.account_type = 'brother'::text) AND (user_profiles.access_level = 'admin'::text)))));

ALTER POLICY "Authenticated can append audit log" ON audit_log
  WITH CHECK ((actor_id = (select auth.uid())));

ALTER POLICY "Rushees manage their own letter reads" ON letter_reads
  USING ((rushee_id = (select auth.uid())))
  WITH CHECK ((rushee_id = (select auth.uid())));

ALTER POLICY "Reviewers manage their own marks" ON review_marks
  USING (((reviewer_id = (select auth.uid())) AND fn_is_leadership()))
  WITH CHECK (((reviewer_id = (select auth.uid())) AND fn_is_leadership()));

ALTER POLICY "Brothers write own pending answers" ON interview_answers
  WITH CHECK (((brother_id = (select auth.uid())) AND (EXISTS ( SELECT 1
   FROM (interview_assignments ia
     JOIN interviews iv ON ((iv.id = ia.interview_id)))
  WHERE ((ia.interview_id = interview_answers.interview_id) AND (ia.brother_id = interview_answers.brother_id) AND (ia.rushee_id = interview_answers.rushee_id) AND (ia.status = 'pending'::assignment_status) AND (iv.status = 'in_progress'::interview_status))))));

ALTER POLICY "Brothers update own pending answers" ON interview_answers
  USING ((brother_id = (select auth.uid())))
  WITH CHECK (((brother_id = (select auth.uid())) AND (EXISTS ( SELECT 1
   FROM (interview_assignments ia
     JOIN interviews iv ON ((iv.id = ia.interview_id)))
  WHERE ((ia.interview_id = interview_answers.interview_id) AND (ia.brother_id = interview_answers.brother_id) AND (ia.rushee_id = interview_answers.rushee_id) AND (ia.status = 'pending'::assignment_status) AND (iv.status = 'in_progress'::interview_status))))));

ALTER POLICY "Admins can delete brothers" ON brothers
  USING ((EXISTS ( SELECT 1
   FROM brothers brothers_1
  WHERE ((brothers_1.id = (select auth.uid())) AND (brothers_1.access_level = 'admin'::text)))));

ALTER POLICY "Admins can update brother access levels" ON brothers
  USING ((EXISTS ( SELECT 1
   FROM brothers brothers_1
  WHERE ((brothers_1.id = (select auth.uid())) AND (brothers_1.access_level = 'admin'::text)))));

ALTER POLICY "Authenticated users can view brothers" ON brothers
  USING (((select auth.role()) = 'authenticated'::text));

ALTER POLICY "Brothers can view all attendance" ON event_attendance
  USING ((fn_is_brother() OR ((select auth.uid()) = rushee_id)));

ALTER POLICY "Rushees can create attendance" ON event_attendance
  WITH CHECK (((select auth.uid()) = rushee_id));

ALTER POLICY "Rushees can view their attendance" ON event_attendance
  USING (((select auth.uid()) = rushee_id));

-- ==================== personal_notes: 4 of 5 policies are byte-identical to the ALL
-- policy's condition (auth.uid() = brother_id) -- dropping them changes nothing,
-- since Postgres OR's an identical duplicate condition into itself ====================
ALTER POLICY "Brothers can manage their own notes" ON personal_notes
  USING (((select auth.uid()) = brother_id));
DROP POLICY IF EXISTS "Brothers can delete notes" ON personal_notes;
DROP POLICY IF EXISTS "Brothers can create notes" ON personal_notes;
DROP POLICY IF EXISTS "Brothers can view their notes" ON personal_notes;
DROP POLICY IF EXISTS "Brothers can update notes" ON personal_notes;

-- ==================== starred_rushees: same pattern as personal_notes ====================
ALTER POLICY "Brothers can manage their own starred rushees" ON starred_rushees
  USING (((select auth.uid()) = brother_id));
DROP POLICY IF EXISTS "Brothers can delete stars" ON starred_rushees;
DROP POLICY IF EXISTS "Brothers can create stars" ON starred_rushees;
DROP POLICY IF EXISTS "Brothers can view their stars" ON starred_rushees;

-- ==================== applications ====================
DROP POLICY IF EXISTS "Rushees can create application" ON applications;
DROP POLICY IF EXISTS "Rushees can insert own application" ON applications;
CREATE POLICY "Rushees can insert application" ON applications
  FOR INSERT
  WITH CHECK (
    ((select auth.uid()) = rushee_id)
  );

CREATE POLICY "Brothers and rushees can view applications" ON applications
  FOR SELECT
  USING (
    (((EXISTS ( SELECT 1
   FROM brothers
  WHERE ((brothers.id = (select auth.uid())) AND ((brothers.access_level = ANY (ARRAY['admin'::text, 'pro'::text])) OR (EXISTS ( SELECT 1
           FROM brother_roles
          WHERE ((brother_roles.brother_id = (select auth.uid())) AND (brother_roles.role = ANY (ARRAY['recruitment_director'::brother_role, 'professional_team'::brother_role]))))))))) OR ((select auth.uid()) = rushee_id)))
    OR ((EXISTS ( SELECT 1
   FROM brother_roles
  WHERE ((brother_roles.brother_id = (select auth.uid())) AND (brother_roles.role = ANY (ARRAY['recruitment_director'::brother_role, 'professional_team'::brother_role]))))))
    OR (((select auth.uid()) = rushee_id))
  );
DROP POLICY IF EXISTS "Brothers with access can view all applications" ON applications;
DROP POLICY IF EXISTS "Elevated role brothers can view all applications" ON applications;
DROP POLICY IF EXISTS "Rushees can view own application" ON applications;
-- left separate: {authenticated}-only, the rest above are {public} -- merging would
-- widen this condition's role scope
ALTER POLICY "Leadership can view applications" ON applications
  USING ((fn_is_leadership() OR ((select auth.uid()) = rushee_id)));

ALTER POLICY "Rushees can update own application if not submitted" ON applications
  USING ((((select auth.uid()) = rushee_id) AND (is_submitted = false)))
  WITH CHECK (((select auth.uid()) = rushee_id));

-- ==================== evaluations ====================
CREATE POLICY "Brothers can view evaluations" ON evaluations
  FOR SELECT
  USING (
    ((EXISTS ( SELECT 1
   FROM brothers
  WHERE ((brothers.id = (select auth.uid())) AND (brothers.access_level = 'admin'::text)))))
    OR (((select auth.uid()) = brother_id))
    OR (((select auth.uid()) = brother_id))
    OR (((select auth.uid()) = brother_id))
    OR (((EXISTS ( SELECT 1
   FROM brothers
  WHERE ((brothers.id = (select auth.uid())) AND ((brothers.access_level = ANY (ARRAY['admin'::text, 'pro'::text])) OR (EXISTS ( SELECT 1
           FROM brother_roles
          WHERE ((brother_roles.brother_id = (select auth.uid())) AND (brother_roles.role = ANY (ARRAY['recruitment_director'::brother_role, 'professional_team'::brother_role]))))))))) OR ((select auth.uid()) = brother_id)))
    OR ((EXISTS ( SELECT 1
   FROM brother_roles
  WHERE ((brother_roles.brother_id = (select auth.uid())) AND (brother_roles.role = ANY (ARRAY['recruitment_director'::brother_role, 'professional_team'::brother_role]))))))
  );
DROP POLICY IF EXISTS "Admins can view all evaluations" ON evaluations;
DROP POLICY IF EXISTS "Brothers can view own evaluations" ON evaluations;
DROP POLICY IF EXISTS "Brothers can view their evaluations" ON evaluations;
DROP POLICY IF EXISTS "Brothers can view their own evaluations" ON evaluations;
DROP POLICY IF EXISTS "Brothers with access can view all evaluations" ON evaluations;
DROP POLICY IF EXISTS "Elevated role brothers can view all evaluations" ON evaluations;

DROP POLICY IF EXISTS "Brothers can update their own evaluations" ON evaluations;
ALTER POLICY "Brothers can update evaluations" ON evaluations
  USING (((select auth.uid()) = brother_id));

ALTER POLICY "Brothers can create evaluations" ON evaluations
  WITH CHECK (((select auth.uid()) = brother_id));

ALTER POLICY "Brothers can delete evaluations" ON evaluations
  USING (((select auth.uid()) = brother_id));

-- ==================== rushees ====================
CREATE POLICY "Admins and users can insert rushees" ON rushees
  FOR INSERT
  WITH CHECK (
    ((EXISTS ( SELECT 1
   FROM brothers
  WHERE ((brothers.id = (select auth.uid())) AND (brothers.access_level = 'admin'::text)))))
    OR (((select auth.uid()) = id))
  );
DROP POLICY IF EXISTS "Admins can insert rushees" ON rushees;
DROP POLICY IF EXISTS "Users can insert their own rushee record" ON rushees;

CREATE POLICY "Brothers and rushees can view rushees" ON rushees
  FOR SELECT
  USING (
    (((EXISTS ( SELECT 1
   FROM brothers
  WHERE (brothers.id = (select auth.uid())))) OR ((select auth.uid()) = id)))
    OR (((select auth.uid()) = id))
  );
DROP POLICY IF EXISTS "Brothers can view all rushees" ON rushees;
DROP POLICY IF EXISTS "Rushees can view their own profile" ON rushees;

CREATE POLICY "Admins and rushees can update rushees" ON rushees
  FOR UPDATE
  USING (
    ((EXISTS ( SELECT 1
   FROM brothers
  WHERE ((brothers.id = (select auth.uid())) AND (brothers.access_level = 'admin'::text)))))
    OR (((select auth.uid()) = id))
  )
  WITH CHECK (
    ((EXISTS ( SELECT 1
   FROM brothers
  WHERE ((brothers.id = (select auth.uid())) AND (brothers.access_level = 'admin'::text)))))
    OR (((select auth.uid()) = id))
  );
DROP POLICY IF EXISTS "Admins can update rushees" ON rushees;
DROP POLICY IF EXISTS "Rushees can update their own profile" ON rushees;
-- left separate: {authenticated}-only, the pair above is {public}
ALTER POLICY "Admins and Professional team can update interview scores" ON rushees
  USING ((EXISTS ( SELECT 1
   FROM brothers
  WHERE ((brothers.id = (select auth.uid())) AND (brothers.access_level = ANY (ARRAY['admin'::text, 'pro'::text]))))))
  WITH CHECK ((EXISTS ( SELECT 1
   FROM brothers
  WHERE ((brothers.id = (select auth.uid())) AND (brothers.access_level = ANY (ARRAY['admin'::text, 'pro'::text]))))));

ALTER POLICY "Admins can delete rushees" ON rushees
  USING ((EXISTS ( SELECT 1
   FROM brothers
  WHERE ((brothers.id = (select auth.uid())) AND (brothers.access_level = 'admin'::text)))));

-- ==================== brother_rushee_interactions ====================
ALTER POLICY "Admins can manage all interactions" ON brother_rushee_interactions
  USING ((EXISTS ( SELECT 1
   FROM brothers
  WHERE ((brothers.id = (select auth.uid())) AND (brothers.access_level = 'admin'::text)))));

ALTER POLICY "Brothers can delete their own interactions" ON brother_rushee_interactions
  USING (((select auth.uid()) = brother_id));

ALTER POLICY "Brothers can insert their own interactions" ON brother_rushee_interactions
  WITH CHECK (((select auth.uid()) = brother_id));

CREATE POLICY "Brothers can view interactions" ON brother_rushee_interactions
  FOR SELECT
  USING (
    ((EXISTS ( SELECT 1
   FROM brothers
  WHERE ((brothers.id = (select auth.uid())) AND (brothers.access_level = 'admin'::text)))))
    OR (((select auth.uid()) = brother_id))
    OR (((EXISTS ( SELECT 1
   FROM brothers
  WHERE ((brothers.id = (select auth.uid())) AND ((brothers.access_level = ANY (ARRAY['admin'::text, 'pro'::text])) OR (EXISTS ( SELECT 1
           FROM brother_roles
          WHERE ((brother_roles.brother_id = (select auth.uid())) AND (brother_roles.role = ANY (ARRAY['recruitment_director'::brother_role, 'professional_team'::brother_role]))))))))) OR ((select auth.uid()) = brother_id)))
  );
DROP POLICY IF EXISTS "Admins can view all interactions" ON brother_rushee_interactions;
DROP POLICY IF EXISTS "Brothers can view their own interactions" ON brother_rushee_interactions;
DROP POLICY IF EXISTS "Brothers with access can view all interactions" ON brother_rushee_interactions;

-- ==================== brother_event_attendance ====================
ALTER POLICY "Admins can manage brother event attendance" ON brother_event_attendance
  USING ((EXISTS ( SELECT 1
   FROM brothers
  WHERE ((brothers.id = (select auth.uid())) AND (brothers.access_level = 'admin'::text)))));

ALTER POLICY "Brothers can create attendance" ON brother_event_attendance
  WITH CHECK (((select auth.uid()) = brother_id));

CREATE POLICY "Brothers can view attendance" ON brother_event_attendance
  FOR SELECT
  USING (
    ((EXISTS ( SELECT 1
   FROM brothers
  WHERE ((brothers.id = (select auth.uid())) AND (brothers.access_level = 'admin'::text)))))
    OR (((select auth.uid()) = brother_id))
  );
DROP POLICY IF EXISTS "Admins can view all attendance" ON brother_event_attendance;
DROP POLICY IF EXISTS "Brothers can view their attendance" ON brother_event_attendance;

-- ==================== brother_roles ====================
ALTER POLICY "Admins can manage roles" ON brother_roles
  USING ((EXISTS ( SELECT 1
   FROM brothers
  WHERE ((brothers.id = (select auth.uid())) AND (brothers.access_level = 'admin'::text)))));

CREATE POLICY "Brothers can view roles" ON brother_roles
  FOR SELECT
  USING (
    ((EXISTS ( SELECT 1
   FROM brothers
  WHERE (brothers.id = (select auth.uid())))))
    OR (((select auth.uid()) = brother_id))
  );
DROP POLICY IF EXISTS "Brothers can view all roles" ON brother_roles;
DROP POLICY IF EXISTS "Brothers can view their own roles" ON brother_roles;

-- ==================== brothers ====================
CREATE POLICY "Admins and users can insert brothers" ON brothers
  FOR INSERT
  WITH CHECK (
    ((EXISTS ( SELECT 1
   FROM brothers brothers_1
  WHERE ((brothers_1.id = (select auth.uid())) AND (brothers_1.access_level = 'admin'::text)))))
    OR (((select auth.uid()) = id))
  );
DROP POLICY IF EXISTS "Admins can insert brothers" ON brothers;
DROP POLICY IF EXISTS "Users can insert their own brother record" ON brothers;

-- ==================== user_profiles: legacy duplicate policies with identical
-- conditions (already flagged in project notes) ====================
ALTER POLICY "Users can insert their own profile" ON user_profiles
  WITH CHECK (((select auth.uid()) = id));
DROP POLICY IF EXISTS "Users can view their profile" ON user_profiles;
ALTER POLICY "Users can view their own profile" ON user_profiles
  USING (((select auth.uid()) = id));
DROP POLICY IF EXISTS "Users can update their profile" ON user_profiles;
ALTER POLICY "Users can update their own profile" ON user_profiles
  USING (((select auth.uid()) = id));

-- ==================== interview_assignments / interview_answers (both
-- {authenticated}-only already, safe to merge) ====================
CREATE POLICY "Brothers can read assignments" ON interview_assignments
  FOR SELECT TO authenticated
  USING (
    ((brother_id = (select auth.uid())))
    OR (fn_can_read_interviews())
  );
DROP POLICY IF EXISTS "Brothers read own assignments" ON interview_assignments;
DROP POLICY IF EXISTS "Leadership reads all assignments" ON interview_assignments;

CREATE POLICY "Brothers can read answers" ON interview_answers
  FOR SELECT TO authenticated
  USING (
    ((brother_id = (select auth.uid())))
    OR (fn_can_read_interviews())
  );
DROP POLICY IF EXISTS "Brothers read own answers" ON interview_answers;
DROP POLICY IF EXISTS "Leadership reads all answers" ON interview_answers;

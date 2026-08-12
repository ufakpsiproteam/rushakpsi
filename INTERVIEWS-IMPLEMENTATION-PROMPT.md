# Feature: In-platform casual and professional interviews

Implement interviews inside the AKPsi Recruitment Platform. Today interview scores are typed in by hand on `/admin/interviews` after being collected on paper and Google Forms. This feature moves the entire interview into the app: a panel of brothers runs a scripted, question-by-question interview on their phones, scores each answer against a rubric, and the platform computes the rushee's interview scores automatically.

Read the PRD first. This feature modifies **§5.6 R37**, **§6.5.1**, **§6.6.1**, **§6.7.4**, **§6.7.5**, **§7.2 `rushee_interviews`**, **§7.3 enums**, **§7.6 audited actions**, **§7.8 derived views**, and **Appendix A**. Everything else in the PRD holds, in particular **S1 through S12**: RLS is the security boundary, every privileged mutation is audited, and no UI-only guard counts as a control.

Seed data for both question sets, rubrics, and scripts is in `interview-seed.json`.

---

## 1. Concepts

- An **interview** is one session: one panel of brothers, one or more rushees, one type (casual or professional).
- An **assignment** is one brother scoring one rushee inside that interview. It is the unit of work, and it maps exactly to one paper rubric. **This is the central object.**
- Brother-to-rushee is **many-to-many**. A brother may be assigned two rushees when there are more rushees than brothers. Two or more brothers may be assigned the same rushee when there are more brothers than rushees.
- Casual sessions typically run 3 rushees and 3 brothers. Professional sessions run 1 rushee and up to 3 brothers. Both may run smaller. Do not hardcode either number.

**Score totals** (these already match R37, do not change the R37 ranges):

| Type | Per-question | Total | Recommendation |
|---|---|---|---|
| Casual | Q1-Q5: 0 / 0.5 / 1 / 1.5. Q6: 0 or 2.5. Q7 unscored yes/no | **0 to 10** | 1 to 5 |
| Professional | Q1-Q6: 0 / 1 / 2 / 3. Q7: 0 / 1 / 2 | **0 to 20** | 1 to 5 |

Score options are **per question**, not per type. Q5 casual has three tiers, Q7 professional has three tiers, casual Q6 has two. Never assume a uniform scale.

---

## 2. Schema

Four new tables. Follow the existing conventions in §7: UUID PKs, `cycle_id` on cycle-scoped data, `TIMESTAMPTZ`, forward-only migrations.

```sql
CREATE TYPE interview_type   AS ENUM ('casual', 'professional');
CREATE TYPE interview_status AS ENUM ('in_progress', 'completed', 'cancelled');
CREATE TYPE assignment_status AS ENUM ('pending', 'submitted', 'removed');

-- Configuration. Questions are data, per PRD principle 3. Same pattern as application_questions.
CREATE TABLE interview_questions (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cycle_id      UUID NOT NULL REFERENCES cycles(id) ON DELETE CASCADE,
  type          interview_type NOT NULL,
  order_index   INT NOT NULL,
  prompt        TEXT NOT NULL,
  help_text     TEXT,
  is_scored     BOOLEAN NOT NULL DEFAULT true,
  field_type    TEXT NOT NULL DEFAULT 'score_notes',  -- 'score_notes' | 'yes_no'
  score_options JSONB,        -- [{ value, label, descriptors[] }], descending by value
  timer_seconds INT,          -- optional advisory timer, e.g. professional Q6
  notes_required BOOLEAN NOT NULL DEFAULT true,
  UNIQUE (cycle_id, type, order_index)
);

-- The session.
CREATE TABLE interviews (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cycle_id      UUID NOT NULL REFERENCES cycles(id) ON DELETE CASCADE,
  type          interview_type NOT NULL,
  status        interview_status NOT NULL DEFAULT 'in_progress',
  started_by    UUID NOT NULL REFERENCES profiles(id),
  started_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at  TIMESTAMPTZ,
  cancelled_by  UUID REFERENCES profiles(id),
  cancelled_at  TIMESTAMPTZ,
  cancel_reason TEXT
);

-- One rubric: one brother scoring one rushee in one interview.
CREATE TABLE interview_assignments (
  interview_id         UUID NOT NULL REFERENCES interviews(id) ON DELETE CASCADE,
  brother_id           UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  rushee_id            UUID NOT NULL REFERENCES rushees(id) ON DELETE CASCADE,
  status               assignment_status NOT NULL DEFAULT 'pending',
  knows_personally     BOOLEAN NOT NULL DEFAULT false,
  conflict_flagged_at  TIMESTAMPTZ,
  recommendation       SMALLINT CHECK (recommendation BETWEEN 1 AND 5),
  recommendation_notes TEXT,
  submitted_at         TIMESTAMPTZ,
  removed_by           UUID REFERENCES profiles(id),
  removed_at           TIMESTAMPTZ,
  created_at           TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (interview_id, brother_id, rushee_id),
  CHECK (status <> 'submitted' OR (recommendation IS NOT NULL AND submitted_at IS NOT NULL))
);

-- One answer within one rubric.
CREATE TABLE interview_answers (
  interview_id UUID NOT NULL,
  brother_id   UUID NOT NULL,
  rushee_id    UUID NOT NULL,
  question_id  UUID NOT NULL REFERENCES interview_questions(id),
  score        NUMERIC(3,1),
  yes_no       BOOLEAN,
  notes        TEXT,
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (interview_id, brother_id, rushee_id, question_id),
  FOREIGN KEY (interview_id, brother_id, rushee_id)
    REFERENCES interview_assignments (interview_id, brother_id, rushee_id) ON DELETE CASCADE
);
```

**Do not** add a per-question column to any table, and do not store panelists or rushees as arrays. The question count changes every semester and the many-to-many above cannot be flattened.

**Guard against duplicate sessions:**
```sql
CREATE UNIQUE INDEX one_live_interview_per_rushee_type
  ON interview_assignments (interview_id, rushee_id);  -- not sufficient alone, see below
```
The real constraint is: a rushee may not appear in two interviews of the same type that are `in_progress` within the same cycle. Enforce with a partial unique index over a generated helper, or a `BEFORE INSERT` trigger on `interview_assignments` that checks for an existing `in_progress` interview of that type containing that rushee. A trigger is acceptable here; a UI check alone is not.

**Score validation trigger.** On insert or update of `interview_answers`, verify the score is one of the `value` entries in that question's `score_options`, and that the question belongs to the same type as the interview. Reject otherwise. Do not validate score ranges in the client only.

---

## 3. Replacing `rushee_interviews`

Drop the `rushee_interviews` table. Replace it with a view so §6.5, §6.6, and §6.7.4 keep working:

```sql
CREATE VIEW v_rushee_interviews AS
-- per rushee, per cycle:
--   casual_score        = AVG(total) over submitted casual assignments
--   casual_n            = COUNT of those assignments
--   casual_recommendation = AVG(recommendation) over the same set
--   professional_score, professional_n, professional_recommendation likewise
--   invite_only_available = the yes_no answer from casual Q7, most recent submitted
-- where total = SUM(score) over that assignment's scored answers
```

Rules:
- **Only `submitted` assignments count.** `pending` and `removed` contribute nothing. This mirrors R3.
- Every average is displayed with its evidence count, exactly like R36: `14.5 / 20 (n=3)`.
- A total of `0` is meaningful and must be visually distinct from "no interview yet." R37 already requires this.
- Round to one decimal for display only.

**Downstream changes:**
- **§6.5.1 review board** and **§6.5.3 detail view**: interview scores now read from the view, with evidence counts, and expose per-panelist breakdown (each panelist's total, recommendation, per-question scores, and notes) to leadership.
- **§6.6.1 bid night deck**: the interview panel reads averages from the view. Per-question notes are the richest evaluation content the chapter has, so surface them on the slide.
- **§6.7.4 standings**: interview columns read from the view.
- **§6.7.5 `/admin/interviews`**: the manual entry form is **removed**. That page becomes the interview grid described below. An interview conducted offline is entered by an admin starting an interview and completing a rubric normally.

The `ai_summary` column currently on `rushee_interviews` is being removed from the product separately. Do not carry it into the view.

---

## 4. Interview tab (`/brother/interviews`)

Visible to **all brothers**. New nav entry in the brother portal (§6.4.1) and in the admin nav.

A table of every rushee in the active cycle who is eligible for interviews, with two status columns, Casual and Professional:

| State | Display | Who sees the action |
|---|---|---|
| No interview | `✗` | Leadership: hover or tap reveals **Start Interview** |
| Interview `in_progress` | **In Progress** pill | Assigned panelists see **Enter Interview**. Leadership sees **Manage**. |
| All assignments submitted or removed, at least one submitted | `✓` | Leadership: **View** |
| Cancelled | back to `✗` | as above |

Regular brothers see the rushee's name, photo, major, year, and the check or X only. **They must not be able to read scores, recommendations, notes, or averages for any rushee, including ones they interviewed.** This is an RLS policy, not a hidden column. A regular brother may read back their own submitted rubric.

"Leadership" throughout this document means `admin`, `recruitment_director`, or `professional_team`, matching §3.2's interview permissions.

**No push notification and no realtime.** A panelist finds their interview by opening this tab and clicking Enter. Refresh on mount and on window focus, the same pattern §6.4.6 already uses.

### Starting an interview

Leadership clicks Start Interview on a rushee with an `✗`. A setup sheet opens:

1. **Rushees.** Pre-filled with the clicked rushee. Casual allows adding more, up to the configured maximum, default 3. Professional defaults to 1 but is not hard-capped.
2. **Panelists.** Search and add brothers.
3. **Assignments.** A grid of panelist rows against rushee columns. Each panelist gets one or more rushees. Each rushee needs at least one panelist. The starter may assign themselves.

Validation before the interview can be created:
- Every rushee has at least one panelist.
- Every panelist has at least one rushee.
- No panelist has a pending assignment in another interview (see §6).
- No selected rushee is already in an `in_progress` interview of this type.

On create, write the `interviews` row and all `interview_assignments` rows in **one transaction**, and audit `interview.start`.

### Managing a live interview

Leadership opens **Manage** on an in-progress interview and can:

- **Reassign** a panelist to a different rushee, while that panelist's assignment is still `pending`. Reassigning discards that assignment's answers, with a confirm dialog saying so.
- **Drop a rushee** from the interview. Their assignments become `removed`. If dropping would leave a panelist with nothing, remove that panelist too.
- **Remove a panelist**, before or after they submit. Removing after submission voids their rubric: set `status = 'removed'`, keep the rows, exclude them from all averages. Never hard-delete.
- **Cancel the interview.** Requires a typed confirmation and a reason. Sets `status = 'cancelled'`, releases every panelist's lock, and returns the rushees to `✗`. This is the recovery path for starting on the wrong rushee.
- **See submission status** per panelist: pending, submitted with timestamp, or removed.

Admins can do all of the above at any time, including on a `completed` interview. Recruitment directors and professional team can do all of the above on an `in_progress` interview and can remove a panelist from a completed one.

Audit every one of these: `interview.reassign`, `interview.rushee_drop`, `interview.panelist_remove`, `interview.cancel`.

---

## 5. Interview mode (`/brother/interview/[interviewId]`)

A focused, full-screen flow. No portal nav, no tab bar.

**Screen sequence:**

1. **Opening script.** Type-specific, from cycle content. Shows the interviewer notes and the rushee this brother is scoring. Button: Begin.
2. **Question screens, one per question**, in `order_index` order. Each shows:
   - The rushee's name, prominently and persistently, in the header. A brother scoring two rushees must never be confused about which rubric they are in.
   - Question number and total, `Question 3 of 7`.
   - The prompt and help text.
   - The rubric: every tier with its label, point value, and descriptor bullets, collapsible so the notes field stays reachable on a phone.
   - A score selector built from `score_options`. Nothing pre-selected.
   - A notes textarea with a live character counter, consistent with R29.
   - An optional advisory countdown where `timer_seconds` is set. Advisory only, never blocking, same treatment as R48.
   - Back and Next. Back is enabled from question 2 onward.
3. **Review screen.** Every question with its score and notes, each editable in place, plus a running total `{sum} / {max}`. Copy: check everything before confirming. Button: **Confirm Scores**.
4. **Final recommendation.** The 1 to 5 scale with full label text for each option, plus a free-text "What is your final recommendation?" field. Both required.
5. **Submit.** Confirm dialog. On confirm the assignment moves to `submitted`.
6. **If the brother has a second assignment in this interview**, roll straight into the closing script and then the next rushee's rubric rather than exiting. Otherwise show the closing script and exit.

**Persistence.** Upsert the answer to `interview_answers` when the brother presses **Next**, and again on any edit from the review screen. Going back and changing an answer re-upserts. Nothing is final until submit. This satisfies §6.4.4's existing resumability requirement: a dead phone loses at most the current question.

**Lock.** While a brother has a `pending` assignment:
- Route guard blocks navigation to any other in-app route.
- `beforeunload` warns on close or refresh. **Be honest in code comments that this is a warning, not a lock.** A closed tab cannot be prevented; that is what the escape hatches in §6 are for.
- Reopening the app returns them to interview mode at the furthest question they had reached.

**Conflict flag.** A persistent control, wording per type:
- **Casual:** "I know this rushee and cannot score them." Sets `conflict_flagged_at`, blocks submit, and surfaces the panelist to leadership on the Manage screen for reassignment. This enforces the existing paper rule.
- **Professional:** "I know this rushee personally." Sets `knows_personally = true`, does not block submit, and displays the conflict disclosure script from the seed file so the panelist reads it aloud. The flag is shown to reviewers as context, the same way R28 works for evaluations.

**Submit validation, server-side:**
- Every scored question has a score. The professional form's own rule is that an incomplete rubric is null and void, so enforce it.
- Every question with `notes_required` has non-empty notes.
- Recommendation and recommendation notes present.
- The interview is still `in_progress` and the assignment is still `pending`. Re-check at the moment of write, the same pattern as R6.
- No conflict flag blocking submission.

---

## 6. The lock, and how someone gets out of it

**Rule:** a brother with any `pending` assignment cannot be added to a new interview.

Enforce this server-side on assignment insert. The error must name the blocking interview, its type, and the rushee, or nobody will know what to fix. Show the same message on the setup sheet when leadership tries to add that brother.

This creates a deadlock if a panelist abandons an interview: they are locked out of every future interview and cannot clear it themselves. Three escape hatches, all in §4:

1. Leadership removes them from the stuck interview.
2. Leadership cancels the interview.
3. Admin does either at any time.

Surface stuck panelists so leadership notices. On the interview tab, flag any interview `in_progress` for longer than a configurable threshold (default 2 hours) with the pending panelists named.

---

## 7. Completion

An interview auto-completes when every assignment is `submitted` or `removed`. Set `completed_at`, set `status = 'completed'`, audit `interview.complete`.

A rushee gets a `✓` in their column when every assignment **for that rushee** in that interview is submitted or removed and at least one is submitted. A rushee whose only panelist was removed without submitting stays at `✗`, because no rubric exists for them.

Averages populate from `v_rushee_interviews` as soon as any assignment for that rushee is submitted. A rushee interviewed by three brothers where only two submitted shows `n=2`, not a blank. Do not gate the average on full completion.

---

## 8. Permissions

Add to the §3.2 matrix:

| Capability | Brother | Recr. Director | Prof. Team | Prof. Chair | Admin |
|---|:--:|:--:|:--:|:--:|:--:|
| View interview grid (check / X / in progress only) | ✅ | ✅ | ✅ | ✅ | ✅ |
| Be assigned to an interview and score a rushee | ✅ | ✅ | ✅ | ✅ | ✅ |
| Read own submitted rubric | ✅ | ✅ | ✅ | ✅ | ✅ |
| Read all rubrics, scores, notes, averages | — | ✅ | ✅ | ✅ | ✅ |
| Start an interview, assign, reassign, drop rushee | — | ✅ | ✅ | — | ✅ |
| Remove a panelist, cancel an interview | — | ✅ | ✅ | — | ✅ |
| Act on a completed interview | — | — | — | — | ✅ |
| Edit the question set and rubrics | — | — | — | — | ✅ |

Note the deliberate widening: regular brothers **do** score interviews, which §3.2 currently does not allow. That grant must be scoped to their own assignment rows, not to a role, or it widens read access across the whole board. Postgres OR's row-level policies together, so follow **S6** and split reads: a policy for `brother_id = auth.uid()`, a separate policy for leadership. Do not write one policy that tries to cover both.

RLS on `interview_answers`:
- **Select:** own rows always; leadership all rows.
- **Insert and update:** own rows, only while the parent assignment is `pending` and the interview is `in_progress`.
- **Delete:** no policy for anyone.

RLS on `interview_assignments`: same shape, plus leadership update for status, reassignment, and removal.

---

## 9. Audit

Add to §7.6: `interview.start`, `interview.assign`, `interview.reassign`, `interview.rushee_drop`, `interview.panelist_remove`, `interview.submit`, `interview.cancel`, `interview.complete`, `interview.question_edit`.

---

## 10. Configuration

Add to §12, all admin-editable, no deploy:

| What | Where |
|---|---|
| Question sets, rubrics, score options, order | `interview_questions` |
| Opening, closing, and conflict scripts | `cycle_content`, new kind `interview_script` |
| Recommendation scale labels and descriptions | `cycles.settings.interviews.recommendation_scale` |
| Max rushees per casual interview (default 3) | `cycles.settings.interviews.max_casual_rushees` |
| Stuck-interview threshold (default 120 min) | `cycles.settings.interviews.stale_after_minutes` |

Add `interview_script` to the `content_kind` enum in §7.3.

---

## 11. Seed

Seed from `interview-seed.json`. Two caveats to respect:

1. **Every casual question is flagged `needs_human_review`.** The source was a scanned PDF and its rubric text has OCR artifacts. Casual Q2's tier text describes brotherhood and community, which does not match the prompt about a best character trait, and Q3's tiers are interleaved across table boundaries. Seed them exactly as given, and render the `needs_human_review` flag as a visible warning in the admin question editor. **Do not invent replacement rubric text.**
2. **The 1 to 5 recommendation scale is transcribed from the professional form.** The casual rubric had no recommendation field. Seeding the same labels on casual is an assumption, so mark it for chapter confirmation.

Add both question sets to the cycle clone routine in §6.7.8 so a new cycle starts from the previous one's questions.

---

## 12. Testing

Per §11.8, these go in the rules and authorization suites:

**Rules**
- Total is the sum of scored answers only. Unscored questions never contribute.
- Score validation rejects a value not present in that question's `score_options`.
- Averages exclude `pending` and `removed` assignments and report the correct `n`.
- A total of 0 is distinguishable from no interview.
- Casual totals cap at 10, professional at 20, given the seeded question sets.

**Authorization**
- A regular brother cannot read another brother's rubric, any average, or any rushee's total, via the database API directly.
- A brother cannot write to an assignment that is not theirs.
- A brother cannot write to their own assignment after submitting.
- A brother cannot write after the interview is cancelled.
- Professional Chair cannot start or cancel an interview.

**Concurrency and edge cases**
1. Two directors start an interview on the same rushee at the same moment. Exactly one succeeds.
2. A panelist submits at the same moment leadership removes them. End state must be `removed`, and the rubric must not count.
3. A rushee is dropped mid-interview. Their panelist's answers stop counting and the panelist's lock clears.
4. A brother with two assignments submits the first and closes the app. Reopening resumes into the second, not the first.
5. An interview is cancelled while a panelist is on question 4. They are ejected with an explanation, and their lock clears.
6. A panelist abandons an interview. They are blocked from a new one, the message names the blocker, and leadership can clear it.
7. A question is edited after a rubric was submitted. Existing answers keep their stored scores. Do not retroactively revalidate submitted rubrics.
8. A rushee is interviewed, then interviewed again after the first was cancelled. Only the second counts.
9. Casual Q7's yes/no is stored, is excluded from the total, and surfaces on the review board.
10. A conflict-flagged casual panelist cannot submit and appears on the Manage screen.

---

## 13. Build order

1. Migration, enums, four tables, triggers, RLS, authorization tests.
2. `v_rushee_interviews`, and repoint the review board, standings, and deck to it. Remove the §6.7.5 manual entry form.
3. Seed loader and the admin question editor with the `needs_human_review` warning.
4. Interview tab: grid, start flow, assignment sheet.
5. Interview mode: scripts, questions, review, recommendation, submit, per-question persistence, lock, resume.
6. Manage screen: reassign, drop, remove, cancel, submission status, stuck flag.
7. Deck and review board surfacing per-panelist breakdown and notes.
8. Edge case tests from §12.

Each step should be demonstrable on its own, matching the milestone style in PRD §13.

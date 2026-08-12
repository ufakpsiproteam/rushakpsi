# AKΨ Recruitment Platform — PRD alignment pass

**11 August 2026** · Nothing is committed. Review, then commit with your own message.

This pass audited the whole codebase against `AKPsiRecruitmentPlatformPRD.md`, fixed
what could be fixed safely, and rebuilt the UI. 57 files changed, 9 added, 2 moved.

---

## 1. Do these before anything else

| # | Action | Why |
|---|---|---|
| 1 | Run `supabase/migrations/20260811_security_hardening.sql` | Closes four live security holes. Until it runs, resumes are downloadable by anyone with a link. |
| 2 | Run `supabase/migrations/20260811_prd_alignment.sql` | Creates the tables the new code reads (`app_config`, `audit_log`, `review_marks`, `letter_reads`, `brother_invites`, `rushee_standing_staging`) plus the derived views. |
| 3 | Rotate anything that leaked | `RUSH26` and `akpsi2026` were both in the client bundle. Anyone who ever loaded the site could read them. Assume they are public. |
| 4 | Re-issue brother accounts by invitation | The shared-code signup page is gone. Issue invites from `/admin/brothers` → they land on `/invite/[token]`. |
| 5 | Delete `_to_delete/` | Contains the emptied `app/pledges` route. I can't delete files on your disk, only move them. |
| 6 | Regenerate `lib/database.types.ts` from Supabase | It is badly stale (see §7) and is currently suppressed with `as any` at ~14 call sites. |

Migration 1 flips the `resumes` bucket to private. **Any resume link you have already
shared will stop working** — that is the point, but don't be surprised by it.

---

## 2. Security fixes

These were live in production. Each is described as: what was wrong → what it allowed → what changed.

### 2.1 The pledge directory was public

`app/pledges/page.tsx` held `const PLEDGES_PASSWORD = 'akpsi2026'` in a `'use client'`
component, so the password shipped in the JavaScript bundle. The route was also listed
as public in `middleware.ts`.

Worse, the data came from a Server Action (`getPledges()`) that used the **service-role
key** — which bypasses RLS entirely — and performed *no authentication whatsoever*.
Server Actions are directly invokable, so the password gate protected nothing at all.
Anyone who found the endpoint could pull every bid recipient's legal name, email, phone,
Gainesville address, GPA and full essay answers.

**Changed:** moved to `/admin/pledges`, removed from the public route list, and the
action now calls `requireSession()` and checks for Admin / Professional Chair /
Director of Recruitment *before* the service client is touched (PRD §6.1.3, S4).
Resumes are now fetched through a 5-minute signed URL rather than a permanent public one.

### 2.2 Anyone could create a brother account

`app/brother-account-creation/page.tsx` held `const BROTHER_ACCESS_CODE = 'RUSH26'`,
checked client-side only, never re-validated on the server. That string was in the
bundle, never rotated, and not per-person. Anyone with it could self-register a brother
account with any name and email, and immediately get the rushee directory, event
attendance and evaluation authoring.

**Changed:** replaced with the invitation flow the PRD specifies (§6.2.2, S7, R51).
Admins issue a per-person, single-use, 14-day token; only the SHA-256 hash is stored;
acceptance is claimed with a conditional update so two simultaneous submissions can't
both succeed. If the profile write fails, the auth user is deleted again, so a partial
failure leaves no orphan (R54). The old page is now a signpost pointing at the flow.

### 2.3 The resumes bucket was public

`20260127_fix_resumes_bucket.sql` set `public = true` and added a `TO public` SELECT
policy. Resumes contain legal name, phone, address and GPA.

**Changed:** all buckets set back to private, the public policy dropped, and read access
scoped — resumes to the owner and leadership, check-in selfies to the owner and brothers,
profile photos to any authenticated user (§7.9, S5).

Note: `getPublicUrl()` is still used at several upload sites. Those calls now return URLs
that will 404 against a private bucket. §7 lists this as remaining work — the pledge
directory already uses signed URLs as the pattern to follow.

### 2.4 Every signed-in rushee could read every other rushee's attendance

`20260109_fix_all_select_policies.sql` created a policy on `event_attendance` with
`USING (auth.role() = 'authenticated')`. A later migration tried to replace it but its
`DROP POLICY` named a policy that had never been created, so the permissive one stayed
live. Postgres OR's row-level policies together, so the net effect was: any rushee could
read every attendance row, including photo paths and rejection reasons.

**Changed:** dropped by its real name, replaced with `fn_is_brother() OR auth.uid() = rushee_id`.

### 2.5 Professional Team could rewrite standings

`20260121` correctly restricted `rushees` UPDATE to admins. `20260130` then added a
*second* UPDATE policy for interview scores allowing `access_level IN ('admin','pro')`
with no column restriction. Because policies are OR'd, that silently reopened full-row
UPDATE — including `standing` — to every Professional Team member, who the permission
matrix (§3.2) explicitly denies both staging and publishing. The UI only disabled the
dropdown client-side, which is cosmetic.

**Changed:** added a `BEFORE UPDATE` trigger that rejects any change to `standing`,
`standing_published_at` or `standing_published_by` from a non-admin. This is the approach
S6 recommends when row-level policies overlap.

### 2.6 The whole events table was world-readable

Two policies each granted unconditional read — `USING (true)` and one containing a
literal `OR TRUE`. Locked and internal events were readable by anyone, authenticated or
not.

**Changed:** added `events.is_public` (default true); anonymous callers now see only
publicly-listed events, authenticated users see the full calendar (§6.1.1).

### 2.7 Endpoints didn't validate their targets

`/api/admin/delete-user` deleted whatever UUID it was handed after checking only that
the *caller* was an admin. A mistyped or replayed request could delete another admin's
account. `/api/admin/reset-password` enforced an 8-character minimum against a required
10, and the identity affirmation R53 requires was checked only in the browser, so a
direct call skipped it entirely.

**Changed:** all four admin routes now go through `lib/server-auth.ts`, which resolves
the caller, checks the capability, and validates the target (S12). Reset-password
requires `identityConfirmed: true` in the request body. Both routes write audit entries.

### 2.8 Secrets and PII in the browser console

`app/check-in/[token]/page.tsx` logged the raw check-in token (a single-use write
credential), the Supabase URL, and the rushee's name and email — on a public,
unauthenticated page. Other pages logged full rushee rows, evaluation payloads and
search results.

**Changed:** 29 `console.log` statements removed across 8 files. Remaining `console.error`
calls no longer include user records.

---

## 3. Business rules brought back in line with the PRD

### 3.1 Eligibility was implemented twice, and the standings page a third time

R2 requires one formula that the FAQ, the progress rings, the application gate and
standing auto-derivation all read. Instead `1 / 1 / 3` was hardcoded in `StatusBanner.tsx`
and again in `application/page.tsx` — they agreed by luck, not design — while
`admin/standing/page.tsx` used `casualEvents >= 2 && professionalEvents >= 1`, a
different rule entirely.

**Changed:** added `lib/policy.ts` as the rulebook, backed by an `app_config` row and the
`fn_minimums_met()` database function. Every surface reads it, including the landing
page's requirements badge — so the advertised rule is now literally the enforced rule.

### 3.2 Standing auto-derivation never ran

The branch that promotes a rushee to `Event Minimums Met` was guarded by
`if (!standing)`, but `rushees.standing` defaults to `'In Progress'` and is never null.
The branch was unreachable, so nobody was ever auto-promoted.

**Changed:** replaced with `deriveStanding()`, which promotes only while a rushee sits at
`In Progress` and stops once an admin sets anything later (§4.3).

### 3.3 Evaluations recorded "N/A" for people nobody had rated

The evaluation form initialised `professional: 0`, and `0` is the "N/A — can't speak to
professionalism" value. So every evaluation submitted without touching the professional
row was recorded as a deliberate N/A, with that option already highlighted. R23 requires
"not yet rated" and "deliberately N/A" to be stored distinctly.

The knock-on effect: `brother/events` flagged every `professional_score === 0` as
"awaiting professional score", so brothers were permanently nagged to fix evaluations
they had already completed.

**Changed:** added `evaluations.professional_na`, made `professional_score` nullable, and
rewrote the form so neither score is pre-selected. Existing `0` rows are migrated to
`professional_na = true` — the closest honest mapping, though some of them were almost
certainly "never touched" rather than a real N/A. Worth knowing when you read historical
evaluations.

### 3.4 Bid-night voting had no quorum check

R47 requires 60% turnout for a valid round. `votingLogic.ts` had no quorum concept at
all — only `no >= threshold`. Running the PRD's own worked example through the shipped
code (40 eligible, 12 ballots, 1 NO) returned **`pass`** where the PRD says
**"below quorum — blocked"**. A round with 30% turnout would have been certified valid.

**Changed:** `computeRoundOutcome()` checks quorum first and can return `below_quorum`.
All five of the PRD's worked examples in §5.8 now produce the documented result — I ran
them as a test.

Also corrected: the comment claiming "ABSTAIN counts as YES". R46 says an abstention is
recorded distinctly and does not count toward rejection, which is what the code does.

### 3.5 Dates were wrong for anyone outside UTC

`formatDateInEST` composed `parseISO(dateString + 'T00:00:00')` with `toZonedTime()`.
`parseISO` with no offset parses in the *browser's* timezone, so the instant already
depended on the viewer's machine; re-projecting it into ET could shift the displayed date
by a full day. That is exactly the failure mode §11.3 exists to prevent, hiding inside a
function named `formatDateInEST`.

**Changed:** calendar dates are formatted from their parts with no Date round-trip; real
instants use `fromZonedTime()`, which reads a wall-clock time *as* chapter time and
handles DST. Added `chapterGreeting()` so the dashboard greeting is computed in chapter
time as §6.3.2 requires.

### 3.6 Editing an evaluation erased which event it came from

`createOrUpdateEvaluation` wrote `event_id: eventId || null` on every update. Editing
from the rushee directory — where there is no event in context — silently nulled the
originating event, destroying the per-event attribution §4.4 says must survive revisions.

**Changed:** `event_id` is set once on creation and only filled in later if it was empty.

### 3.7 Password minimum was 6, 8 and 8 against a required 10

R52: "Minimum 10 characters everywhere. One rule, one validator, enforced server-side."
Signup accepted 6, self-service reset accepted 8, the admin reset route accepted 8, and
none were enforced server-side.

**Changed:** one `validatePassword()` in `lib/policy.ts`, used by every entry point and
enforced in the API route.

### 3.8 Rushees rejected at bid night stayed visible

R39 excludes published rejections from the brother directory and the bid-night deck.
Both surfaces filtered only `Invite Only (N)`, never `Bid (N)`.

**Changed:** both use `isRejection()`, which covers all published rejections.

### 3.9 Other rule corrections

- **R10** — the tokenized QR check-in had neither required affirmation checkbox, no
  instructions screen and no mirrored preview, despite the PRD calling out that path by
  name. Rebuilt to full parity with the main flow.
- **R19** — submitting the application opened no confirmation, so a stray click
  permanently locked it. Added.
- **R29** — evaluation comments had no 1,000-character cap or counter, client or server.
  Added both, plus a `NOT VALID` check constraint so historical rows are left alone.
- **R35** — "Complete Evaluations" credited attendance unconditionally. It now names the
  rushees you marked as met but haven't evaluated, and requires an explicit acknowledgment.
- **§6.4.4** — "Reset Selection" cleared local state but left the interaction records it
  created in the database, silently inflating every affected rushee's distinct-brother
  interaction count. It now deletes them.
- **§6.4.5** — "Copy notes into comment" replaced the comment field. It now appends, as
  specified, so existing text isn't destroyed.
- **§6.4.4** — selection state was localStorage-only. It now falls back to reading the
  interaction records, so an interrupted flow resumes on another device.
- **§6.3.8** — the letter "NEW" badge used a localStorage key with no user identity, so on
  a shared browser one rushee's read state suppressed the badge for the next. Moved to a
  per-user `letter_reads` table.
- **§6.3.8 / §11.6** — confetti now respects `prefers-reduced-motion`.
- **R38** — review marks lived in localStorage under one shared key, so no reviewer could
  see another's marks and the consensus view was impossible. Moved to `review_marks`.
- **§6.4.2** — the Professional Chair had no entry in the elevated-access menu at all, and
  the Professional Team entry reused the Director's description. Both fixed. The
  `professional_chair` role has been added to the `brother_role` enum, which previously
  had no way to represent it.
- **§6.7** — `AdminNav` linked to `/admin/bid-night`, which doesn't exist (404), while
  `/admin/brothers`, `/admin/slides` and the pledge directory had no nav entry at all.
- **§3.2** — middleware bounced Directors of Recruitment out of every `/admin` route,
  including `/admin/attendance`, which the matrix grants them.

---

## 4. Deciding and publishing are now separate

§6.7.4 calls the standings page "the highest-consequence surface in the product". It had
no publish gate at all: the dropdown wrote straight to `rushees.standing` for **every**
rushee on save — touched or not — with a generic amber warning and no typed confirmation.
Meanwhile the *delete account* button on the same page did require typing `CONFIRM`.

Now:

- Changing the dropdown stages a value in `rushee_standing_staging`, an admin-only table.
  Nothing reaches a rushee. Staged values render with a dashed border alongside the
  published value, so you can always see what a rushee currently sees.
- **Publish Decisions** opens a dialog that groups every staged change by target standing
  with counts, states *"{n} rushees will see a decision letter, and {n} emails will be
  sent"*, warns that publication cannot be unseen, and requires typing `PUBLISH`.
- Publishing writes only the changed rows, stamps `standing_published_at` /
  `standing_published_by`, records an audit entry with the prior value, and clears staging.

Staging lives in a separate table rather than a column on `rushees` deliberately: RLS is
row-level, so a staged column would be readable through the rushee's own-row policy —
exactly what S11 forbids.

---

## 5. Design

Two expressions of one token set, per §10.1.

### The app: monochrome

`app/globals.css` now defines the token set and the component primitives (`.card`,
`.btn`, `.input`, `.badge`, `.stat-tile`, `.data-table`, `.modal-panel`, `.nav-tab`,
`.bottom-tabs`, …). Chrome is greyscale — ink, muted, subtle, faint, three surface levels
and two line weights. No navy, no gold, no blue anywhere in the authenticated app.

Colour survives in exactly one place: status badges and alerts, in three desaturated
tones (green / amber / red), always paired with a label, because §11.6 requires colour
never to be the only signal. Approving 300 check-in photos without a colour cue would be
genuinely worse. If you want those neutral too, change three tokens in `globals.css`.

Also added: visible focus rings on every interactive element, a 44px minimum touch target
on coarse pointers, safe-area insets on the bottom tabs, and a global
`prefers-reduced-motion` block.

35 files were swept from the old slate/gray/blue palette onto these tokens. The
high-traffic surfaces — all three navs, the evaluation form, check-in, the auth pages,
the pledge directory, the envelope card — were rewritten rather than swept.

The rushee mobile tab bar went from three tabs to the five §6.3.1 specifies. Status and
Info were previously unreachable on a phone except by typing the URL, and Status is the
page rushees hit most during decision windows.

### The landing page: space

Replaced the Monopoly theme with a space theme, kept in `app/landing/page.tsx`. Deep
space gradient, a static star field (fixed positions, so server and client render
identically and it doesn't hydrate mismatched), drifting nebula wash, slow orbital rings,
Cinzel display serif over Manrope.

Cycle name and tagline are constants at the top of the file — `Chart Your Course` /
*"Find your orbit. Build your trajectory. Go the distance."* Change them there. Every
other section keeps the PRD's specified copy and ordering, and the requirements badge
renders from the eligibility config, so it can't drift from what the app enforces.

---

## 6. New files

| File | Purpose |
|---|---|
| `lib/policy.ts` | The rulebook. Eligibility, score scales, aggregation, standings, voting math, password policy. Reads `app_config` so an admin can tune it without a deploy. |
| `lib/server-auth.ts` | Server-side authorization. `requireBearer` / `requireSession`, target validation, `logAudit`. Every privileged handler goes through it. |
| `lib/invite-tokens.ts` | Invite token generation and hashing. |
| `app/api/invites/{route,validate,accept}` | Issue, validate and accept brother invitations. |
| `app/invite/[token]/page.tsx` | Invitation acceptance. |
| `app/admin/pledges/` | The pledge directory, moved and gated. |
| `supabase/migrations/20260811_security_hardening.sql` | §2 above. |
| `supabase/migrations/20260811_prd_alignment.sql` | Config, audit, staging, marks, invites, letter reads, and the §7.8 derived views. |

---

## 7. What I did not do

Deliberate omissions, roughly in the order I'd tackle them.

**Cycles (§7.1, Principle 4).** There is no `cycles` table and no `cycle_id` on anything.
Every "per cycle" rule is actually "all time" — most consequentially, `evaluations` is
unique on `(brother_id, rushee_id)`, so if a rushee returns next semester, an existing
brother's evaluation from this cycle is treated as their evaluation for the next one:
stale scores pre-filled, no way to write a fresh one. `app_config` is shaped like
`cycles.settings` so the move is a rename rather than a redesign, but it touches every
table and every query. **This is the single largest gap, and the one that will bite you
next semester rather than this one.**

**Signed URLs at the upload sites.** Migration 1 makes the buckets private, but
`getPublicUrl()` is still used in `rushee/events`, `rushee/application`,
`ProfilePictureModal` and `lib/database.ts`. Those links will 404 until they're switched
to `createSignedUrl()`. `app/admin/pledges/actions.ts` shows the pattern. Roughly an hour.

**Event times as real timestamps (§6.7.3).** `events` stores `date DATE` plus
`time TEXT` — free text like `"7:00 PM - 9:00 PM"`, parsed with a regex. Anything that
doesn't match ("TBD", "7-9 PM", "Doors 6:30") silently sorts to midnight. It also makes
`attendance_opens_at` / `attendance_closes_at` and scheduled phase changes impossible.
I left it alone because migrating it needs a backfill I can't test against your data.

**Bid-night voting UI (§6.6.2).** The tables and `votingLogic.ts` exist; there is no
controller, no voter view and no session screen. Nothing under `app/` references
`voting_sessions`. The math is now correct, so this is UI work on a sound base.

**Audit log coverage.** The table exists and the highest-consequence actions write to it
(publish, role grant/revoke, account delete, admin password reset, invite issue/revoke/
accept, AI summary). §7.6 lists about fifteen; attendance approve/reject, event
phase changes and application unlock still don't.

**Application questions as data (§7.5).** Questions are hardcoded columns, including
`monopoly_piece` and `monopoly_theme_lesson` — theme names in the schema, which §1.6
explicitly forbids. Changing the theme currently needs a migration. Given you're moving
to a space theme, this one has a deadline.

**Decision letters and chapter info as templates (§6.3.9, §12).** Both are hardcoded in
JSX, including dates, venues and the signing officer. A new cycle needs a code change.

**RLS test suite (S2).** The PRD wants CI tests asserting the full §3.2 matrix per
persona. Given how the overlapping-policy bugs in §2.4 and §2.5 arose — from migrations
that dropped policy names which never existed — this would have caught both. Highest
value per hour of anything on this list.

**`lib/database.ts` vs `lib/api.ts`.** Two incompatible data layers, both imported live.
Large parts of `database.ts` reference tables that no longer exist (`rushee_profiles`,
`brother_notes`, `applications.why_akpsi`) and would throw at runtime if called.

**`lib/database.types.ts` is stale.** `event_attendance` has no `photo_url`, `status` or
`group_number` in the types, though the code reads and writes all three. That's why
there are ~14 `as any` casts. Regenerate from Supabase.

**Attendance review (§6.7.2).** Rejecting doesn't prompt for a reason (so the rushee
never learns why), there's no "Rejected" filter, no bulk approve/reject and no CSV export.
Attendance also still defaults to `pending`; R11 wants records created `approved` with
exception-based rejection, since reviewing several hundred photos isn't viable.

---

## 8. Verification

- `npx tsc --noEmit` — clean, after every change.
- `next build` — compiles successfully, all 33 routes register. Run in a sandbox copy
  with a fresh `npm install`, which surfaced pre-existing type errors in `lib/auth.ts`
  and `lib/database.ts` that your pinned lockfile doesn't hit. Not regressions, but they
  will appear the next time you update `@supabase/supabase-js`.
- The five worked voting examples in PRD §5.8 — all match, including the below-quorum
  case the old code got wrong.
- Screenshots of the landing page, sign-in, signup and password recovery.

**Not verified:** nothing was run against your real Supabase project. The migrations are
untested against live data — read them before running, and take a backup first. The
camera flows, the invite round-trip and the publish flow all need a manual pass.

# AKPsi Recruitment Platform — project context

Next.js 16 + Supabase recruitment/rush app for Alpha Kappa Psi (Alpha Phi chapter, UF). Read this before touching auth, signup, or the database — several non-obvious things below aren't visible from the code alone.

## Supabase project

- **Live project**: `himvltqfmbgpbjgbjogt` (`https://himvltqfmbgpbjgbjogt.supabase.co`), org `rdeovehqynjcrhyqgbod`. Created 2026-08-11, replaces an old project (`iptpdgitwwwfeqlvourf`) that this repo has no access to and that no longer matters.
- Schema was rebuilt from scratch by replaying `supabase/legacy/*.sql` + `supabase/migrations/*.sql` directly via `apply_migration` (not through Supabase's normal dashboard/CLI provisioning). **This skipped Supabase's automatic baseline role grants** — `anon`/`authenticated`/`service_role` had zero SELECT/INSERT/UPDATE/DELETE on any table (only TRIGGER/REFERENCES/TRUNCATE), which looked exactly like RLS/session bugs and cost a long debugging session before the real cause surfaced. **Fixed** — baseline grants + `ALTER DEFAULT PRIVILEGES` now in place. If this DB is ever rebuilt from scratch again, grant baseline privileges to `anon, authenticated, service_role` on `public` immediately after creating tables, before assuming anything else is broken.
- `.env.local` needs: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` (publishable key works), `SUPABASE_SERVICE_ROLE_KEY` — **must be the legacy JWT-format key** (`eyJ...`, decodes to `"role":"service_role"`). The new `sb_secret_...` format key did not get recognized as service_role by this project's PostgREST layer and caused every server-side insert to fail with a plain RLS-shaped 403 — if that happens again, check this first. Also needs `OPENAI_API_KEY`, `NEXT_PUBLIC_SITE_URL`.
- **Never read `.env.local` or use the service role key without the user's explicit per-turn instruction** — standing rule, not a one-time ask.

## Undocumented schema gaps found this session (all now fixed/rebuilt)

The old project had several DB objects created by hand on the dashboard, never captured in any migration file. Found and resolved:
- `rushees.standing` (text) — never had a `CREATE`/`ALTER` anywhere. Replaced entirely with `invite_only` + `bid_status` (nullable booleans, independently staged/published, DB-enforced sequencing — see `supabase/migrations/20260811_split_standing_into_invite_bid.sql`).
- `applications` table — turned out to be defined in an unread legacy file (`supabase/legacy/supabase-applications-migration.sql`); used verbatim.
- `rushees.gpa` — referenced live in 4+ admin pages, never created. Added as `DECIMAL(3,2)`.
- QR-token check-in system (`check_in_tokens` table + 3 RPCs) — dropped entirely per product decision; it modeled a flow that isn't how check-in actually works. Real check-in is self-serve from `app/rushee/events/page.tsx` (logged-in rushee, own camera, plain RLS insert). Manual attendance (admin/recruitment adding someone without a photo) still exists via `create_manual_attendance`, now with a real server-side role check instead of none.

If another undocumented gap turns up, check `supabase/legacy/*.sql` fully before assuming something needs to be invented — two files in there went unread for most of the session and both turned out to matter.

## Auth / signup architecture

- Public signup (`/auth/signup`) only creates **rushees** — hardcoded, not user-selectable.
- Signup goes through `app/api/auth/signup/route.ts` (service-role, server-side, rollback-on-failure) — **not** a direct client `supabase.auth.signUp()` + insert. That direct pattern raced the browser's session-propagation timing and intermittently orphaned `auth.users` rows with no profile. Don't revert to it.
- **Brother accounts only get created via invite** (`/invite/[token]` → `/api/invites/accept`, admin-only to issue). There is currently **no frontend page that calls the invite-creation API** — the admin-side "send an invite" UI doesn't exist yet. This is a real gap, not a bug to fix by guessing the design.
- First admin account was bootstrapped directly via SQL (not through the app, since no admin existed yet to issue an invite): `vp.prodevelopment@gmail.com`. Password was shared once in chat — should be rotated.

## UI theme system

- `app/globals.css` defines the base greyscale token system (`--color-ink`, `--color-surface`, `--color-inverse`, …) plus a `@layer components` block (`.btn`, `.card`, `.nav-tab`, `.badge`, `.modal-panel`, `.input`, etc.) that every screen in the app shares.
- A second theme layer, `.portal-shell`, lives at the bottom of `app/globals.css`. It re-declares the same custom-property names with an AKΨ navy/blue/gold oklch palette and Bodoni Moda / Sora / Nunito type (`lib/portalFonts.ts`), so every shared component class recolors automatically wherever it's applied — no per-page edits needed.
- **Scope**: `.portal-shell` is applied by `app/admin/layout.tsx`, `app/brother/layout.tsx`, `app/rushee/layout.tsx`, and `app/auth/signin/layout.tsx` (each wraps its route group in `<div className="portal-shell">` + renders `<WaveBackground />` from `components/portal/WaveBackground.tsx`). That's the entire authenticated app. Only the public landing page uses just the root `app/layout.tsx` and keeps its own space theme — do not add `.portal-shell` there.
- The old flat grey/black chrome (hardcoded `bg-black`/`border-black`/`text-white` Tailwind literals) has been retired everywhere except landing — `BrotherNav.tsx` and `app/auth/signin/page.tsx` were rewritten to consume the shared token classes instead (`AdminNav.tsx`/`RusheeNav.tsx` already did). If you touch authenticated-app UI, use the existing component classes (`.btn`, `.card`, `.input`, `.nav-tab`, …) so it inherits the portal palette automatically; don't reintroduce raw black/white literals.
- Nav tab active-state uses a Framer Motion (`layoutId="portal-nav-underline"`) sliding underline, implemented directly in `AdminNav.tsx`/`BrotherNav.tsx`/`RusheeNav.tsx`.
- The rushee decision-letter reveal (`components/rushee/DecisionLetter.tsx`, `EnvelopeCard.tsx`, the `letter-reveal` keyframe, `canvas-confetti` logic) was deliberately left alone — it inherits the new portal card colors as a byproduct but its animation/trigger logic is unchanged.

## Known non-bugs

- Two browser tabs on `localhost` (any ports) share one session cookie — logging into a second account in one tab silently swaps the session for both. Not a server bug, not a data leak. Use separate browser profiles/incognito for simultaneous multi-account testing.

## Still outstanding (not yet fixed, flagged during audits)

- `profile-pictures` (upload path) vs `profile-photos` (read path) bucket-name mismatch in app code — both buckets exist so nothing errors, but uploaded photos likely never display for admins.
- No admin UI to generate brother invites (see above).
- A few legacy trigger functions (`assign_group_number`, `update_vote_counts`, etc.) lack `SET search_path`, a minor advisory-level hardening item, not urgent.

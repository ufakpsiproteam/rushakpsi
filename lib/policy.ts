/**
 * The rulebook — PRD §5.
 *
 * PRD Principle 1 (§1.4): "Rules live in one place. Eligibility, scoring,
 * and state transitions are defined once and every surface reads that
 * definition."
 *
 * Before this module the eligibility minimums were hardcoded separately in
 * the status banner and the application gate, the password minimum was
 * implemented three times with three different values (6, 6 and 8 against
 * a required 10), and the evaluation target was written inline in six
 * places. Anything a surface needs to know about the rules now comes from
 * here.
 *
 * Defaults mirror `app_config.settings` in the database. `loadPolicy()`
 * overlays the stored row so an admin can tune the numbers without a
 * deploy (PRD §12); every value is safe to read synchronously from
 * POLICY_DEFAULTS before that resolves.
 */

import { supabase } from './supabase'

export interface Policy {
  eligibility: {
    minCasual: number
    minProfessional: number
    minTotal: number
  }
  evaluation: {
    targetPerBrother: number
    commentCharLimit: number
    qualities: string[]
  }
  checkin: {
    countdownSeconds: number
    tokenTtlMinutes: number
    defaultGroups: number
  }
  application: {
    autosaveDebounceMs: number
    resumeMaxMb: number
    gpaCeiling: number
    essayCharLimit: number
  }
  voting: {
    thresholdFraction: number
    quorumFraction: number
    discussionSeconds: number
    votingSeconds: number
    extensionSeconds: number
    maxExtensions: number
    adminsSeeBallots: boolean
  }
  invites: {
    ttlDays: number
  }
  security: {
    minPasswordLength: number
  }
}

export const POLICY_DEFAULTS: Policy = {
  eligibility: { minCasual: 1, minProfessional: 1, minTotal: 3 },
  evaluation: {
    targetPerBrother: 15,
    commentCharLimit: 1000,
    qualities: ['Drive', 'Passion', 'Professionalism', 'Genuine', 'Responsible', 'Culture Fit'],
  },
  checkin: { countdownSeconds: 3, tokenTtlMinutes: 5, defaultGroups: 5 },
  application: {
    autosaveDebounceMs: 2000,
    resumeMaxMb: 10,
    gpaCeiling: 4.5,
    essayCharLimit: 500,
  },
  voting: {
    thresholdFraction: 0.25,
    quorumFraction: 0.6,
    discussionSeconds: 120,
    votingSeconds: 60,
    extensionSeconds: 60,
    maxExtensions: 1,
    adminsSeeBallots: false,
  },
  invites: { ttlDays: 14 },
  security: { minPasswordLength: 10 },
}

/** Mutable snapshot, replaced once loadPolicy() resolves. */
export let POLICY: Policy = POLICY_DEFAULTS

let loadPromise: Promise<Policy> | null = null

function num(value: unknown, fallback: number): number {
  const parsed = typeof value === 'number' ? value : Number(value)
  return Number.isFinite(parsed) ? parsed : fallback
}

/**
 * Read app_config and overlay it on the defaults. Cached for the lifetime
 * of the page; the config is edited rarely and never mid-session.
 */
export function loadPolicy(): Promise<Policy> {
  if (loadPromise) return loadPromise

  loadPromise = (async () => {
    try {
      const { data } = await supabase.from('app_config').select('settings').limit(1).maybeSingle()
      const s = (data as { settings?: Record<string, any> } | null)?.settings
      if (!s) return POLICY_DEFAULTS

      const merged: Policy = {
        eligibility: {
          minCasual: num(s.eligibility?.min_casual, POLICY_DEFAULTS.eligibility.minCasual),
          minProfessional: num(
            s.eligibility?.min_professional,
            POLICY_DEFAULTS.eligibility.minProfessional
          ),
          minTotal: num(s.eligibility?.min_total, POLICY_DEFAULTS.eligibility.minTotal),
        },
        evaluation: {
          targetPerBrother: num(
            s.evaluation?.target_per_brother,
            POLICY_DEFAULTS.evaluation.targetPerBrother
          ),
          commentCharLimit: num(
            s.evaluation?.comment_char_limit,
            POLICY_DEFAULTS.evaluation.commentCharLimit
          ),
          qualities: Array.isArray(s.evaluation?.qualities) && s.evaluation.qualities.length
            ? s.evaluation.qualities
            : POLICY_DEFAULTS.evaluation.qualities,
        },
        checkin: {
          countdownSeconds: num(
            s.checkin?.countdown_seconds,
            POLICY_DEFAULTS.checkin.countdownSeconds
          ),
          tokenTtlMinutes: num(s.checkin?.token_ttl_minutes, POLICY_DEFAULTS.checkin.tokenTtlMinutes),
          defaultGroups: num(s.checkin?.default_groups, POLICY_DEFAULTS.checkin.defaultGroups),
        },
        application: {
          autosaveDebounceMs: num(
            s.application?.autosave_debounce_ms,
            POLICY_DEFAULTS.application.autosaveDebounceMs
          ),
          resumeMaxMb: num(s.application?.resume_max_mb, POLICY_DEFAULTS.application.resumeMaxMb),
          gpaCeiling: num(s.application?.gpa_ceiling, POLICY_DEFAULTS.application.gpaCeiling),
          essayCharLimit: num(
            s.application?.essay_char_limit,
            POLICY_DEFAULTS.application.essayCharLimit
          ),
        },
        voting: {
          thresholdFraction: num(
            s.voting?.threshold_fraction,
            POLICY_DEFAULTS.voting.thresholdFraction
          ),
          quorumFraction: num(s.voting?.quorum_fraction, POLICY_DEFAULTS.voting.quorumFraction),
          discussionSeconds: num(
            s.voting?.discussion_seconds,
            POLICY_DEFAULTS.voting.discussionSeconds
          ),
          votingSeconds: num(s.voting?.voting_seconds, POLICY_DEFAULTS.voting.votingSeconds),
          extensionSeconds: num(
            s.voting?.extension_seconds,
            POLICY_DEFAULTS.voting.extensionSeconds
          ),
          maxExtensions: num(s.voting?.max_extensions, POLICY_DEFAULTS.voting.maxExtensions),
          adminsSeeBallots: Boolean(s.voting?.admins_see_ballots),
        },
        invites: { ttlDays: num(s.invites?.ttl_days, POLICY_DEFAULTS.invites.ttlDays) },
        security: {
          minPasswordLength: num(
            s.security?.min_password_length,
            POLICY_DEFAULTS.security.minPasswordLength
          ),
        },
      }

      POLICY = merged
      return merged
    } catch {
      return POLICY_DEFAULTS
    }
  })()

  return loadPromise
}

/* ---------------------------------------------------------------------
   R1–R5 · Eligibility
   --------------------------------------------------------------------- */

export interface AttendanceCounts {
  casual: number
  professional: number
  total: number
}

export interface EligibilityResult extends AttendanceCounts {
  minCasual: number
  minProfessional: number
  minTotal: number
  casualMet: boolean
  professionalMet: boolean
  totalMet: boolean
  minimumsMet: boolean
}

/**
 * R2 — the one eligibility formula. The landing-page FAQ badge, the
 * progress rings, the application gate and standing auto-derivation all
 * call this, so the advertised requirement and the enforced requirement
 * cannot diverge.
 */
export function evaluateEligibility(
  counts: AttendanceCounts,
  policy: Policy = POLICY
): EligibilityResult {
  const { minCasual, minProfessional, minTotal } = policy.eligibility
  const casualMet = counts.casual >= minCasual
  const professionalMet = counts.professional >= minProfessional
  const totalMet = counts.total >= minTotal

  return {
    ...counts,
    minCasual,
    minProfessional,
    minTotal,
    casualMet,
    professionalMet,
    totalMet,
    minimumsMet: casualMet && professionalMet && totalMet,
  }
}

/**
 * R3 — only approved attendance counts. Pending and rejected check-ins
 * contribute nothing.
 */
export function countApprovedAttendance(
  rows: { status?: string | null; type?: string | null }[]
): AttendanceCounts {
  const approved = rows.filter((row) => row.status === 'approved')
  return {
    casual: approved.filter((row) => row.type === 'Casual').length,
    professional: approved.filter((row) => row.type === 'Professional').length,
    total: approved.length,
  }
}

/** Human-readable requirement line, rendered from the same config (R2). */
export function requirementSummary(policy: Policy = POLICY): string {
  const { minCasual, minProfessional, minTotal } = policy.eligibility
  const choice = minTotal - minCasual - minProfessional
  const parts = [`${minProfessional} professional`, `${minCasual} casual`]
  if (choice > 0) parts.push(`${choice} of choice`)
  return `Requirements: ${parts.join(', ')}.`
}

/* ---------------------------------------------------------------------
   R52 · Password policy — one rule, one validator
   --------------------------------------------------------------------- */

export function validatePassword(password: string, policy: Policy = POLICY): string | null {
  const min = policy.security.minPasswordLength
  if (!password || password.length < min) {
    return `Password must be at least ${min} characters.`
  }
  return null
}

export function passwordHint(policy: Policy = POLICY): string {
  return `At least ${policy.security.minPasswordLength} characters`
}

/* ---------------------------------------------------------------------
   R23–R30 · Evaluation scales
   --------------------------------------------------------------------- */

/** R24 — professional scale. 0 is the explicit "N/A" choice. */
export const PROFESSIONAL_LABELS: Record<number, string> = {
  0: "N/A - Can't speak to professionalism",
  1: 'Unprepared',
  2: 'Developing',
  3: 'Competent',
  4: 'Polished',
  5: 'Exceptional',
}

/** R25 — personal scale. */
export const PERSONAL_LABELS: Record<number, string> = {
  1: 'Disconnected',
  2: 'Reserved',
  3: 'Approachable',
  4: 'Engaging',
  5: 'Magnetic',
}

/** R26 — category descriptions. */
export const CATEGORY_DESCRIPTIONS = {
  professional: 'Professionalism, communication skills, engagement, and preparedness',
  personal: 'Culture fit, personality, values alignment, and interpersonal skills',
} as const

/**
 * A professional rating is one of three distinct states (R23):
 *   · null + na=false → not yet rated
 *   · null + na=true  → deliberately N/A
 *   · 1–5             → a real score
 */
export type ProfessionalRating =
  | { kind: 'unrated' }
  | { kind: 'na' }
  | { kind: 'scored'; score: number }

export function toProfessionalRating(
  score: number | null | undefined,
  na: boolean | null | undefined
): ProfessionalRating {
  if (na) return { kind: 'na' }
  if (typeof score === 'number' && score >= 1 && score <= 5) return { kind: 'scored', score }
  return { kind: 'unrated' }
}

export function professionalRatingLabel(rating: ProfessionalRating): string {
  if (rating.kind === 'na') return PROFESSIONAL_LABELS[0]
  if (rating.kind === 'unrated') return 'Not yet rated'
  return PROFESSIONAL_LABELS[rating.score]
}

/**
 * R30 — the running average shown on the evaluation form, display only.
 *  · no personal score → null
 *  · professional N/A or unrated → the personal score alone
 *  · otherwise → the mean of the two, out of 5
 */
export function evaluationAverage(
  professional: ProfessionalRating,
  personalScore: number | null
): { value: number | null; personalOnly: boolean } {
  if (personalScore === null || personalScore === undefined) {
    return { value: null, personalOnly: false }
  }
  if (professional.kind !== 'scored') {
    return { value: personalScore, personalOnly: true }
  }
  return { value: (professional.score + personalScore) / 2, personalOnly: false }
}

/* ---------------------------------------------------------------------
   R36 · Aggregate scores
   --------------------------------------------------------------------- */

export interface ScoreAggregate {
  avgProfessional: number | null
  professionalCount: number
  avgPersonal: number | null
  personalCount: number
  overall: number | null
  evaluationCount: number
}

/**
 * R36 — averages with the evidence count behind each, so a reviewer can
 * always see how much evidence sits behind a number. Evaluations where
 * professional was marked N/A still count as evaluations but are excluded
 * from the professional average.
 */
export function aggregateScores(
  evaluations: {
    professional_score?: number | null
    professional_na?: boolean | null
    personal_score?: number | null
  }[]
): ScoreAggregate {
  const professionalScores = evaluations
    .map((e) => toProfessionalRating(e.professional_score, e.professional_na))
    .filter((r): r is { kind: 'scored'; score: number } => r.kind === 'scored')
    .map((r) => r.score)

  const personalScores = evaluations
    .map((e) => e.personal_score)
    .filter((s): s is number => typeof s === 'number')

  const mean = (values: number[]) =>
    values.length ? values.reduce((sum, v) => sum + v, 0) / values.length : null

  const avgProfessional = mean(professionalScores)
  const avgPersonal = mean(personalScores)

  let overall: number | null = null
  if (avgProfessional !== null && avgPersonal !== null) {
    overall = (avgProfessional + avgPersonal) / 2
  } else if (avgPersonal !== null) {
    overall = avgPersonal
  } else if (avgProfessional !== null) {
    overall = avgProfessional
  }

  return {
    avgProfessional,
    professionalCount: professionalScores.length,
    avgPersonal,
    personalCount: personalScores.length,
    overall,
    evaluationCount: evaluations.length,
  }
}

/** One decimal for display only (R36). */
export function formatScore(value: number | null): string {
  return value === null ? '—' : value.toFixed(1)
}

/* ---------------------------------------------------------------------
   R37 · Interview scores
   --------------------------------------------------------------------- */

export const INTERVIEW_RANGES = {
  professional: { min: 0, max: 20, step: 0.1 },
  professionalOption: { min: 1, max: 5, step: 0.1 },
  casual: { min: 0, max: 10, step: 0.1 },
} as const

/**
 * R37 — "a recorded score of 0 is meaningful and must be visually
 * distinguishable from 'no interview yet'."
 */
export function hasInterviewScore(value: number | null | undefined): boolean {
  return typeof value === 'number' && Number.isFinite(value)
}

/* ---------------------------------------------------------------------
   R38 · Review marks
   --------------------------------------------------------------------- */

export type ReviewMark = 'undecided' | 'strong_yes' | 'maybe' | 'no'

export const REVIEW_MARK_CYCLE: ReviewMark[] = ['undecided', 'strong_yes', 'maybe', 'no']

export const REVIEW_MARK_LABELS: Record<ReviewMark, string> = {
  undecided: 'Undecided',
  strong_yes: 'Strong Yes',
  maybe: 'Maybe',
  no: 'No',
}

export function nextReviewMark(current: ReviewMark): ReviewMark {
  const index = REVIEW_MARK_CYCLE.indexOf(current)
  return REVIEW_MARK_CYCLE[(index + 1) % REVIEW_MARK_CYCLE.length]
}

/* ---------------------------------------------------------------------
   §4.3 · Decisions — Invite Only and Bid

   Replaces the old single `standing` text column (six values covering
   both a live progress indicator and two sequential decisions) with two
   independent, nullable-boolean decisions: `invite_only` and
   `bid_status`. NULL = not yet decided, true = Yes, false = No — the
   nullability preserves the same three-way distinction the old text
   values encoded (undecided must never look like a rejection).

   The old "In Progress" / "Event Minimums Met" states are gone as
   stored values; they were always re-derivable from live attendance
   (evaluateEligibility below) and are now computed at read time only,
   never written to the database.
   --------------------------------------------------------------------- */

export interface RusheeDecision {
  inviteOnly: boolean | null
  bidStatus: boolean | null
}

/** A decision exists once Invite Only has been published either way. */
export function isDecisionMade(decision: RusheeDecision): boolean {
  return decision.inviteOnly !== null
}

/** R39 — a published rejection at either stage. Excluded from the
 *  brother directory and the bid-night deck, but retained on the
 *  review board. */
export function isRejected(decision: RusheeDecision): boolean {
  return decision.inviteOnly === false || decision.bidStatus === false
}

/**
 * R5 — the application unlocks once minimums are met, and stays
 * unlocked once an invite decision has been published even if live
 * attendance later reads as not-met.
 */
export function applicationUnlocked(decision: RusheeDecision, minimumsMet: boolean): boolean {
  if (decision.inviteOnly === null) return minimumsMet
  return true
}

/* ---------------------------------------------------------------------
   R44–R47 · Bid-night voting
   --------------------------------------------------------------------- */

export interface VoteTally {
  yes: number
  no: number
  abstain: number
}

export type RoundOutcome = 'pass' | 'reject' | 'below_quorum'

/** R44 — threshold = floor(fraction × eligible) + 1. */
export function votingThreshold(eligibleVoters: number, policy: Policy = POLICY): number {
  return Math.floor(policy.voting.thresholdFraction * eligibleVoters) + 1
}

/** R47 — quorum = fraction × eligible, rounded up. */
export function votingQuorum(eligibleVoters: number, policy: Policy = POLICY): number {
  return Math.ceil(policy.voting.quorumFraction * eligibleVoters)
}

/**
 * R45–R47 — the full result. Quorum is checked first: below quorum the
 * round is blocked, and the controller must extend voting or explicitly
 * override with a recorded reason.
 */
export function computeRoundOutcome(
  tally: VoteTally,
  eligibleVoters: number,
  options: { quorumOverridden?: boolean; policy?: Policy } = {}
): {
  outcome: RoundOutcome
  threshold: number
  quorum: number
  ballotsCast: number
} {
  const policy = options.policy ?? POLICY
  const threshold = votingThreshold(eligibleVoters, policy)
  const quorum = votingQuorum(eligibleVoters, policy)
  const ballotsCast = tally.yes + tally.no + tally.abstain

  if (ballotsCast < quorum && !options.quorumOverridden) {
    return { outcome: 'below_quorum', threshold, quorum, ballotsCast }
  }

  // R46 — an abstention is recorded distinctly and does not count toward
  // rejection.
  return {
    outcome: tally.no >= threshold ? 'reject' : 'pass',
    threshold,
    quorum,
    ballotsCast,
  }
}

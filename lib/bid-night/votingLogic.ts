import {
  POLICY,
  computeRoundOutcome,
  votingQuorum,
  votingThreshold,
  type Policy,
  type RoundOutcome,
  type VoteTally,
} from '@/lib/policy'

/**
 * Bid-night voting — PRD §5.8 (R44–R49).
 *
 * The arithmetic lives in lib/policy.ts so the client, any server handler
 * and the database function all agree. This module is the bid-night
 * facing wrapper.
 */

export interface VoteCounts {
  yes: number
  no: number
  abstain: number
}

export interface VotingSession {
  id: string
  eligible_voters: string[]
  status: string
}

/** R44 — threshold = floor(threshold_fraction × eligible_voters) + 1. */
export function calculateThreshold(eligibleVoters: number, policy: Policy = POLICY): number {
  return votingThreshold(eligibleVoters, policy)
}

/** R47 — a vote is valid only when ballots cast reach quorum_fraction × eligible. */
export function calculateQuorum(eligibleVoters: number, policy: Policy = POLICY): number {
  return votingQuorum(eligibleVoters, policy)
}

/**
 * R45–R47 — the full outcome, quorum included.
 *
 * The previous implementation checked only `no >= threshold` and had no
 * quorum concept at all, so the PRD's own worked example (40 eligible,
 * 12 ballots cast, 1 NO — "below quorum, blocked") certified as a `pass`.
 * An abstention is recorded distinctly and never counts toward rejection
 * (R46), despite what the old comment claimed.
 */
export function calculateOutcome(
  votes: VoteCounts,
  eligibleVoters: number,
  options: { quorumOverridden?: boolean; policy?: Policy } = {}
): {
  outcome: RoundOutcome
  threshold: number
  quorum: number
  ballotsCast: number
} {
  const tally: VoteTally = votes
  return computeRoundOutcome(tally, eligibleVoters, options)
}

/**
 * @deprecated Use calculateOutcome, which also enforces quorum (R47).
 * Retained so existing call sites keep compiling; it cannot report the
 * below-quorum state.
 */
export function calculateResult(votes: VoteCounts, threshold: number): 'pass' | 'reject' {
  return votes.no >= threshold ? 'reject' : 'pass'
}

/** R49 — ballots are accepted only from brothers on the eligible roster. */
export function isEligibleToVote(brotherId: string, session: VotingSession): boolean {
  return Array.isArray(session.eligible_voters) && session.eligible_voters.includes(brotherId)
}

export function formatTimeRemaining(milliseconds: number): string {
  if (milliseconds <= 0) return '0:00'

  const totalSeconds = Math.ceil(milliseconds / 1000)
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = totalSeconds % 60

  return `${minutes}:${seconds.toString().padStart(2, '0')}`
}

export function calculateTimeRemaining(
  startedAt: string | null,
  baseDuration: number,
  extendedAt: string | null = null,
  extensionDuration: number = POLICY.voting.extensionSeconds * 1000
): number {
  if (!startedAt) return baseDuration

  const elapsed = Date.now() - new Date(startedAt).getTime()
  const totalDuration = baseDuration + (extendedAt ? extensionDuration : 0)

  return Math.max(0, totalDuration - elapsed)
}

export function isVotingComplete(votesReceived: number, eligibleVoters: number): boolean {
  return votesReceived >= eligibleVoters
}

export function getVotePercentage(votesReceived: number, eligibleVoters: number): number {
  if (eligibleVoters === 0) return 0
  return Math.round((votesReceived / eligibleVoters) * 100)
}

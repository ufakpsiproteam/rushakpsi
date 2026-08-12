import { createHash, randomBytes, timingSafeEqual } from 'crypto'

/**
 * Brother invitation tokens — PRD S7, R51, §6.2.2.
 *
 * Only the hash is ever stored, so a database read cannot be replayed as
 * an invitation. Tokens are 32 random bytes from a cryptographic RNG,
 * hex-encoded to 64 characters — the same shape the PRD specifies for
 * check-in tokens (R14).
 */

export function generateInviteToken(): string {
  return randomBytes(32).toString('hex')
}

export function hashInviteToken(token: string): string {
  return createHash('sha256').update(token).digest('hex')
}

export function tokenLooksValid(token: unknown): token is string {
  return typeof token === 'string' && /^[0-9a-f]{64}$/.test(token)
}

/** Constant-time comparison, for anywhere two hashes are compared in JS. */
export function hashesMatch(a: string, b: string): boolean {
  const bufA = Buffer.from(a, 'utf8')
  const bufB = Buffer.from(b, 'utf8')
  if (bufA.length !== bufB.length) return false
  return timingSafeEqual(bufA, bufB)
}

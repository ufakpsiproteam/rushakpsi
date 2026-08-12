import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { createSupabaseServerClient } from './supabase-server'

/**
 * Server-side authorization. Every privileged handler goes through here.
 *
 * PRD S4: the service-role key is only ever used after the caller's
 * identity has been resolved with auth.getUser() AND their role looked up
 * independently, server-side.
 * PRD S12: handlers must also validate their *target*, not just the
 * caller's privilege — see assertTargetIsRushee / assertTargetIsBrother.
 */

export type AccessLevel = 'basic' | 'pro' | 'recruitment' | 'admin'

export type BrotherRole =
  | 'admin'
  | 'recruitment_director'
  | 'professional_team'
  | 'professional_chair'

export const BROTHER_ROLES: BrotherRole[] = [
  'admin',
  'recruitment_director',
  'professional_team',
  'professional_chair',
]

export interface Caller {
  userId: string
  email: string | null
  accountType: 'brother' | 'rushee'
  accessLevel: AccessLevel | null
  roles: BrotherRole[]
}

export interface AuthFailure {
  error: string
  status: number
}

let cachedServiceClient: SupabaseClient | null = null

/**
 * Service-role client. Created lazily so a missing env var surfaces as a
 * 500 on the one route that needs it rather than a build-time crash.
 */
export function getServiceClient(): SupabaseClient {
  if (!cachedServiceClient) {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY
    if (!url || !key) {
      throw new Error('Supabase service role credentials are not configured')
    }
    cachedServiceClient = createClient(url, key, {
      auth: { autoRefreshToken: false, persistSession: false },
    })
  }
  return cachedServiceClient
}

function isAuthFailure(value: unknown): value is AuthFailure {
  return typeof value === 'object' && value !== null && 'error' in value
}

/**
 * Resolve who a user id belongs to and what they may do. Reads the
 * hierarchical access_level *and* the additive brother_roles table, so
 * callers never have to know which of the two a given capability lives in.
 */
async function resolveCaller(userId: string, email: string | null): Promise<Caller | null> {
  const service = getServiceClient()

  const { data: brother } = await service
    .from('brothers')
    .select('id, email, access_level')
    .eq('id', userId)
    .maybeSingle()

  if (brother) {
    const { data: roleRows } = await service
      .from('brother_roles')
      .select('role')
      .eq('brother_id', userId)

    const roles = (roleRows || [])
      .map((row: { role: string }) => row.role as BrotherRole)
      .filter((role): role is BrotherRole => BROTHER_ROLES.includes(role))

    const accessLevel = (brother.access_level || 'basic') as AccessLevel

    // An admin by access_level holds the admin role implicitly, so callers
    // can check a single vocabulary.
    if (accessLevel === 'admin' && !roles.includes('admin')) {
      roles.push('admin')
    }

    return {
      userId,
      email: brother.email ?? email,
      accountType: 'brother',
      accessLevel,
      roles,
    }
  }

  const { data: rushee } = await service
    .from('rushees')
    .select('id, email')
    .eq('id', userId)
    .maybeSingle()

  if (rushee) {
    return {
      userId,
      email: rushee.email ?? email,
      accountType: 'rushee',
      accessLevel: null,
      roles: [],
    }
  }

  return null
}

/** True when the caller holds any of the given roles (admin always passes). */
export function callerHasRole(caller: Caller, ...roles: BrotherRole[]): boolean {
  if (caller.roles.includes('admin')) return true
  return roles.some((role) => caller.roles.includes(role))
}

/**
 * "Leadership" — anyone permitted to read the review board.
 * Mirrors fn_is_leadership() in the database so the two cannot drift.
 */
export function callerIsLeadership(caller: Caller): boolean {
  if (caller.accountType !== 'brother') return false
  if (caller.accessLevel && ['admin', 'pro', 'recruitment'].includes(caller.accessLevel)) return true
  return caller.roles.length > 0
}

export function callerIsAdmin(caller: Caller): boolean {
  return caller.accountType === 'brother' && caller.roles.includes('admin')
}

interface RequireOptions {
  /** Caller must hold at least one of these roles. */
  roles?: BrotherRole[]
  /** Caller must satisfy callerIsLeadership(). */
  leadership?: boolean
}

function authorize(caller: Caller, options: RequireOptions): AuthFailure | null {
  if (options.leadership && !callerIsLeadership(caller)) {
    return { error: 'Forbidden', status: 403 }
  }
  if (options.roles && options.roles.length > 0 && !callerHasRole(caller, ...options.roles)) {
    return { error: 'Forbidden', status: 403 }
  }
  return null
}

/**
 * For route handlers. Verifies the bearer token, resolves the caller, and
 * checks the requested capability.
 */
export async function requireBearer(
  authHeader: string | null,
  options: RequireOptions = {}
): Promise<{ caller: Caller } | AuthFailure> {
  if (!authHeader || !authHeader.toLowerCase().startsWith('bearer ')) {
    return { error: 'Unauthorized', status: 401 }
  }

  const token = authHeader.slice(7).trim()
  if (!token) return { error: 'Unauthorized', status: 401 }

  const service = getServiceClient()
  const { data, error } = await service.auth.getUser(token)

  if (error || !data?.user) {
    return { error: 'Unauthorized', status: 401 }
  }

  const caller = await resolveCaller(data.user.id, data.user.email ?? null)
  if (!caller) {
    return { error: 'Unauthorized', status: 401 }
  }

  const failure = authorize(caller, options)
  if (failure) return failure

  return { caller }
}

/**
 * For Server Actions, which carry the session in cookies rather than an
 * Authorization header.
 */
export async function requireSession(
  options: RequireOptions = {}
): Promise<{ caller: Caller } | AuthFailure> {
  const supabase = await createSupabaseServerClient()
  const { data, error } = await supabase.auth.getUser()

  if (error || !data?.user) {
    return { error: 'Unauthorized', status: 401 }
  }

  const caller = await resolveCaller(data.user.id, data.user.email ?? null)
  if (!caller) {
    return { error: 'Unauthorized', status: 401 }
  }

  const failure = authorize(caller, options)
  if (failure) return failure

  return { caller }
}

export function unwrapAuth<T extends { caller: Caller } | AuthFailure>(
  result: T
): { caller: Caller | null; failure: AuthFailure | null } {
  if (isAuthFailure(result)) {
    return { caller: null, failure: result }
  }
  return { caller: result.caller, failure: null }
}

/**
 * PRD S12 — validate the target of a state-changing operation.
 * Deleting "a user by id" is not the same as deleting a rushee; without
 * this an admin (or a replayed request) could delete another admin.
 */
export async function assertTargetIsRushee(rusheeId: string): Promise<AuthFailure | null> {
  const service = getServiceClient()
  const { data } = await service.from('rushees').select('id').eq('id', rusheeId).maybeSingle()
  if (!data) return { error: 'Target is not a rushee', status: 404 }
  return null
}

export async function assertTargetIsBrother(brotherId: string): Promise<AuthFailure | null> {
  const service = getServiceClient()
  const { data } = await service.from('brothers').select('id').eq('id', brotherId).maybeSingle()
  if (!data) return { error: 'Target is not a brother', status: 404 }
  return null
}

/**
 * PRD §7.6 / S8 — append-only audit record for privileged mutations.
 * Written with the service role so a failed audit write can never be the
 * reason a legitimate action succeeds silently; errors are logged and
 * swallowed so auditing never blocks the operation itself.
 */
export async function logAudit(entry: {
  actorId: string | null
  action: string
  entityType: string
  entityId?: string | null
  before?: unknown
  after?: unknown
  metadata?: Record<string, unknown>
}): Promise<void> {
  try {
    const service = getServiceClient()
    await service.from('audit_log').insert({
      actor_id: entry.actorId,
      action: entry.action,
      entity_type: entry.entityType,
      entity_id: entry.entityId ?? null,
      before: entry.before ?? null,
      after: entry.after ?? null,
      metadata: entry.metadata ?? {},
    })
  } catch (error) {
    console.error('[audit] failed to write audit entry', entry.action)
  }
}

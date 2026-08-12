import { supabase } from './supabase'

export type AccountType = 'brother' | 'rushee'
export type AccessLevel = 'admin' | 'recruitment' | 'pro' | 'basic'

export interface UserProfile {
  id: string
  email: string
  name: string
  account_type: AccountType
  access_level: AccessLevel
}

/**
 * Sign up a new user. Account + profile creation happens server-side
 * (see app/api/auth/signup/route.ts) using the service role, so there's
 * no client-session/RLS timing race — calling supabase.auth.signUp()
 * here and immediately inserting the profile row from the browser used
 * to lose that race intermittently and leave orphaned auth users.
 */
export async function signUp(
  email: string,
  password: string,
  name: string,
  accountType: AccountType,
  accessLevel: AccessLevel = 'basic',
  additionalData?: any
) {
  const { major, year } = additionalData || {}

  const response = await fetch('/api/auth/signup', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password, name, accountType, accessLevel, major, year }),
  })

  const result = await response.json()

  if (!response.ok) {
    throw new Error(result.error || 'Failed to create account')
  }

  // The account was created via the admin API, which doesn't hand the
  // browser a session — sign in now to establish one.
  const { data, error } = await supabase.auth.signInWithPassword({ email, password })
  if (error) throw error

  return data
}

// Sign in an existing user
export async function signIn(email: string, password: string) {
  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  })

  if (error) throw error
  return data
}

// Sign out the current user
export async function signOut() {
  const { error } = await supabase.auth.signOut()
  if (error) throw error
}

// Get the current user's profile
export async function getCurrentUserProfile(): Promise<UserProfile | null> {
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) return null

  const { data: profile, error } = await supabase
    .from('user_profiles')
    .select('*')
    .eq('id', user.id)
    .single()

  if (error) throw error
  return profile
}

// Check if user has specific access level or higher
export function hasAccessLevel(
  userProfile: UserProfile | null,
  requiredLevel: AccessLevel
): boolean {
  if (!userProfile) return false

  const levels: AccessLevel[] = ['basic', 'pro', 'recruitment', 'admin']
  const userLevelIndex = levels.indexOf(userProfile.access_level)
  const requiredLevelIndex = levels.indexOf(requiredLevel)

  return userLevelIndex >= requiredLevelIndex
}

// Check if user is a brother
export function isBrother(userProfile: UserProfile | null): boolean {
  return userProfile?.account_type === 'brother'
}

// Check if user is a rushee
export function isRushee(userProfile: UserProfile | null): boolean {
  return userProfile?.account_type === 'rushee'
}

// Check if user is an admin
export function isAdmin(userProfile: UserProfile | null): boolean {
  return userProfile?.account_type === 'brother' && userProfile?.access_level === 'admin'
}

// Check if user is a pro (exactly)
export function isPro(userProfile: UserProfile | null): boolean {
  return userProfile?.account_type === 'brother' && userProfile?.access_level === 'pro'
}

// Check if user has pro or higher access level
export function isProOrHigher(userProfile: UserProfile | null): boolean {
  return hasAccessLevel(userProfile, 'pro')
}

// ============================================
// Role-based access functions
// ============================================

// Get all roles for a brother
export async function getBrotherRoles(brotherId: string): Promise<string[]> {
  const { data, error } = await supabase
    .from('brother_roles')
    .select('role')
    .eq('brother_id', brotherId)

  if (error || !data) return []
  return data.map((r: { role: string }) => r.role)
}

// Check if brother has specific role
export async function hasRole(
  brotherId: string | undefined,
  role: 'recruitment_director' | 'professional_team'
): Promise<boolean> {
  if (!brotherId) return false

  const { data, error } = await supabase
    .from('brother_roles')
    .select('role')
    .eq('brother_id', brotherId)
    .eq('role', role)
    .single()

  return !error && !!data
}

// Check if brother has any elevated role
export async function hasAnyRole(brotherId: string | undefined): Promise<boolean> {
  if (!brotherId) return false

  const { count, error } = await supabase
    .from('brother_roles')
    .select('*', { count: 'exact', head: true })
    .eq('brother_id', brotherId)

  return !error && (count ?? 0) > 0
}

// Get cuts page access (for both recruitment directors and professional team)
export async function hasCutsAccess(
  profile: UserProfile | null
): Promise<boolean> {
  if (!profile || profile.account_type !== 'brother') return false

  // Admins always have access
  if (profile.access_level === 'admin') return true

  // Check if they have recruitment_director or professional_team role
  const roles = await getBrotherRoles(profile.id)
  return roles.includes('recruitment_director') || roles.includes('professional_team')
}

// Request password reset email
export async function requestPasswordReset(email: string) {
  // Use the current origin (works for both localhost and production)
  const redirectUrl = `${window.location.origin}/auth/reset-password`

  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: redirectUrl,
  })

  if (error) throw error
}

// Update user password (called after reset link is clicked)
export async function updatePassword(newPassword: string) {
  const { error } = await supabase.auth.updateUser({
    password: newPassword,
  })

  if (error) throw error
}

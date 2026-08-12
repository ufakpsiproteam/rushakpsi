import { UserProfile } from './auth'

export const ROUTES = {
  LANDING: '/',
  SPLASH: '/splash',
  SIGNIN: '/auth/signin',
  SIGNUP: '/auth/signup',
  RUSHEE_DASHBOARD: '/rushee/dashboard',
  BROTHER_DASHBOARD: '/brother/dashboard',
  ADMIN_DASHBOARD: '/admin/dashboard',
} as const

export function getDashboardRoute(profile: UserProfile | null): string {
  if (!profile) return ROUTES.LANDING

  if (profile.account_type === 'brother' && profile.access_level === 'admin') {
    return ROUTES.ADMIN_DASHBOARD
  } else if (profile.account_type === 'brother') {
    return ROUTES.BROTHER_DASHBOARD
  } else if (profile.account_type === 'rushee') {
    return ROUTES.RUSHEE_DASHBOARD
  }

  return ROUTES.LANDING
}

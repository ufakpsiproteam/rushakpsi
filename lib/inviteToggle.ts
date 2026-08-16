import { getServiceClient } from '@/lib/server-auth'

/**
 * Brother invite kill switch — settings.invites.brother_signup_enabled in
 * app_config. Absent/true = enabled (default), only an explicit `false`
 * disables it.
 */
export async function areBrotherInvitesEnabled(): Promise<boolean> {
  const service = getServiceClient()
  const { data } = await service
    .from('app_config')
    .select('settings')
    .eq('id', true)
    .maybeSingle()

  return data?.settings?.invites?.brother_signup_enabled !== false
}

export const BROTHER_INVITES_DISABLED_MESSAGE =
  'New brother account creation is currently turned off.'

import { NextRequest, NextResponse } from 'next/server'
import { requireBearer, unwrapAuth, getServiceClient, logAudit } from '@/lib/server-auth'
import { areBrotherInvitesEnabled } from '@/lib/inviteToggle'

/**
 * Brother invite kill switch — admin-only read/write of
 * settings.invites.brother_signup_enabled in app_config.
 */

export async function GET(request: NextRequest) {
  const { caller, failure } = unwrapAuth(
    await requireBearer(request.headers.get('authorization'), { roles: ['admin'] })
  )

  if (failure || !caller) {
    return NextResponse.json({ error: failure?.error ?? 'Unauthorized' }, {
      status: failure?.status ?? 401,
    })
  }

  return NextResponse.json({ enabled: await areBrotherInvitesEnabled() })
}

export async function POST(request: NextRequest) {
  try {
    const { caller, failure } = unwrapAuth(
      await requireBearer(request.headers.get('authorization'), { roles: ['admin'] })
    )

    if (failure || !caller) {
      return NextResponse.json({ error: failure?.error ?? 'Unauthorized' }, {
        status: failure?.status ?? 401,
      })
    }

    const { enabled } = await request.json()
    if (typeof enabled !== 'boolean') {
      return NextResponse.json({ error: '`enabled` must be a boolean' }, { status: 400 })
    }

    const service = getServiceClient()
    const before = await areBrotherInvitesEnabled()

    const { data: row, error: readError } = await service
      .from('app_config')
      .select('settings')
      .eq('id', true)
      .maybeSingle()

    if (readError) {
      return NextResponse.json({ error: 'Could not read the current settings' }, { status: 500 })
    }

    const settings = { ...(row?.settings ?? {}) }
    settings.invites = { ...(settings.invites ?? {}), brother_signup_enabled: enabled }

    const { error: writeError } = await service
      .from('app_config')
      .update({ settings, updated_by: caller.userId })
      .eq('id', true)

    if (writeError) {
      return NextResponse.json({ error: 'Could not update the setting' }, { status: 500 })
    }

    await logAudit({
      actorId: caller.userId,
      action: 'invite_toggle.set',
      entityType: 'app_config',
      before: { brother_signup_enabled: before },
      after: { brother_signup_enabled: enabled },
    })

    return NextResponse.json({ enabled })
  } catch {
    return NextResponse.json({ error: 'An unexpected error occurred' }, { status: 500 })
  }
}

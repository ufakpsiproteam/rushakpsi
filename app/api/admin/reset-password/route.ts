import { NextRequest, NextResponse } from 'next/server'
import { requireBearer, unwrapAuth, getServiceClient, logAudit } from '@/lib/server-auth'
import { POLICY_DEFAULTS, validatePassword } from '@/lib/policy'

/**
 * Admin-assisted password reset — PRD R53.
 *
 * Used at the check-in table, where a rushee is standing in front of a
 * brother. Two things are enforced here that were previously only
 * client-side:
 *   · the identity affirmation (R53) must be present in the request,
 *   · the password minimum is the single shared rule (R52 — 10 chars),
 *     not the 8 this route used to accept.
 * Every admin-assisted reset is audited.
 */
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

    const { userId, newPassword, identityConfirmed } = await request.json()

    if (!userId || !newPassword) {
      return NextResponse.json(
        { error: 'User ID and new password are required' },
        { status: 400 }
      )
    }

    if (identityConfirmed !== true) {
      return NextResponse.json(
        {
          error:
            'You must confirm that you verified the user’s identity and that they entered the password themselves.',
        },
        { status: 400 }
      )
    }

    const passwordError = validatePassword(String(newPassword), POLICY_DEFAULTS)
    if (passwordError) {
      return NextResponse.json({ error: passwordError }, { status: 400 })
    }

    const service = getServiceClient()

    // S12 — the target must be a real account in this system, not an
    // arbitrary auth user id.
    const [{ data: brother }, { data: rushee }] = await Promise.all([
      service.from('brothers').select('id, email').eq('id', userId).maybeSingle(),
      service.from('rushees').select('id, email').eq('id', userId).maybeSingle(),
    ])

    if (!brother && !rushee) {
      return NextResponse.json({ error: 'No such account' }, { status: 404 })
    }

    const { error: updateError } = await service.auth.admin.updateUserById(userId, {
      password: newPassword,
    })

    if (updateError) {
      console.error('[reset-password] update failed')
      return NextResponse.json({ error: updateError.message }, { status: 500 })
    }

    await logAudit({
      actorId: caller.userId,
      action: 'password.admin_reset',
      entityType: brother ? 'brother' : 'rushee',
      entityId: userId,
      metadata: { identity_confirmed: true },
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('[reset-password] unexpected error')
    return NextResponse.json({ error: 'An unexpected error occurred' }, { status: 500 })
  }
}

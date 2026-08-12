import { NextRequest, NextResponse } from 'next/server'
import { getServiceClient, logAudit } from '@/lib/server-auth'
import { hashInviteToken, tokenLooksValid } from '@/lib/invite-tokens'
import { POLICY_DEFAULTS, validatePassword } from '@/lib/policy'

/**
 * Accept a brother invitation — PRD §6.2.2, R51, R54.
 *
 * Creates the authentication record and the brother profile together. If
 * the profile write fails the auth user is removed again, so a partial
 * failure leaves no orphaned state (R54).
 */
export async function POST(request: NextRequest) {
  try {
    const { token, password } = await request.json()

    if (!tokenLooksValid(token)) {
      return NextResponse.json({ error: 'This invitation link is not valid.' }, { status: 400 })
    }

    const passwordError = validatePassword(String(password || ''), POLICY_DEFAULTS)
    if (passwordError) {
      return NextResponse.json({ error: passwordError }, { status: 400 })
    }

    const service = getServiceClient()
    const tokenHash = hashInviteToken(token)

    const { data: invite } = await service
      .from('brother_invites')
      .select('id, email, full_name, expires_at, accepted_at, revoked_at')
      .eq('token_hash', tokenHash)
      .maybeSingle()

    if (
      !invite ||
      invite.accepted_at ||
      invite.revoked_at ||
      new Date(invite.expires_at).getTime() < Date.now()
    ) {
      return NextResponse.json(
        { error: 'This invitation is no longer valid. Ask an admin to send a new one.' },
        { status: 400 }
      )
    }

    // Claim the invitation before creating anything, so two simultaneous
    // submissions cannot both succeed. The conditional update is the
    // single-use guarantee (R51).
    const { data: claimed } = await service
      .from('brother_invites')
      .update({ accepted_at: new Date().toISOString() })
      .eq('id', invite.id)
      .is('accepted_at', null)
      .is('revoked_at', null)
      .select('id')

    if (!claimed || claimed.length === 0) {
      return NextResponse.json(
        { error: 'This invitation has already been used.' },
        { status: 409 }
      )
    }

    const { data: created, error: createError } = await service.auth.admin.createUser({
      email: invite.email,
      password,
      email_confirm: true,
      user_metadata: { name: invite.full_name, account_type: 'brother' },
    })

    if (createError || !created?.user) {
      // Release the claim so the invitation can be retried.
      await service.from('brother_invites').update({ accepted_at: null }).eq('id', invite.id)
      return NextResponse.json(
        { error: createError?.message || 'Could not create the account.' },
        { status: 400 }
      )
    }

    const userId = created.user.id

    const { error: profileError } = await service.from('brothers').insert({
      id: userId,
      name: invite.full_name,
      email: invite.email,
      access_level: 'basic',
    })

    if (profileError) {
      // R54 — compensate, so no orphaned auth user is left behind.
      await service.auth.admin.deleteUser(userId)
      await service.from('brother_invites').update({ accepted_at: null }).eq('id', invite.id)
      console.error('[invites/accept] profile creation failed, rolled back')
      return NextResponse.json({ error: 'Could not create the account.' }, { status: 500 })
    }

    await service.from('brother_invites').update({ accepted_by: userId }).eq('id', invite.id)

    await logAudit({
      actorId: userId,
      action: 'invite.accept',
      entityType: 'brother',
      entityId: userId,
      metadata: { invite_id: invite.id },
    })

    return NextResponse.json({ success: true, email: invite.email })
  } catch (error) {
    console.error('[invites/accept] unexpected error')
    return NextResponse.json({ error: 'An unexpected error occurred' }, { status: 500 })
  }
}

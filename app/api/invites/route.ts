import { NextRequest, NextResponse } from 'next/server'
import { requireBearer, unwrapAuth, getServiceClient, logAudit } from '@/lib/server-auth'
import { generateInviteToken, hashInviteToken } from '@/lib/invite-tokens'
import { POLICY_DEFAULTS } from '@/lib/policy'

/**
 * Issue and revoke brother invitations — PRD §6.2.2, S7.
 *
 * Replaces the previous flow, where brother accounts were created by
 * anyone who knew a single shared code that shipped in the client bundle.
 * Invitations are per-person, single-use and expiring.
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

  const service = getServiceClient()

  const { data, error } = await service
    .from('brother_invites')
    .select('id, email, full_name, expires_at, accepted_at, revoked_at, created_at')
    .order('created_at', { ascending: false })
    .limit(200)

  if (error) {
    return NextResponse.json({ error: 'Could not load invitations' }, { status: 500 })
  }

  return NextResponse.json({ data: data || [] })
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

    const { email, fullName } = await request.json()

    const normalizedEmail = String(email || '').trim().toLowerCase()
    const normalizedName = String(fullName || '').trim()

    if (!normalizedEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) {
      return NextResponse.json({ error: 'A valid email address is required' }, { status: 400 })
    }

    if (!normalizedName) {
      return NextResponse.json({ error: 'A full name is required' }, { status: 400 })
    }

    const service = getServiceClient()

    const { data: existing } = await service
      .from('brothers')
      .select('id')
      .ilike('email', normalizedEmail)
      .maybeSingle()

    if (existing) {
      return NextResponse.json(
        { error: 'That email already belongs to a brother account.' },
        { status: 409 }
      )
    }

    // Supersede any outstanding invitation for the same person, so a
    // resend cannot leave two live tokens.
    await service
      .from('brother_invites')
      .update({ revoked_at: new Date().toISOString() })
      .ilike('email', normalizedEmail)
      .is('accepted_at', null)
      .is('revoked_at', null)

    const token = generateInviteToken()
    const expiresAt = new Date(
      Date.now() + POLICY_DEFAULTS.invites.ttlDays * 24 * 60 * 60 * 1000
    ).toISOString()

    const { data: invite, error: insertError } = await service
      .from('brother_invites')
      .insert({
        token_hash: hashInviteToken(token),
        email: normalizedEmail,
        full_name: normalizedName,
        issued_by: caller.userId,
        expires_at: expiresAt,
      })
      .select('id')
      .single()

    if (insertError || !invite) {
      console.error('[invites] could not create invitation')
      return NextResponse.json({ error: 'Could not create the invitation' }, { status: 500 })
    }

    await logAudit({
      actorId: caller.userId,
      action: 'invite.issue',
      entityType: 'brother_invite',
      entityId: invite.id,
      after: { email: normalizedEmail, expires_at: expiresAt },
    })

    const origin = process.env.NEXT_PUBLIC_SITE_URL || new URL(request.url).origin

    // The raw token is returned exactly once, here, so an admin can send
    // it. It is never stored and cannot be retrieved again.
    return NextResponse.json({
      success: true,
      inviteId: invite.id,
      inviteUrl: `${origin}/invite/${token}`,
      expiresAt,
    })
  } catch (error) {
    console.error('[invites] unexpected error')
    return NextResponse.json({ error: 'An unexpected error occurred' }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const { caller, failure } = unwrapAuth(
      await requireBearer(request.headers.get('authorization'), { roles: ['admin'] })
    )

    if (failure || !caller) {
      return NextResponse.json({ error: failure?.error ?? 'Unauthorized' }, {
        status: failure?.status ?? 401,
      })
    }

    const { inviteId } = await request.json()
    if (!inviteId) {
      return NextResponse.json({ error: 'Invite ID is required' }, { status: 400 })
    }

    const service = getServiceClient()

    const { error } = await service
      .from('brother_invites')
      .update({ revoked_at: new Date().toISOString() })
      .eq('id', inviteId)
      .is('accepted_at', null)

    if (error) {
      return NextResponse.json({ error: 'Could not revoke the invitation' }, { status: 500 })
    }

    await logAudit({
      actorId: caller.userId,
      action: 'invite.revoke',
      entityType: 'brother_invite',
      entityId: inviteId,
    })

    return NextResponse.json({ success: true })
  } catch {
    return NextResponse.json({ error: 'An unexpected error occurred' }, { status: 500 })
  }
}

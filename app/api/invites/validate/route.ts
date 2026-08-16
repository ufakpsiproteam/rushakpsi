import { NextRequest, NextResponse } from 'next/server'
import { getServiceClient } from '@/lib/server-auth'
import { hashInviteToken, tokenLooksValid } from '@/lib/invite-tokens'
import { areBrotherInvitesEnabled } from '@/lib/inviteToggle'

/**
 * Validate an invitation token so /invite/[token] can pre-fill the name
 * and email (PRD §6.2.2). Public, but returns nothing at all unless the
 * token is valid, unexpired, unrevoked and unused (PRD S3).
 */
export async function POST(request: NextRequest) {
  try {
    const { token } = await request.json()

    if (!tokenLooksValid(token)) {
      return NextResponse.json({ valid: false }, { status: 200 })
    }

    if (!(await areBrotherInvitesEnabled())) {
      return NextResponse.json({ valid: false }, { status: 200 })
    }

    const service = getServiceClient()

    const { data: invite } = await service
      .from('brother_invites')
      .select('email, full_name, expires_at, accepted_at, revoked_at')
      .eq('token_hash', hashInviteToken(token))
      .maybeSingle()

    if (
      !invite ||
      invite.accepted_at ||
      invite.revoked_at ||
      new Date(invite.expires_at).getTime() < Date.now()
    ) {
      return NextResponse.json({ valid: false }, { status: 200 })
    }

    return NextResponse.json({
      valid: true,
      email: invite.email,
      fullName: invite.full_name,
    })
  } catch {
    return NextResponse.json({ valid: false }, { status: 200 })
  }
}

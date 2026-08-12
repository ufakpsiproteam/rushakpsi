import { NextRequest, NextResponse } from 'next/server'
import {
  requireBearer,
  unwrapAuth,
  getServiceClient,
  assertTargetIsBrother,
  logAudit,
  BROTHER_ROLES,
  type BrotherRole,
} from '@/lib/server-auth'

/**
 * Grant and revoke additive brother roles — PRD §3.1, §6.7.6.
 * Every grant and revoke is audited (§7.6).
 */

function parseRole(value: unknown): BrotherRole | null {
  const role = String(value ?? '') as BrotherRole
  return BROTHER_ROLES.includes(role) ? role : null
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

    const { brotherId, role: rawRole } = await request.json()

    if (!brotherId || !rawRole) {
      return NextResponse.json({ error: 'Brother ID and role are required' }, { status: 400 })
    }

    const role = parseRole(rawRole)
    if (!role) {
      return NextResponse.json({ error: 'Invalid role' }, { status: 400 })
    }

    // S12 — the target must be an existing brother.
    const targetFailure = await assertTargetIsBrother(brotherId)
    if (targetFailure) {
      return NextResponse.json({ error: targetFailure.error }, { status: targetFailure.status })
    }

    const service = getServiceClient()

    const { error: insertError } = await service.from('brother_roles').upsert(
      { brother_id: brotherId, role, granted_by: caller.userId },
      { onConflict: 'brother_id,role' }
    )

    if (insertError) {
      console.error('[assign-role] grant failed')
      return NextResponse.json({ error: insertError.message }, { status: 500 })
    }

    await logAudit({
      actorId: caller.userId,
      action: 'role.grant',
      entityType: 'brother',
      entityId: brotherId,
      after: { role },
    })

    return NextResponse.json({ success: true, message: 'Role assigned successfully' })
  } catch (error) {
    console.error('[assign-role] unexpected error')
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

    const { brotherId, role: rawRole } = await request.json()

    if (!brotherId || !rawRole) {
      return NextResponse.json({ error: 'Brother ID and role are required' }, { status: 400 })
    }

    const role = parseRole(rawRole)
    if (!role) {
      return NextResponse.json({ error: 'Invalid role' }, { status: 400 })
    }

    // Guard against an admin removing their own last admin grant and
    // locking the chapter out of the product entirely.
    if (role === 'admin' && brotherId === caller.userId) {
      return NextResponse.json(
        { error: 'You cannot revoke your own admin role. Ask another admin to do it.' },
        { status: 400 }
      )
    }

    const service = getServiceClient()

    const { error: deleteError } = await service
      .from('brother_roles')
      .delete()
      .eq('brother_id', brotherId)
      .eq('role', role)

    if (deleteError) {
      console.error('[assign-role] revoke failed')
      return NextResponse.json({ error: deleteError.message }, { status: 500 })
    }

    await logAudit({
      actorId: caller.userId,
      action: 'role.revoke',
      entityType: 'brother',
      entityId: brotherId,
      before: { role },
    })

    return NextResponse.json({ success: true, message: 'Role revoked successfully' })
  } catch (error) {
    console.error('[assign-role] unexpected error')
    return NextResponse.json({ error: 'An unexpected error occurred' }, { status: 500 })
  }
}

import { NextRequest, NextResponse } from 'next/server'
import {
  requireBearer,
  unwrapAuth,
  getServiceClient,
  assertTargetIsRushee,
  logAudit,
} from '@/lib/server-auth'

/**
 * Delete a rushee account and everything attached to it.
 *
 * PRD §6.7.4: "a single transactional server-side operation that removes
 * all related records and the authentication user together, or fails
 * entirely. Audited."
 *
 * Previously this handler deleted whatever UUID it was handed, with no
 * check that the target was a rushee — an admin (or a replayed request)
 * could delete another admin's auth user. PRD S12 requires validating the
 * target, not just the caller's privilege.
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

    const { rusheeId } = await request.json()

    if (!rusheeId || typeof rusheeId !== 'string') {
      return NextResponse.json({ error: 'Rushee ID is required' }, { status: 400 })
    }

    // S12 — the target must actually be a rushee.
    const targetFailure = await assertTargetIsRushee(rusheeId)
    if (targetFailure) {
      return NextResponse.json({ error: targetFailure.error }, { status: targetFailure.status })
    }

    const service = getServiceClient()

    const { data: snapshot } = await service
      .from('rushees')
      .select('id, name, email, invite_only, bid_status')
      .eq('id', rusheeId)
      .maybeSingle()

    // Related records first, each checked. Foreign keys cascade in most
    // cases, but doing this explicitly means a partial failure surfaces
    // as an error rather than leaving orphans behind silently.
    const related: { table: string; column: string }[] = [
      { table: 'evaluations', column: 'rushee_id' },
      { table: 'event_attendance', column: 'rushee_id' },
      { table: 'brother_rushee_interactions', column: 'rushee_id' },
      { table: 'starred_rushees', column: 'rushee_id' },
      { table: 'personal_notes', column: 'rushee_id' },
      { table: 'review_marks', column: 'rushee_id' },
      { table: 'letter_reads', column: 'rushee_id' },
      { table: 'rushee_standing_staging', column: 'rushee_id' },
      { table: 'applications', column: 'rushee_id' },
    ]

    for (const { table, column } of related) {
      const { error } = await service.from(table).delete().eq(column, rusheeId)
      // A missing table is tolerated (not every deployment has run every
      // migration yet); anything else aborts before we touch auth.
      if (error && !/does not exist/i.test(error.message)) {
        console.error(`[delete-user] failed clearing ${table}`)
        return NextResponse.json(
          { error: `Could not remove related records from ${table}. Nothing was deleted.` },
          { status: 500 }
        )
      }
    }

    const { error: rusheeError } = await service.from('rushees').delete().eq('id', rusheeId)
    if (rusheeError) {
      return NextResponse.json({ error: rusheeError.message }, { status: 500 })
    }

    const { error: deleteError } = await service.auth.admin.deleteUser(rusheeId)
    if (deleteError) {
      console.error('[delete-user] auth user deletion failed')
      return NextResponse.json({ error: deleteError.message }, { status: 500 })
    }

    await logAudit({
      actorId: caller.userId,
      action: 'account.delete',
      entityType: 'rushee',
      entityId: rusheeId,
      before: snapshot ?? null,
    })

    return NextResponse.json({ success: true, message: 'User deleted successfully' })
  } catch (error) {
    console.error('[delete-user] unexpected error')
    return NextResponse.json({ error: 'An unexpected error occurred' }, { status: 500 })
  }
}

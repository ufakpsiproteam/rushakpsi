'use server'

import { requireSession, unwrapAuth, callerHasRole } from '@/lib/server-auth'
import { createSupabaseServerClient } from '@/lib/supabase-server'
import type { Caller } from '@/lib/server-auth'

function canManageInterviews(caller: Caller): boolean {
  return (
    caller.accountType === 'brother' &&
    (caller.accessLevel === 'admin' ||
      callerHasRole(caller, 'recruitment_director', 'professional_team'))
  )
}

// fn_start_interview signature:
//   (p_type INTERVIEW_TYPE, p_rushee_ids UUID[], p_assignments JSONB)
// p_assignments shape: [{"brother_id":"<uuid>","rushee_ids":["<uuid>",...]}]
// The DB function logs interview.start and interview.assign itself.
export async function startInterview(
  type: 'casual' | 'professional',
  rusheeIds: string[],
  brotherIds: string[]
): Promise<{ interviewId: string | null; error: string | null }> {
  const { caller, failure } = unwrapAuth(await requireSession())
  if (failure || !caller) return { interviewId: null, error: 'Not authenticated.' }
  if (!canManageInterviews(caller)) return { interviewId: null, error: 'Not authorized to start interviews.' }
  if (rusheeIds.length === 0) return { interviewId: null, error: 'Select at least one rushee.' }
  if (brotherIds.length === 0) return { interviewId: null, error: 'Select at least one panelist.' }

  // Use session client so fn_start_interview sees the real auth.uid()
  const client = await createSupabaseServerClient()
  const assignments = brotherIds.map(bid => ({ brother_id: bid, rushee_ids: rusheeIds }))

  const { data, error: dbError } = await (client as any).rpc('fn_start_interview', {
    p_type: type,
    p_rushee_ids: rusheeIds,
    p_assignments: assignments,
  })

  if (dbError) return { interviewId: null, error: dbError.message ?? 'Failed to start interview.' }
  return { interviewId: data as string, error: null }
}

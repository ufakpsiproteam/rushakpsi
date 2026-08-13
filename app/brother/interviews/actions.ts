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
//
// For professional interviews the caller still passes the plain
// brother/rushee pools and gets the historical cross-product (every
// panelist sees every candidate — that's the panel format). Casual
// interviews instead pass an explicit per-brother mapping: the rubric
// ("Each brother is assigned one PNM... one rubric per PNM") requires
// one brother never score more than one pledge, which a cross-product
// can't express. fn_guard_panelist_lock only blocks a brother having
// pending assignments across *different* interviews — it deliberately
// allows one brother on multiple rushees within the same interview for
// the professional panel case, so this constraint is enforced here.
export async function startInterview(
  type: 'casual' | 'professional',
  rusheeIds: string[],
  brotherIds: string[],
  casualAssignments?: Record<string, string>
): Promise<{ interviewId: string | null; error: string | null }> {
  const { caller, failure } = unwrapAuth(await requireSession())
  if (failure || !caller) return { interviewId: null, error: 'Not authenticated.' }
  if (!canManageInterviews(caller)) return { interviewId: null, error: 'Not authorized to start interviews.' }
  if (rusheeIds.length === 0) return { interviewId: null, error: 'Select at least one rushee.' }
  if (brotherIds.length === 0) return { interviewId: null, error: 'Select at least one panelist.' }

  let assignments: { brother_id: string; rushee_ids: string[] }[]

  if (type === 'casual') {
    if (!casualAssignments) return { interviewId: null, error: 'Assign each panelist to one pledge.' }
    const missing = brotherIds.filter(bid => !casualAssignments[bid])
    if (missing.length > 0) return { interviewId: null, error: 'Every panelist needs exactly one assigned pledge.' }
    const invalid = brotherIds.filter(bid => !rusheeIds.includes(casualAssignments[bid]))
    if (invalid.length > 0) return { interviewId: null, error: 'A panelist is assigned to a pledge outside this session.' }
    assignments = brotherIds.map(bid => ({ brother_id: bid, rushee_ids: [casualAssignments[bid]] }))
  } else {
    assignments = brotherIds.map(bid => ({ brother_id: bid, rushee_ids: rusheeIds }))
  }

  // Use session client so fn_start_interview sees the real auth.uid()
  const client = await createSupabaseServerClient()

  const { data, error: dbError } = await (client as any).rpc('fn_start_interview', {
    p_type: type,
    p_rushee_ids: rusheeIds,
    p_assignments: assignments,
  })

  if (dbError) return { interviewId: null, error: dbError.message ?? 'Failed to start interview.' }
  return { interviewId: data as string, error: null }
}

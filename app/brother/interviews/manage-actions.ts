'use server'

import { requireSession, unwrapAuth, callerHasRole, getServiceClient } from '@/lib/server-auth'
import { createSupabaseServerClient } from '@/lib/supabase-server'
import type { Caller } from '@/lib/server-auth'

function canManageInterviews(caller: Caller): boolean {
  return (
    caller.accountType === 'brother' &&
    (caller.accessLevel === 'admin' ||
      callerHasRole(caller, 'recruitment_director', 'professional_team'))
  )
}

async function requireManage() {
  const { caller, failure } = unwrapAuth(await requireSession())
  if (failure || !caller) return { caller: null, error: 'Not authenticated.' }
  if (!canManageInterviews(caller)) return { caller: null, error: 'Not authorized.' }
  return { caller, error: null }
}

export async function reassignPanelist(
  interviewId: string,
  brotherId: string,
  oldRusheeId: string,
  newRusheeId: string
): Promise<{ error: string | null }> {
  const { caller, error } = await requireManage()
  if (!caller) return { error }

  const client = await createSupabaseServerClient()
  const { error: dbErr } = await (client as any).rpc('fn_reassign_panelist', {
    p_interview_id: interviewId,
    p_brother_id: brotherId,
    p_old_rushee_id: oldRusheeId,
    p_new_rushee_id: newRusheeId,
  })
  if (dbErr) return { error: dbErr.message ?? 'Failed to reassign.' }
  return { error: null }
}

export async function dropRushee(
  interviewId: string,
  rusheeId: string
): Promise<{ error: string | null }> {
  const { caller, error } = await requireManage()
  if (!caller) return { error }

  const client = await createSupabaseServerClient()
  const { error: dbErr } = await (client as any).rpc('fn_drop_rushee', {
    p_interview_id: interviewId,
    p_rushee_id: rusheeId,
  })
  if (dbErr) return { error: dbErr.message ?? 'Failed to drop rushee.' }
  return { error: null }
}

export async function removePanelist(
  interviewId: string,
  brotherId: string,
  rusheeId: string
): Promise<{ error: string | null }> {
  const { caller, error } = await requireManage()
  if (!caller) return { error }

  const client = await createSupabaseServerClient()
  const { error: dbErr } = await (client as any).rpc('fn_remove_panelist', {
    p_interview_id: interviewId,
    p_brother_id: brotherId,
    p_rushee_id: rusheeId,
  })
  if (dbErr) return { error: dbErr.message ?? 'Failed to remove panelist.' }
  return { error: null }
}

export async function cancelInterview(
  interviewId: string,
  reason: string
): Promise<{ error: string | null }> {
  const { caller, error } = await requireManage()
  if (!caller) return { error }
  if (!reason.trim()) return { error: 'Cancellation requires a reason.' }

  const client = await createSupabaseServerClient()
  const { error: dbErr } = await (client as any).rpc('fn_cancel_interview', {
    p_interview_id: interviewId,
    p_reason: reason,
  })
  if (dbErr) return { error: dbErr.message ?? 'Failed to cancel interview.' }
  return { error: null }
}

export interface ManageableAssignment {
  brother_id: string
  rushee_id: string
  status: string
  conflict_flagged_at: string | null
  knows_personally: boolean
  submitted_at: string | null
  brother_name: string
  rushee_name: string
}

export interface ManageableInterview {
  id: string
  type: 'casual' | 'professional'
  status: string
  started_at: string
  is_stuck: boolean
  assignments: ManageableAssignment[]
}

export async function getManageableInterviews(): Promise<{
  data: ManageableInterview[] | null
  error: string | null
}> {
  const { caller, error } = await requireManage()
  if (!caller) return { data: null, error }

  const service = getServiceClient()

  // Fetch in-progress interviews
  const { data: interviews, error: ivErr } = await service
    .from('interviews')
    .select('id, type, status, started_at')
    .eq('status', 'in_progress')
    .order('started_at', { ascending: false })

  if (ivErr) return { data: null, error: 'Failed to load interviews.' }
  if (!interviews || interviews.length === 0) return { data: [], error: null }

  // Fetch all assignments for these interviews
  const interviewIds = interviews.map(iv => iv.id)
  const { data: assignments, error: iaErr } = await service
    .from('interview_assignments')
    .select('interview_id, brother_id, rushee_id, status, conflict_flagged_at, knows_personally, submitted_at')
    .in('interview_id', interviewIds)

  if (iaErr) return { data: null, error: 'Failed to load assignments.' }

  // Fetch brother and rushee names referenced in assignments
  const brotherIds = [...new Set((assignments ?? []).map(a => a.brother_id))]
  const rusheeIds = [...new Set((assignments ?? []).map(a => a.rushee_id))]

  const [brothersRes, rusheesRes, cfgRes] = await Promise.all([
    brotherIds.length > 0
      ? service.from('brothers').select('id, name').in('id', brotherIds)
      : Promise.resolve({ data: [], error: null }),
    rusheeIds.length > 0
      ? service.from('rushees').select('id, name').in('id', rusheeIds)
      : Promise.resolve({ data: [], error: null }),
    service.from('app_config').select('settings').eq('id', true).single(),
  ])

  const brotherMap = new Map((brothersRes.data ?? []).map(b => [b.id, b.name]))
  const rusheeMap = new Map((rusheesRes.data ?? []).map(r => [r.id, r.name]))

  const staleMinutes: number =
    (cfgRes.data?.settings as { interviews?: { stale_after_minutes?: number } } | null)
      ?.interviews?.stale_after_minutes ?? 120
  const staleThreshold = new Date(Date.now() - staleMinutes * 60 * 1000).toISOString()

  const assignmentsByInterview = new Map<string, ManageableAssignment[]>()
  for (const ia of assignments ?? []) {
    if (!assignmentsByInterview.has(ia.interview_id)) {
      assignmentsByInterview.set(ia.interview_id, [])
    }
    assignmentsByInterview.get(ia.interview_id)!.push({
      brother_id: ia.brother_id,
      rushee_id: ia.rushee_id,
      status: ia.status,
      conflict_flagged_at: ia.conflict_flagged_at,
      knows_personally: ia.knows_personally,
      submitted_at: ia.submitted_at,
      brother_name: brotherMap.get(ia.brother_id) ?? ia.brother_id,
      rushee_name: rusheeMap.get(ia.rushee_id) ?? ia.rushee_id,
    })
  }

  const result: ManageableInterview[] = interviews.map(iv => ({
    id: iv.id,
    type: iv.type as 'casual' | 'professional',
    status: iv.status,
    started_at: iv.started_at,
    is_stuck: iv.started_at < staleThreshold,
    assignments: assignmentsByInterview.get(iv.id) ?? [],
  }))

  return { data: result, error: null }
}

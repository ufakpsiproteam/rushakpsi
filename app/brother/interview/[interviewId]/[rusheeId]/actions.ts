'use server'

import { requireSession, unwrapAuth } from '@/lib/server-auth'
import { createSupabaseServerClient } from '@/lib/supabase-server'

// All these RPCs check auth.uid() internally; use session client, not service.

export async function submitAssignment(
  interviewId: string,
  rusheeId: string,
  recommendation: number,
  recommendationNotes: string
): Promise<{ error: string | null }> {
  const { caller, failure } = unwrapAuth(await requireSession())
  if (failure || !caller || caller.accountType !== 'brother') return { error: 'Not authenticated.' }

  const client = await createSupabaseServerClient()
  const { error } = await (client as any).rpc('fn_submit_assignment', {
    p_interview_id: interviewId,
    p_rushee_id: rusheeId,
    p_recommendation: recommendation,
    p_recommendation_notes: recommendationNotes,
  })

  if (error) return { error: error.message ?? 'Failed to submit.' }
  return { error: null }
}

export async function flagCasualConflict(
  interviewId: string,
  rusheeId: string
): Promise<{ error: string | null }> {
  const { caller, failure } = unwrapAuth(await requireSession())
  if (failure || !caller || caller.accountType !== 'brother') return { error: 'Not authenticated.' }

  const client = await createSupabaseServerClient()
  const { error } = await (client as any).rpc('fn_flag_casual_conflict', {
    p_interview_id: interviewId,
    p_rushee_id: rusheeId,
  })

  if (error) return { error: error.message ?? 'Failed to flag conflict.' }
  return { error: null }
}

export async function flagProfessionalConflict(
  interviewId: string,
  rusheeId: string
): Promise<{ error: string | null }> {
  const { caller, failure } = unwrapAuth(await requireSession())
  if (failure || !caller || caller.accountType !== 'brother') return { error: 'Not authenticated.' }

  const client = await createSupabaseServerClient()
  const { error } = await (client as any).rpc('fn_flag_professional_conflict', {
    p_interview_id: interviewId,
    p_rushee_id: rusheeId,
  })

  if (error) return { error: error.message ?? 'Failed to set conflict flag.' }
  return { error: null }
}

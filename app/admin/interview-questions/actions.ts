'use server'

import { getServiceClient, requireSession, unwrapAuth, logAudit } from '@/lib/server-auth'

/**
 * Interview question set and scripts — admin-only config, no deploy
 * needed to change. §8 of INTERVIEWS-IMPLEMENTATION-PROMPT.md: "Edit the
 * question set and rubrics" is Admin-only, unlike reading/scoring which
 * every brother or leadership respectively can do.
 */

export interface InterviewQuestionRecord {
  id: string
  type: 'casual' | 'professional'
  order_index: number
  prompt: string
  help_text: string | null
  is_scored: boolean
  field_type: 'score_notes' | 'yes_no'
  score_options: Array<{ value: number; label: string; descriptors: string[] }> | null
  timer_seconds: number | null
  notes_required: boolean
  needs_human_review: boolean
  review_reason: string | null
  is_active: boolean
}

export interface InterviewScriptRecord {
  id: string
  type: 'casual' | 'professional'
  kind: 'opening' | 'closing' | 'interviewer_notes' | 'conflict_script'
  position: number
  content: string
}

async function requireAdmin() {
  const { caller, failure } = unwrapAuth(await requireSession({ roles: ['admin'] }))
  if (failure || !caller) return { caller: null, error: 'Admin access required.' }
  return { caller, error: null }
}

export async function getInterviewQuestions(): Promise<{
  data: InterviewQuestionRecord[] | null
  error: string | null
}> {
  const { caller, error } = await requireAdmin()
  if (!caller) return { data: null, error }

  const service = getServiceClient()
  const { data, error: dbError } = await service
    .from('interview_questions')
    .select('*')
    .order('type')
    .order('order_index')

  if (dbError) return { data: null, error: 'Failed to load interview questions.' }
  return { data: data as InterviewQuestionRecord[], error: null }
}

export async function getInterviewScripts(): Promise<{
  data: InterviewScriptRecord[] | null
  error: string | null
}> {
  const { caller, error } = await requireAdmin()
  if (!caller) return { data: null, error }

  const service = getServiceClient()
  const { data, error: dbError } = await service
    .from('interview_scripts')
    .select('*')
    .order('type')
    .order('kind')
    .order('position')

  if (dbError) return { data: null, error: 'Failed to load interview scripts.' }
  return { data: data as InterviewScriptRecord[], error: null }
}

export interface QuestionEditableFields {
  prompt: string
  help_text: string | null
  notes_required: boolean
  timer_seconds: number | null
  score_options: InterviewQuestionRecord['score_options']
  is_active: boolean
}

/**
 * Editing prompt/score_options must not silently clear
 * needs_human_review — the admin has to explicitly mark it reviewed via
 * markQuestionReviewed. This keeps the flag from being lost by accident.
 */
export async function updateQuestion(
  id: string,
  updates: QuestionEditableFields
): Promise<{ error: string | null }> {
  const { caller, error } = await requireAdmin()
  if (!caller) return { error }

  const service = getServiceClient()
  const { data: before } = await service.from('interview_questions').select('*').eq('id', id).maybeSingle()
  if (!before) return { error: 'Question not found.' }

  const { error: dbError } = await service
    .from('interview_questions')
    .update({
      prompt: updates.prompt,
      help_text: updates.help_text,
      notes_required: updates.notes_required,
      timer_seconds: updates.timer_seconds,
      score_options: updates.score_options,
      is_active: updates.is_active,
    })
    .eq('id', id)

  if (dbError) return { error: 'Failed to save question.' }

  await logAudit({
    actorId: caller.userId,
    action: 'interview.question_edit',
    entityType: 'interview_question',
    entityId: id,
    before,
    after: updates,
  })

  return { error: null }
}

export async function markQuestionReviewed(id: string): Promise<{ error: string | null }> {
  const { caller, error } = await requireAdmin()
  if (!caller) return { error }

  const service = getServiceClient()
  const { data: before } = await service.from('interview_questions').select('*').eq('id', id).maybeSingle()
  if (!before) return { error: 'Question not found.' }

  const { error: dbError } = await service
    .from('interview_questions')
    .update({ needs_human_review: false, review_reason: null })
    .eq('id', id)

  if (dbError) return { error: 'Failed to update question.' }

  await logAudit({
    actorId: caller.userId,
    action: 'interview.question_edit',
    entityType: 'interview_question',
    entityId: id,
    before,
    after: { needs_human_review: false },
    metadata: { reviewed: true },
  })

  return { error: null }
}

export async function updateScript(id: string, content: string): Promise<{ error: string | null }> {
  const { caller, error } = await requireAdmin()
  if (!caller) return { error }

  const service = getServiceClient()
  const { data: before } = await service.from('interview_scripts').select('*').eq('id', id).maybeSingle()
  if (!before) return { error: 'Script not found.' }

  const { error: dbError } = await service
    .from('interview_scripts')
    .update({ content, updated_at: new Date().toISOString(), updated_by: caller.userId })
    .eq('id', id)

  if (dbError) return { error: 'Failed to save script.' }

  await logAudit({
    actorId: caller.userId,
    action: 'interview.question_edit',
    entityType: 'interview_script',
    entityId: id,
    before,
    after: { content },
  })

  return { error: null }
}

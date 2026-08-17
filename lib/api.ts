import { supabase } from './supabase'
import { Database } from './database.types'

type Rushee = Database['public']['Tables']['rushees']['Row']
type Event = Database['public']['Tables']['events']['Row']
type Evaluation = Database['public']['Tables']['evaluations']['Row']
type Brother = Database['public']['Tables']['brothers']['Row']

// Helper to get current user ID from auth
async function getCurrentUserId(): Promise<string> {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Not authenticated')
  return user.id
}

// Rushee API
export async function getRushees() {
  const { data, error } = await supabase
    .from('rushees')
    .select('*')
    .order('name')

  if (error) throw error
  return data
}

export async function getRushee(id: string) {
  const { data, error } = await supabase
    .from('rushees')
    .select('*')
    .eq('id', id)
    .single()

  if (error) throw error
  return data
}

// Get rushees with brother-specific data (starred, evaluations, notes)
export async function getRusheesWithBrotherData(brotherId?: string) {
  if (!brotherId) {
    brotherId = await getCurrentUserId()
  }
  const { data: rushees, error: rusheesError } = await supabase
    .from('rushees')
    .select('*')
    .order('name')

  if (rusheesError) throw rusheesError

  // Get starred rushees for this brother
  const { data: starredData, error: starredError } = await supabase
    .from('starred_rushees')
    .select('rushee_id')
    .eq('brother_id', brotherId)

  if (starredError) throw starredError

  const starredIds = new Set((starredData || []).map((s: any) => s.rushee_id))

  // Get evaluations for this brother
  const { data: evaluations, error: evalsError } = await supabase
    .from('evaluations')
    .select('rushee_id')
    .eq('brother_id', brotherId)

  if (evalsError) throw evalsError

  const evaluatedIds = new Set((evaluations || []).map((e: any) => e.rushee_id))

  // Get personal notes
  const { data: notes, error: notesError } = await supabase
    .from('personal_notes')
    .select('rushee_id, notes')
    .eq('brother_id', brotherId)

  if (notesError) throw notesError

  const notesMap = new Map((notes || []).map((n: any) => [n.rushee_id, n.notes || '']))

  // Get all events first
  const { data: allEvents, error: eventsError } = await supabase
    .from('events')
    .select('id, type')

  if (eventsError) throw eventsError

  const eventsMap = new Map((allEvents || []).map((e: any) => [e.id, e.type]))

  // Get event attendance counts
  const { data: attendance, error: attendanceError } = await supabase
    .from('event_attendance')
    .select('rushee_id, event_id')

  if (attendanceError) throw attendanceError

  const attendanceMap = new Map<string, { casual: number; professional: number }>()
  ;(attendance || []).forEach((a: any) => {
    if (!attendanceMap.has(a.rushee_id)) {
      attendanceMap.set(a.rushee_id, { casual: 0, professional: 0 })
    }
    const counts = attendanceMap.get(a.rushee_id)!
    const eventType = eventsMap.get(a.event_id)
    if (eventType === 'Casual') {
      counts.casual++
    } else if (eventType === 'Professional') {
      counts.professional++
    }
  })

  return (rushees || []).map((rushee: any) => ({
    id: rushee.id,
    name: rushee.name,
    major: rushee.major,
    year: rushee.year,
    photo: rushee.photo,
    inviteOnly: rushee.invite_only,
    bidStatus: rushee.bid_status,
    starred: starredIds.has(rushee.id),
    hasEvaluation: evaluatedIds.has(rushee.id),
    personalNotes: notesMap.get(rushee.id) || '',
    casualEvents: attendanceMap.get(rushee.id)?.casual || 0,
    professionalEvents: attendanceMap.get(rushee.id)?.professional || 0
  }))
}

// Starred Rushees API
export async function toggleStarRushee(rusheeId: string, brotherId?: string) {
  if (!brotherId) {
    brotherId = await getCurrentUserId()
  }
  const { data: existing, error: checkError } = await supabase
    .from('starred_rushees')
    .select('id')
    .eq('brother_id', brotherId)
    .eq('rushee_id', rusheeId)
    .single()

  if (checkError && checkError.code !== 'PGRST116') throw checkError

  if (existing) {
    // Remove star
    const { error } = await supabase
      .from('starred_rushees')
      .delete()
      .eq('id', (existing as any).id)

    if (error) throw error
    return false
  } else {
    // Add star
    const { error } = await supabase
      .from('starred_rushees')
      // @ts-ignore - Supabase type inference issue
      .insert({ brother_id: brotherId, rushee_id: rusheeId })

    if (error) throw error
    return true
  }
}

// Personal Notes API
export async function updatePersonalNotes(rusheeId: string, notes: string, brotherId?: string) {
  if (!brotherId) {
    brotherId = await getCurrentUserId()
  }
  const { data: existing, error: checkError } = await supabase
    .from('personal_notes')
    .select('id')
    .eq('brother_id', brotherId)
    .eq('rushee_id', rusheeId)
    .single()

  if (checkError && checkError.code !== 'PGRST116') throw checkError

  if (existing) {
    const { error } = await supabase
      .from('personal_notes')
      // @ts-ignore - Supabase type inference issue
      .update({ notes, updated_at: new Date().toISOString() })
      .eq('id', (existing as any).id)

    if (error) throw error
  } else {
    const { error } = await supabase
      .from('personal_notes')
      // @ts-ignore - Supabase type inference issue
      .insert({ brother_id: brotherId, rushee_id: rusheeId, notes })

    if (error) throw error
  }
}

export async function getPersonalNotes(rusheeId: string, brotherId?: string): Promise<string> {
  if (!brotherId) {
    brotherId = await getCurrentUserId()
  }
  const { data, error } = await supabase
    .from('personal_notes')
    .select('notes')
    .eq('brother_id', brotherId)
    .eq('rushee_id', rusheeId)
    .single()

  if (error && error.code !== 'PGRST116') throw error
  return (data as any)?.notes || ''
}

// Events API
export async function getEvents() {
  const { data, error } = await supabase
    .from('events')
    .select('*')
    .order('date')

  if (error) throw error
  return data
}

export async function getEventsWithAttendees() {
  const { data: events, error: eventsError } = await supabase
    .from('events')
    .select('*')
    .order('date')

  if (eventsError) throw eventsError

  const { data: attendance, error: attendanceError } = await supabase
    .from('event_attendance')
    .select('event_id, rushee_id, status, photo_url, rushees(id, name, photo)')
    .eq('status', 'approved')  // Only include approved attendance

  if (attendanceError) throw attendanceError

  return (events || []).map((event: any) => ({
    ...event,
    attendees: (attendance || [])
      .filter((a: any) => a.event_id === event.id)
      .map((a: any) => {
        const rushee = a.rushees as any
        return {
          id: rushee.id,
          name: rushee.name,
          photo: rushee.photo,
          attendancePhotoUrl: a.photo_url || null
        }
      })
  }))
}

// Evaluations API
export async function getEvaluation(rusheeId: string, eventId?: string, brotherId?: string): Promise<Evaluation | null> {
  if (!brotherId) {
    brotherId = await getCurrentUserId()
  }
  // Get evaluation by brother-rushee pair (eventId is now optional/ignored)
  const { data, error } = await supabase
    .from('evaluations')
    .select('*')
    .eq('brother_id', brotherId)
    .eq('rushee_id', rusheeId)
    .single()

  if (error && error.code !== 'PGRST116') throw error
  return data
}

// True when the given brother has a recorded "met" interaction with this
// rushee at this event — the gate for creating a first-time evaluation.
export async function hasMetRusheeAtEvent(rusheeId: string, eventId: string, brotherId?: string): Promise<boolean> {
  if (!brotherId) {
    brotherId = await getCurrentUserId()
  }
  const { data, error } = await supabase
    .from('brother_rushee_interactions')
    .select('brother_id')
    .eq('brother_id', brotherId)
    .eq('rushee_id', rusheeId)
    .eq('event_id', eventId)
    .maybeSingle()

  if (error && error.code !== 'PGRST116') throw error
  return Boolean(data)
}

export async function createOrUpdateEvaluation(
  rusheeId: string,
  evaluation: {
    /** null when unrated; 1–5 when scored. Never 0 — see professional_na (R23). */
    professional_score: number | null
    /** true when the brother explicitly chose "N/A - Can't speak to professionalism". */
    professional_na?: boolean
    personal_score: number
    knows_personally: boolean
    qualities: string[]
    comments: string
  },
  eventId?: string,
  brotherId?: string
) {
  if (!brotherId) {
    brotherId = await getCurrentUserId()
  }

  const { data: existing, error: checkError } = await supabase
    .from('evaluations')
    .select('id, event_id')
    .eq('brother_id', brotherId)
    .eq('rushee_id', rusheeId)
    .maybeSingle()

  if (checkError && checkError.code !== 'PGRST116') {
    throw checkError
  }

  const scores = {
    professional_score: evaluation.professional_score,
    professional_na: Boolean(evaluation.professional_na),
    personal_score: evaluation.personal_score,
    knows_personally: evaluation.knows_personally,
    qualities: evaluation.qualities,
    comments: evaluation.comments,
  }

  if (existing) {
    const existingEval: any = existing

    // PRD §4.4 / R22: the originating event is set once and never
    // overwritten, so per-event attribution survives later revisions.
    // This previously wrote `event_id: eventId || null` on every update,
    // which meant editing an evaluation from the rushee directory (where
    // there is no event in context) silently erased the original event.
    const payload: Record<string, unknown> = {
      ...scores,
      updated_at: new Date().toISOString(),
    }

    if (!existingEval.event_id && eventId) {
      payload.event_id = eventId
    }

    const { data, error } = await (supabase as any)
      .from('evaluations')
      .update(payload)
      .eq('id', existingEval.id)
      .select()
      .single()

    if (error) throw error
    return data
  }

  const { data, error } = await (supabase as any)
    .from('evaluations')
    .insert({
      brother_id: brotherId,
      rushee_id: rusheeId,
      event_id: eventId || null,
      ...scores,
    })
    .select()
    .single()

  if (error) throw error
  return data
}

export async function hasEvaluated(rusheeId: string, brotherId?: string) {
  if (!brotherId) {
    brotherId = await getCurrentUserId()
  }
  const { data, error } = await supabase
    .from('evaluations')
    .select('id')
    .eq('brother_id', brotherId)
    .eq('rushee_id', rusheeId)
    .limit(1)

  if (error) throw error
  return data && data.length > 0
}

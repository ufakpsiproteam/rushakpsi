import { supabase } from './supabase'

// Auth helpers
export async function signUp(email: string, password: string, userData: {
  full_name: string
  user_type: 'rushee' | 'brother' | 'admin'
}) {
  const { data: authData, error: authError } = await supabase.auth.signUp({
    email,
    password,
  })

  if (authError || !authData.user) {
    return { error: authError }
  }

  // Create profile
  const { error: profileError } = await supabase
    .from('profiles')
    // @ts-ignore - Supabase type inference issue
    .insert({
      id: authData.user.id,
      email,
      full_name: userData.full_name,
      user_type: userData.user_type,
    })

  if (profileError) {
    return { error: profileError }
  }

  // If rushee, create rushee profile
  if (userData.user_type === 'rushee') {
    const { error: rusheeError } = await supabase
      .from('rushee_profiles')
      // @ts-ignore - Supabase type inference issue
      .insert({ id: authData.user.id })

    if (rusheeError) {
      return { error: rusheeError }
    }
  }

  return { data: authData, error: null }
}

export async function signIn(email: string, password: string) {
  return await supabase.auth.signInWithPassword({ email, password })
}

export async function signOut() {
  return await supabase.auth.signOut()
}

export async function getCurrentUser() {
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) return null

  const { data: profile } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single()

  return { user, profile }
}

// Events
export async function getEvents() {
  return await supabase
    .from('events')
    .select('*')
    .order('date', { ascending: true })
}

export async function getEventById(id: string) {
  return await supabase
    .from('events')
    .select('*')
    .eq('id', id)
    .single()
}

export async function createEvent(eventData: {
  title: string
  type: 'Casual' | 'Professional'
  date: string
  time: string
  location?: string
  description?: string
  status?: 'locked' | 'attendance' | 'evaluation'
  number_of_groups?: number
}) {
  const { data, error } = await (supabase as any)
    .from('events')
    .insert({
      ...eventData,
      status: eventData.status || 'locked',
      number_of_groups: eventData.number_of_groups || 5
    })
    .select()
    .single()

  return { data, error }
}

export async function updateEvent(eventId: string, eventData: {
  title?: string
  type?: 'Casual' | 'Professional'
  date?: string
  time?: string
  location?: string
  description?: string
  accepting_evals?: boolean
  number_of_groups?: number
}) {
  const { data, error } = await (supabase as any)
    .from('events')
    .update(eventData)
    .eq('id', eventId)
    .select()
    .single()

  return { data, error }
}

export async function deleteEvent(eventId: string) {
  const { error } = await supabase
    .from('events')
    .delete()
    .eq('id', eventId)

  return { error }
}

export async function updateEventStatus(eventId: string, status: 'locked' | 'attendance' | 'evaluation') {
  const { data, error } = await (supabase as any)
    .from('events')
    .update({ status })
    .eq('id', eventId)
    .select()
    .single()

  return { data, error }
}

// Event Attendance
export async function submitAttendance(eventId: string, rusheeId: string, photoUrl: string) {
  return await supabase
    .from('event_attendance')
    // @ts-ignore - Supabase type inference issue
    .insert({
      event_id: eventId,
      rushee_id: rusheeId,
      photo_url: photoUrl,
    })
    .select()
    .single()
}

export async function getAttendanceForEvent(eventId: string) {
  return await supabase
    .from('event_attendance')
    .select(`
      *,
      rushee:rushees!rushee_id(id, name)
    `)
    .eq('event_id', eventId)
    .order('created_at', { ascending: false })
}

export async function getRusheeAttendance(rusheeId: string) {
  return await supabase
    .from('event_attendance')
    .select(`
      *,
      event:events(id, title, type, date)
    `)
    .eq('rushee_id', rusheeId)
    .order('created_at', { ascending: false })
}

export async function updateAttendanceStatus(attendanceId: string, status: 'approved' | 'rejected', reviewerId: string) {
  return await supabase
    .from('event_attendance')
    // @ts-ignore - Supabase type inference issue
    .update({
      status,
      reviewed_by: reviewerId,
      reviewed_at: new Date().toISOString(),
    })
    .eq('id', attendanceId)
}

/**
 * Manually refresh group assignments for an event
 * Redistributes all attendees evenly across the configured number of groups
 */
export async function refreshEventGroups(eventId: string) {
  const { data, error } = await (supabase as any)
    .rpc('redistribute_event_groups', { p_event_id: eventId })

  return { data, error }
}

/**
 * Get attendance records with group information for an event
 * Enhanced version that includes group_number
 */
export async function getAttendanceWithGroups(eventId: string) {
  return await supabase
    .from('event_attendance')
    .select(`
      *,
      rushee:rushee_profiles(
        id,
        profile:profiles(full_name)
      )
    `)
    .eq('event_id', eventId)
    .order('group_number', { ascending: true })
    .order('check_in_time', { ascending: true })
}

/**
 * Manually add an attendance record without a photo (instant approval).
 * The RPC itself checks the caller is an admin or recruitment brother —
 * this is not just a UI convenience, it's enforced server-side.
 */
export async function createManualAttendance(eventId: string, rusheeId: string) {
  const { data, error } = await (supabase as any)
    .rpc('create_manual_attendance', {
      p_event_id: eventId,
      p_rushee_id: rusheeId,
    })

  // RPC returns an array, get the first item
  return { data: data?.[0] || null, error }
}

// Applications
export async function submitApplication(rusheeId: string, applicationData: {
  why_akpsi: string
  career_interests: string
  brother_connection: string
  rushee_connection: string
  personal_description: string
  pillar_resonance: string
}) {
  const { error: appError } = await supabase
    .from('applications')
    // @ts-ignore - Supabase type inference issue
    .insert({
      rushee_id: rusheeId,
      ...applicationData,
    })

  if (appError) return { error: appError }

  // Update rushee profile to mark application as submitted
  const { error: profileError } = await supabase
    .from('rushee_profiles')
    // @ts-ignore - Supabase type inference issue
    .update({
      application_submitted: true,
      application_submitted_at: new Date().toISOString(),
    })
    .eq('id', rusheeId)

  return { error: profileError }
}

export async function getApplication(rusheeId: string) {
  return await supabase
    .from('applications')
    .select('*')
    .eq('rushee_id', rusheeId)
    .single()
}

// Evaluations
export async function submitEvaluation(brotherId: string, rusheeId: string, eventId: string, evaluationData: {
  professional_score: number
  personal_score: number
  comments: string
}) {
  return await supabase
    .from('evaluations')
    // @ts-ignore - Supabase type inference issue
    .upsert({
      brother_id: brotherId,
      rushee_id: rusheeId,
      event_id: eventId,
      ...evaluationData,
    })
}

export async function getEvaluationsForRushee(rusheeId: string) {
  return await supabase
    .from('evaluations')
    .select(`
      *,
      brother:profiles!evaluations_brother_id_fkey(full_name),
      event:events(title, type, date)
    `)
    .eq('rushee_id', rusheeId)
}

export async function getBrotherEvaluations(brotherId: string) {
  return await supabase
    .from('evaluations')
    .select(`
      *,
      rushee:rushee_profiles(id, profiles(full_name))
    `)
    .eq('brother_id', brotherId)
}

// Rushees
export async function getAllRushees() {
  return await supabase
    .from('rushee_profiles')
    .select(`
      *,
      profile:profiles(full_name, email),
      application:applications(submitted_at)
    `)
    .order('created_at', { ascending: false })
}

export async function getRusheeById(id: string) {
  return await supabase
    .from('rushee_profiles')
    .select(`
      *,
      profile:profiles(full_name, email),
      application:applications(*),
      attendance:event_attendance(
        *,
        event:events(*)
      ),
      evaluations:evaluations(
        *,
        brother:profiles!evaluations_brother_id_fkey(full_name)
      )
    `)
    .eq('id', id)
    .single()
}

export async function updateRusheeStanding(rusheeId: string, standing: string) {
  return await supabase
    .from('rushee_profiles')
    // @ts-ignore - Supabase type inference issue
    .update({ standing })
    .eq('id', rusheeId)
}

export async function updateRusheeProfile(rusheeId: string, data: {
  name?: string
  email?: string
  major?: string
  year?: string
  gpa?: number
  photo?: string
}) {
  const { error } = await (supabase as any)
    .from('rushees')
    .update(data)
    .eq('id', rusheeId)

  return { error }
}

export async function getRusheeProfile(rusheeId: string) {
  const { data, error } = await supabase
    .from('rushees')
    .select('*')
    .eq('id', rusheeId)
    .single()

  return { data, error }
}

// Brothers
export async function updateBrotherProfile(brotherId: string, data: {
  name?: string
  email?: string
}) {
  const { error } = await (supabase as any)
    .from('brothers')
    .update(data)
    .eq('id', brotherId)

  return { error }
}

export async function getBrotherProfile(brotherId: string) {
  const { data, error } = await supabase
    .from('brothers')
    .select('*')
    .eq('id', brotherId)
    .single()

  return { data, error }
}

// Brother notes
export async function saveBrotherNote(brotherId: string, rusheeId: string, notes: string, starred: boolean = false) {
  return await supabase
    .from('brother_notes')
    // @ts-ignore - Supabase type inference issue
    .upsert({
      brother_id: brotherId,
      rushee_id: rusheeId,
      notes,
      starred,
    })
}

export async function getBrotherNotes(brotherId: string) {
  return await supabase
    .from('brother_notes')
    .select(`
      *,
      rushee:rushee_profiles(
        *,
        profile:profiles(full_name)
      )
    `)
    .eq('brother_id', brotherId)
}

export async function toggleRusheeStar(brotherId: string, rusheeId: string) {
  const { data: existing } = await supabase
    .from('brother_notes')
    .select('starred')
    .eq('brother_id', brotherId)
    .eq('rushee_id', rusheeId)
    .single()

  return await supabase
    .from('brother_notes')
    // @ts-ignore - Supabase type inference issue
    .upsert({
      brother_id: brotherId,
      rushee_id: rusheeId,
      starred: !(existing as any)?.starred,
    })
}

// Storage helpers
export async function uploadAttendancePhoto(rusheeId: string, file: File) {
  const fileExt = file.name.split('.').pop()
  const fileName = `${rusheeId}/${Date.now()}.${fileExt}`

  const { data, error } = await supabase.storage
    .from('attendance-photos')
    .upload(fileName, file)

  if (error) return { error }

  const { data: { publicUrl } } = supabase.storage
    .from('attendance-photos')
    .getPublicUrl(fileName)

  return { data: { path: fileName, url: publicUrl }, error: null }
}

export async function uploadProfilePhoto(userId: string, file: File) {
  const fileExt = file.name.split('.').pop()
  const fileName = `${userId}/profile.${fileExt}`

  // Delete old profile photo if exists
  await supabase.storage
    .from('profile-pictures')
    .remove([fileName])

  const { data, error } = await supabase.storage
    .from('profile-pictures')
    .upload(fileName, file, {
      upsert: true
    })

  if (error) return { error }

  // 'profile-pictures' is private (2026-08-11 security hardening) — the
  // caller should store `path` and resolve a signed URL for display via
  // lib/resolvePhotoUrl.ts, not this `url`, which will 403.
  const { data: { publicUrl } } = supabase.storage
    .from('profile-pictures')
    .getPublicUrl(fileName)

  return { data: { path: fileName, url: publicUrl }, error: null }
}

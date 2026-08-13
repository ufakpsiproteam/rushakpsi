'use client'

import BrotherNav from '@/components/brother/BrotherNav'
import PullToRefresh from '@/components/PullToRefresh'
import RusheePhoto from '@/components/RusheePhoto'
import Link from 'next/link'
import { useState, useEffect, useRef, Suspense } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import { getEventsWithAttendees } from '@/lib/api'
import { formatDateInEST } from '@/lib/dateUtils'

function BrotherEventsContent() {
  const searchParams = useSearchParams()
  const router = useRouter()

  const [selectedEvent, setSelectedEvent] = useState<string | null>(null)
  const [selectedRushees, setSelectedRushees] = useState<string[]>([])
  const [evaluatedRushees, setEvaluatedRushees] = useState<string[]>([])
  const [awaitingProfessional, setAwaitingProfessional] = useState<string[]>([])
  const [step, setStep] = useState<'select' | 'evaluate'>('select')
  const [events, setEvents] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [attendedEventIds, setAttendedEventIds] = useState<string[]>([])
  const [selectionView, setSelectionView] = useState<'grid' | 'swipe'>('swipe')
  const [swipeIndex, setSwipeIndex] = useState(0)
  const [swipeOffset, setSwipeOffset] = useState(0)
  const [isDragging, setIsDragging] = useState(false)
  const [revealAttendance, setRevealAttendance] = useState(false)
  const swipeStartX = useRef<number | null>(null)

  async function handleRefresh() {
    await checkAccessAndLoadEvents()
  }

  // Load events from Supabase
  useEffect(() => {
    checkAccessAndLoadEvents()
  }, [])

  async function checkAccessAndLoadEvents() {
      try {
        const { supabase } = await import('@/lib/supabase')
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) return

        // Check if user is admin and redirect
        const { data: brother } = await supabase
          .from('brothers')
          .select('access_level')
          .eq('id', user.id)
          .single()

        if (brother && (brother as any).access_level === 'admin') {
          window.location.href = '/admin/events'
          return
        }

        const data = await getEventsWithAttendees()
        setEvents(data)

        const { data: attendance } = await supabase
          .from('brother_event_attendance')
          .select('event_id')
          .eq('brother_id', user.id)

        setAttendedEventIds(
          (attendance || [])
            .map((entry: any) => entry.event_id)
            .filter((id: any) => id !== null)
        )
      } catch (error) {
        console.error('Error loading events:', error)
        alert('Failed to load events')
      } finally {
        setLoading(false)
      }
    }

  // Restore modal state from URL parameters on load
  useEffect(() => {
    const eventParam = searchParams.get('evaluating')
    if (eventParam) {
      setSelectedEvent(eventParam)
      setStep('evaluate')

      // Load selected rushees from localStorage
      const selectedKey = `selected_${eventParam}`
      const storedSelected = localStorage.getItem(selectedKey)
      if (storedSelected) {
        setSelectedRushees(JSON.parse(storedSelected))
      } else {
        // Recover the selection from the server if this device has no copy.
        void (async () => {
          const recovered = await loadSelectionFromServer(eventParam)
          if (recovered.length > 0) {
            setSelectedRushees(recovered)
            localStorage.setItem(selectedKey, JSON.stringify(recovered))
          }
        })()
      }

      // Evaluated rushees will be loaded from database in the next useEffect
    }
  }, [searchParams])

  // Load evaluated rushees from database when event is selected
  useEffect(() => {
    async function loadEvaluatedStatus() {
      if (selectedEvent && step === 'evaluate') {
        try {
          const { supabase } = await import('@/lib/supabase')
          const { data: { user } } = await supabase.auth.getUser()
          if (!user) {
            return
          }

          // Find the current event
          const event = events.find(e => e.id === selectedEvent)
          if (!event?.attendees) {
            return
          }


          // Get all evaluations by this brother for rushees at this event
          // Note: Evaluations are now per brother-rushee pair, not per event
          // So if a rushee was evaluated at any previous event, they'll show as evaluated here too
          const rusheeIds = event.attendees.map((r: any) => r.id)
          const { data: evaluations } = await supabase
            .from('evaluations')
            .select('rushee_id, professional_score, professional_na')
            .eq('brother_id', user.id)
            .in('rushee_id', rusheeIds)


          const evaluatedIds = (evaluations || []).map((e: any) => e.rushee_id)
          // R23: an explicit N/A is a complete evaluation. Only a
          // professional score that is genuinely unrated is "awaiting".
          const awaitingIds = (evaluations || [])
            .filter((e: any) => e.professional_score === null && !e.professional_na)
            .map((e: any) => e.rushee_id)
          setEvaluatedRushees(evaluatedIds)
          setAwaitingProfessional(awaitingIds)
        } catch (error) {
          console.error('Error loading evaluation status:', error)
        }
      }
    }

    loadEvaluatedStatus()
  }, [selectedEvent, step, events, searchParams])

  // Refresh evaluated rushees when the window gains focus (user comes back from evaluation)
  useEffect(() => {
    const handleFocus = async () => {
      if (selectedEvent && step === 'evaluate') {
        try {
          const { supabase } = await import('@/lib/supabase')
          const { data: { user } } = await supabase.auth.getUser()
          if (!user) return

          // Find the current event
          const event = events.find(e => e.id === selectedEvent)
          if (!event?.attendees) return

          // Reload evaluation status from database
          // Note: Evaluations are per brother-rushee pair, not per event
          const rusheeIds = event.attendees.map((r: any) => r.id)
          const { data: evaluations } = await supabase
            .from('evaluations')
            .select('rushee_id, professional_score, professional_na')
            .eq('brother_id', user.id)
            .in('rushee_id', rusheeIds)

          const evaluatedIds = (evaluations || []).map((e: any) => e.rushee_id)
          // R23: an explicit N/A is a complete evaluation. Only a
          // professional score that is genuinely unrated is "awaiting".
          const awaitingIds = (evaluations || [])
            .filter((e: any) => e.professional_score === null && !e.professional_na)
            .map((e: any) => e.rushee_id)
          setEvaluatedRushees(evaluatedIds)
          setAwaitingProfessional(awaitingIds)
        } catch (error) {
          console.error('Error reloading evaluation status:', error)
        }
      }
    }

    window.addEventListener('focus', handleFocus)
    return () => window.removeEventListener('focus', handleFocus)
  }, [selectedEvent, step, events])


  /**
   * PRD §6.4.4 — resume an interrupted flow from server-side state.
   * The interaction records written when the brother pressed Continue are
   * the canonical selection for that (brother, event) pair; localStorage
   * is only a fast path for the same device.
   */
  const loadSelectionFromServer = async (eventId: string): Promise<string[]> => {
    try {
      const { supabase } = await import('@/lib/supabase')
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return []

      const { data } = await supabase
        .from('brother_rushee_interactions')
        .select('rushee_id')
        .eq('brother_id', user.id)
        .eq('event_id', eventId)

      return (data || []).map((row: any) => row.rushee_id)
    } catch {
      return []
    }
  }

  const handleStartEvaluation = async (eventId: string) => {
    setSelectedEvent(eventId)

    // Check if rushees were already selected for this event
    const selectedKey = `selected_${eventId}`
    const storedSelected = localStorage.getItem(selectedKey)

    const rusheeIds: string[] = storedSelected
      ? JSON.parse(storedSelected)
      : await loadSelectionFromServer(eventId)

    if (rusheeIds.length > 0) {
      setSelectedRushees(rusheeIds)
      localStorage.setItem(selectedKey, JSON.stringify(rusheeIds))
      setStep('evaluate')
      router.push(`/brother/events?evaluating=${eventId}`)
    } else {
      setStep('select')
    }
  }

  const handleRusheeToggle = (rusheeId: string) => {
    setSelectedRushees(prev =>
      prev.includes(rusheeId)
        ? prev.filter(id => id !== rusheeId)
        : [...prev, rusheeId]
    )
  }


  const handleContinueToEvaluate = async () => {
    if (selectedRushees.length > 0 && selectedEvent) {
      // Save selected rushees to localStorage
      const selectedKey = `selected_${selectedEvent}`
      localStorage.setItem(selectedKey, JSON.stringify(selectedRushees))

      // Save interactions to database
      try {
        const { supabase } = await import('@/lib/supabase')
        const { data: { user } } = await supabase.auth.getUser()
        if (user) {
          // Insert interactions for each selected rushee
          const interactions = selectedRushees.map(rusheeId => ({
            brother_id: user.id,
            rushee_id: rusheeId,
            event_id: selectedEvent
          }))

          // Use upsert to avoid duplicates if they go back and forth
          await (supabase as any)
            .from('brother_rushee_interactions')
            .upsert(interactions, {
              onConflict: 'brother_id,rushee_id,event_id'
            })
        }
      } catch (error) {
        console.error('Error saving interactions:', error)
        // Don't block the flow if saving interactions fails
      }

      // Update URL to include evaluation state
      router.push(`/brother/events?evaluating=${selectedEvent}`)
      setStep('evaluate')
    }
  }

  const currentEvent = events.find(e => e.id === selectedEvent)
  const currentAttendees = currentEvent?.attendees || []
  const currentSwipeRushee = currentAttendees[swipeIndex]

  useEffect(() => {
    if (step === 'select') {
      setSwipeIndex(0)
      setSwipeOffset(0)
      setRevealAttendance(false)
      setIsDragging(false)
    }
  }, [selectedEvent, step])

  const setRusheeSelected = (rusheeId: string, selected: boolean) => {
    setSelectedRushees(prev =>
      selected ? (prev.includes(rusheeId) ? prev : [...prev, rusheeId]) : prev.filter(id => id !== rusheeId)
    )
  }

  const goToSwipeIndex = (nextIndex: number) => {
    setSwipeIndex(nextIndex)
    setSwipeOffset(0)
    setRevealAttendance(false)
    setIsDragging(false)
  }

  const handleSwipeDecision = (selected: boolean) => {
    if (!currentSwipeRushee) return
    setRusheeSelected(currentSwipeRushee.id, selected)
    goToSwipeIndex(Math.min(swipeIndex + 1, currentAttendees.length))
  }

  const handleSwipeStart = (event: React.PointerEvent<HTMLDivElement>) => {
    swipeStartX.current = event.clientX
    setIsDragging(true)
  }

  const handleSwipeMove = (event: React.PointerEvent<HTMLDivElement>) => {
    if (!isDragging || swipeStartX.current === null) return
    setSwipeOffset(event.clientX - swipeStartX.current)
  }

  const handleSwipeEnd = () => {
    if (!isDragging) return
    const threshold = 110
    if (swipeOffset > threshold) {
      handleSwipeDecision(true)
    } else if (swipeOffset < -threshold) {
      handleSwipeDecision(false)
    } else {
      setSwipeOffset(0)
    }
    swipeStartX.current = null
    setIsDragging(false)
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-canvas">
        <BrotherNav />
        <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="text-center text-ink-muted">Loading events...</div>
        </main>
      </div>
    )
  }

  // Navigation guard for evaluation mode
  const handleBeforeNavigate = () => {
    if (selectedRushees.length > 0) {
      return confirm('You have unsaved evaluation progress. Are you sure you want to leave? Your selected rushees will be saved, but make sure to come back and finish evaluating them.')
    }
    return true
  }

  // If we're in evaluation mode, show the inline evaluation flow
  if (selectedEvent && currentEvent) {
    return (
      <div className="min-h-screen bg-canvas">
        <BrotherNav onBeforeNavigate={handleBeforeNavigate} />

        <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          {step === 'select' && (
            <>
              <div className="mb-6">
                <button
                  onClick={() => {
                    router.push('/brother/events')
                    setSelectedEvent(null)
                    setSelectedRushees([])
                    setEvaluatedRushees([])
                    setAwaitingProfessional([])
                    setStep('select')
                  }}
                  className="text-ink-muted hover:text-ink mb-4 flex items-center gap-1"
                >
                  ← Back to Events
                </button>
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="text-xs uppercase tracking-[0.35em] text-ink-subtle">Step 1 of 2</p>
                    <h1 className="mt-2 text-3xl font-semibold text-ink">
                      {currentEvent.title}
                    </h1>
                    <p className="mt-2 text-sm text-ink-muted">
                      Select all rushees you spoke with or engaged during this event
                    </p>
                  </div>
                  <button
                    onClick={() => setSelectionView(selectionView === 'grid' ? 'swipe' : 'grid')}
                    className="px-4 py-2 bg-surface border border-line-strong text-ink-muted rounded-lg font-semibold hover:bg-surface-alt transition-colors text-sm whitespace-nowrap"
                  >
                    {selectionView === 'grid' ? 'Swipe View' : 'Card View'}
                  </button>
                </div>
              </div>

              {selectionView === 'grid' ? (
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4 mb-6">
                  {currentEvent.attendees.map((rushee: any) => {
                    const isSelected = selectedRushees.includes(rushee.id)
                    return (
                      <div
                        key={rushee.id}
                        onClick={() => handleRusheeToggle(rushee.id)}
                        className={`p-4 border-2 rounded-xl cursor-pointer transition-all ${
                          isSelected
                            ? 'border-emerald-500 bg-emerald-50 ring-2 ring-emerald-500/20'
                            : 'border-line bg-surface hover:border-line-strong'
                        }`}
                      >
                        <div className="w-full aspect-square mb-2 flex items-center justify-center bg-surface-sunken rounded-lg overflow-hidden relative">
                          <RusheePhoto
                            photo={rushee.photo}
                            alt={rushee.name}
                            className="w-full h-full object-cover"
                            fallback={
                              <div className="text-ink-faint text-4xl">
                                <svg className="w-16 h-16" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                                </svg>
                              </div>
                            }
                          />
                          {/* Selection checkmark */}
                          {isSelected && (
                            <div className="absolute top-2 right-2 bg-emerald-500 text-white rounded-full w-6 h-6 flex items-center justify-center shadow-lg">
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                              </svg>
                            </div>
                          )}
                        </div>
                        <p className={`text-sm text-center font-medium truncate ${isSelected ? 'text-emerald-700' : 'text-ink'}`}>{rushee.name}</p>
                      </div>
                    )
                  })}
                </div>
              ) : (
                <div className="flex flex-col items-center gap-4 mb-6">
                  <div className="w-full max-w-sm">
                    {currentSwipeRushee ? (
                      <div className="relative">
                        <div
                          className={`relative bg-surface border border-line rounded-2xl shadow-lg overflow-hidden touch-pan-y select-none transition-shadow ${
                            selectedRushees.includes(currentSwipeRushee.id) ? 'ring-2 ring-emerald-400 ring-offset-2 ring-offset-surface-sunken' : ''
                          }`}
                          style={{ transform: `translateX(${swipeOffset}px) rotate(${swipeOffset / 20}deg)`, transition: isDragging ? 'none' : 'transform 180ms ease' }}
                          onPointerDown={handleSwipeStart}
                          onPointerMove={handleSwipeMove}
                          onPointerUp={handleSwipeEnd}
                          onPointerCancel={handleSwipeEnd}
                          onClick={() => setRevealAttendance(prev => !prev)}
                        >
                          {swipeOffset !== 0 && (
                            <div
                              className={`absolute inset-0 pointer-events-none z-10 ${
                                swipeOffset > 0 ? 'bg-emerald-400/20' : 'bg-rose-400/20'
                              }`}
                              style={{ opacity: Math.min(Math.abs(swipeOffset) / 180, 0.6) }}
                            />
                          )}
                          <div className="aspect-[3/4] bg-surface-sunken relative">
                            {revealAttendance ? (
                              <RusheePhoto
                                photo={currentSwipeRushee.attendancePhotoUrl}
                                bucket="attendance-photos"
                                alt={currentSwipeRushee.name}
                                className="w-full h-full object-cover"
                                fallback={
                                  <div className="w-full h-full flex items-center justify-center text-ink-faint">
                                    <svg className="w-20 h-20" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                                    </svg>
                                  </div>
                                }
                              />
                            ) : (
                              <RusheePhoto
                                photo={currentSwipeRushee.photo}
                                alt={currentSwipeRushee.name}
                                className="w-full h-full object-cover"
                                fallback={
                                  <div className="w-full h-full flex items-center justify-center text-ink-faint">
                                    <svg className="w-20 h-20" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                                    </svg>
                                  </div>
                                }
                              />
                            )}
                            <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-[var(--color-inverse)]/70 via-[var(--color-inverse)]/20 to-transparent p-4">
                              <p className="text-on-inverse text-xl font-semibold">{currentSwipeRushee.name}</p>
                              <p className="text-on-inverse/80 text-sm">{selectedRushees.includes(currentSwipeRushee.id) ? 'Marked as Met' : 'Not selected yet'}</p>
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center justify-between mt-3 text-xs text-ink-subtle">
                          <span>{swipeIndex + 1} of {currentAttendees.length}</span>
                          <span>{selectedRushees.length} selected</span>
                        </div>
                      </div>
                    ) : (
                      <div className="bg-surface border border-line rounded-2xl p-6 text-center">
                        <p className="text-ink-muted font-semibold">All rushees reviewed</p>
                        <p className="text-ink-subtle text-sm mt-1">You can switch back to card view to edit selections.</p>
                      </div>
                    )}
                  </div>
                  <div className="flex flex-wrap justify-center gap-2">
                    <button
                      onClick={() => goToSwipeIndex(Math.max(0, swipeIndex - 1))}
                      disabled={swipeIndex <= 0}
                      className={`px-4 py-2 rounded-lg text-sm font-semibold transition-colors ${
                        swipeIndex > 0 ? 'bg-surface-sunken text-ink-muted hover:bg-line' : 'bg-surface-sunken text-ink-faint cursor-not-allowed'
                      }`}
                    >
                      Back
                    </button>
                    <button
                      onClick={() => handleSwipeDecision(false)}
                      disabled={!currentSwipeRushee}
                      className={`px-4 py-2 rounded-lg text-sm font-semibold transition-colors ${
                        currentSwipeRushee ? 'bg-rose-50 text-rose-700 border border-rose-200 hover:bg-rose-100' : 'bg-surface-sunken text-ink-faint cursor-not-allowed'
                      }`}
                    >
                      Not Met
                    </button>
                    <button
                      onClick={() => handleSwipeDecision(true)}
                      disabled={!currentSwipeRushee}
                      className={`px-4 py-2 rounded-lg text-sm font-semibold transition-colors ${
                        currentSwipeRushee ? 'bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-100' : 'bg-surface-sunken text-ink-faint cursor-not-allowed'
                      }`}
                    >
                      Met
                    </button>
                    <button
                      onClick={() => setRevealAttendance(prev => !prev)}
                      disabled={!currentSwipeRushee}
                      className={`px-4 py-2 rounded-lg text-sm font-semibold transition-colors ${
                        currentSwipeRushee ? 'bg-inverse text-on-inverse hover:bg-inverse-soft' : 'bg-surface-sunken text-ink-faint cursor-not-allowed'
                      }`}
                    >
                      {revealAttendance ? 'Show Profile' : 'Reveal Attendance'}
                    </button>
                  </div>
                </div>
              )}

              {/* Floating bottom bar - extra padding on mobile for nav pill */}
              <div className="fixed bottom-0 left-0 right-0 bg-surface/95 backdrop-blur-sm pt-4 pb-6 lg:pb-6 px-4 border-t border-line shadow-lg z-40" style={{ paddingBottom: 'max(1.5rem, calc(env(safe-area-inset-bottom) + 5rem))' }}>
                <div className="flex gap-3 max-w-4xl mx-auto">
                  <button
                    onClick={() => {
                      router.push('/brother/events')
                      setSelectedEvent(null)
                      setSelectedRushees([])
                      setEvaluatedRushees([])
                      setAwaitingProfessional([])
                      setStep('select')
                    }}
                    className="flex-1 py-3 bg-surface text-ink border border-line-strong rounded-lg font-semibold hover:bg-surface-alt transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleContinueToEvaluate}
                    disabled={selectedRushees.length === 0}
                    className={`flex-1 py-3 rounded-lg font-semibold transition-colors ${
                      selectedRushees.length > 0
                        ? 'bg-inverse text-on-inverse hover:bg-inverse-soft'
                        : 'bg-line text-ink-faint cursor-not-allowed'
                    }`}
                  >
                    Continue ({selectedRushees.length} selected)
                  </button>
                </div>
              </div>
              {/* Spacer for fixed bottom bar - taller on mobile for nav pill */}
              <div className="h-32 lg:h-24"></div>
            </>
          )}

          {step === 'evaluate' && (
            <>
              <div className="mb-6">
                <button
                  onClick={() => {
                    router.push('/brother/events')
                    setSelectedEvent(null)
                    setSelectedRushees([])
                    setEvaluatedRushees([])
                    setAwaitingProfessional([])
                    setStep('select')
                  }}
                  className="text-ink-muted hover:text-ink mb-4 flex items-center gap-1"
                >
                  ← Back to Events
                </button>
                <div className="flex justify-between items-start">
                  <div>
                    <p className="text-xs uppercase tracking-[0.35em] text-ink-subtle">Step 2 of 2</p>
                    <h1 className="mt-2 text-3xl font-semibold text-ink">
                      Evaluate Rushees
                    </h1>
                    <p className="mt-2 text-sm text-ink-muted">
                      {currentEvent.title} - Click on a rushee to evaluate them
                    </p>
                  </div>
                  <button
                    onClick={async () => {
                      if (!confirm('Reset your rushee selection? This will take you back to the selection screen and clear the interactions it recorded.')) {
                        return
                      }

                      // PRD §6.4.4: removes the interaction records created
                      // by that selection, so interaction counts stay accurate.
                      if (selectedEvent) {
                        try {
                          const { supabase } = await import('@/lib/supabase')
                          const { data: { user } } = await supabase.auth.getUser()
                          if (user) {
                            await (supabase as any)
                              .from('brother_rushee_interactions')
                              .delete()
                              .eq('brother_id', user.id)
                              .eq('event_id', selectedEvent)
                          }
                        } catch {
                          alert('Could not clear the recorded interactions. Please try again.')
                          return
                        }
                        localStorage.removeItem(`selected_${selectedEvent}`)
                      }

                      setStep('select')
                      setSelectedRushees([])
                    }}
                    className="px-4 py-2 bg-surface-sunken border border-line-strong text-ink-muted rounded-lg font-semibold hover:bg-line transition-colors text-sm whitespace-nowrap"
                  >
                    Reset Selection
                  </button>
                </div>
              </div>

              {/* Progress bar */}
              <div className="bg-surface border border-line rounded-xl p-4 mb-6">
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <span className="text-sm text-ink-muted">
                    Progress: <span className="font-bold text-ink">{evaluatedRushees.length}</span> / {selectedRushees.length} evaluated
                    {awaitingProfessional.length > 0 && (
                      <span className="text-amber-600 ml-2">({awaitingProfessional.length} awaiting professional)</span>
                    )}
                  </span>
                  {evaluatedRushees.length === selectedRushees.length && selectedRushees.length > 0 && awaitingProfessional.length === 0 && (
                    <span className="text-sm font-semibold text-emerald-600">
                      ✓ All Complete
                    </span>
                  )}
                  {evaluatedRushees.length === selectedRushees.length && selectedRushees.length > 0 && awaitingProfessional.length > 0 && (
                    <span className="text-sm font-semibold text-amber-600">
                      ⚠ Needs Professional Scores
                    </span>
                  )}
                </div>
                <div className="mt-3 h-2 bg-surface-sunken rounded-full overflow-hidden">
                  <div
                    className={`h-full transition-all duration-300 ${awaitingProfessional.length > 0 ? 'bg-amber-500' : 'bg-emerald-500'}`}
                    style={{ width: `${selectedRushees.length > 0 ? (evaluatedRushees.length / selectedRushees.length) * 100 : 0}%` }}
                  />
                </div>
              </div>

              {/* Rushee list */}
              <div className="space-y-3 mb-6">
                {currentEvent.attendees
                  .filter((r: any) => selectedRushees.includes(r.id))
                  .map((rushee: any) => {
                    const isEvaluated = evaluatedRushees.includes(rushee.id)
                    const isAwaitingProfessional = awaitingProfessional.includes(rushee.id)
                    const isComplete = isEvaluated && !isAwaitingProfessional
                    return (
                      <Link
                        key={rushee.id}
                        href={`/brother/evaluate/${rushee.id}?event=${selectedEvent}&return=events`}
                        className={`flex items-center justify-between p-4 border rounded-xl transition-colors relative ${
                          isComplete
                            ? 'bg-emerald-50 border-emerald-300 hover:bg-emerald-100/70'
                            : isAwaitingProfessional
                              ? 'bg-amber-50 border-amber-300 hover:bg-amber-100/70'
                              : 'bg-surface border-line hover:bg-surface-alt'
                        }`}
                      >
                        <div className="flex items-center">
                          <div className="w-12 h-12 mr-3 bg-surface-sunken rounded-full overflow-hidden flex items-center justify-center flex-shrink-0 relative">
                            <RusheePhoto
                              photo={rushee.photo}
                              alt={rushee.name}
                              className="w-full h-full object-cover"
                              fallback={
                                <svg className="w-6 h-6 text-ink-faint" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                                </svg>
                              }
                            />
                            {/* Status badge */}
                            {isComplete && (
                              <div className="absolute -top-1 -right-1 bg-emerald-600 text-white rounded-full w-5 h-5 flex items-center justify-center text-xs font-bold shadow-lg">
                                ✓
                              </div>
                            )}
                            {isAwaitingProfessional && (
                              <div className="absolute -top-1 -right-1 bg-amber-500 text-white rounded-full w-5 h-5 flex items-center justify-center text-xs font-bold shadow-lg">
                                !
                              </div>
                            )}
                          </div>
                          <div>
                            <span className="text-ink font-medium block">{rushee.name}</span>
                            {isComplete ? (
                              <span className="text-xs text-emerald-600 font-semibold">✓ Click to Update</span>
                            ) : isAwaitingProfessional ? (
                              <span className="text-xs text-amber-600 font-semibold">Awaiting Professional - Click to Update</span>
                            ) : (
                              <span className="text-xs text-ink-subtle">Click to Evaluate</span>
                            )}
                          </div>
                        </div>
                        <span className="text-ink">→</span>
                      </Link>
                    )
                  })}
              </div>

              {/* Floating bottom bar - extra padding on mobile for nav pill */}
              <div className="fixed bottom-0 left-0 right-0 bg-surface/95 backdrop-blur-sm pt-4 pb-6 lg:pb-6 px-4 border-t border-line shadow-lg z-40" style={{ paddingBottom: 'max(1.5rem, calc(env(safe-area-inset-bottom) + 5rem))' }}>
                <div className="flex gap-3 max-w-4xl mx-auto">
                  <button
                    onClick={() => {
                      setStep('select')
                    }}
                    className="px-6 py-3 bg-surface text-ink border border-line-strong rounded-lg font-semibold hover:bg-surface-alt transition-colors"
                  >
                    ← Back
                  </button>
                  <button
                    onClick={async () => {
                      // R35 — completion requires that every rushee marked
                      // as "met" has an evaluation, or an explicit
                      // acknowledgment that the rest are being skipped.
                      const unevaluated = selectedRushees.filter(
                        (id) => !evaluatedRushees.includes(id)
                      )

                      if (unevaluated.length > 0) {
                        const names = unevaluated
                          .map((id) => currentAttendees.find((r: any) => r.id === id)?.name || 'Unknown')
                          .join(', ')
                        const proceed = confirm(
                          `You haven't evaluated ${unevaluated.length} rushee${unevaluated.length === 1 ? '' : 's'} you marked as met:\n\n${names}\n\nComplete anyway? Your attendance will still be recorded and you can evaluate them later from the Rushees page.`
                        )
                        if (!proceed) return
                      }

                      // Mark brother as attended for this event
                      if (selectedEvent) {
                        try {
                          const { supabase } = await import('@/lib/supabase')
                          const { data: { user } } = await supabase.auth.getUser()
                          if (user) {
                            await (supabase as any)
                              .from('brother_event_attendance')
                              .upsert({
                                event_id: selectedEvent,
                                brother_id: user.id
                              }, {
                                onConflict: 'event_id,brother_id'
                              })
                          }
                        } catch (error) {
                          console.error('Error marking attendance:', error)
                        }
                      }

                      router.push('/brother/events')
                      setSelectedEvent(null)
                      setSelectedRushees([])
                      setEvaluatedRushees([])
                      setAwaitingProfessional([])
                      setStep('select')
                    }}
                    className="flex-1 py-3 bg-inverse text-on-inverse rounded-lg font-semibold hover:bg-inverse-soft transition-colors"
                  >
                    Complete Evaluations
                  </button>
                </div>
              </div>
              {/* Spacer for fixed bottom bar - taller on mobile for nav pill */}
              <div className="h-32 lg:h-24"></div>
            </>
          )}
        </main>
      </div>
    )
  }

  // Default view: Events list
  return (
    <div className="min-h-screen bg-canvas">
      <BrotherNav />

      <PullToRefresh onRefresh={handleRefresh} className="min-h-screen lg:min-h-0">
        <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-6">
          <p className="text-xs uppercase tracking-[0.35em] text-ink-subtle">Brother Events</p>
          <h1 className="mt-2 text-3xl font-semibold text-ink">Rush Events</h1>
          <p className="mt-2 text-sm text-ink-muted">
            Review attendance and launch evaluations when the window opens.
          </p>
        </div>

        {/* Events List */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {events.map((event) => (
            <div
              key={event.id}
              className="bg-surface border border-line rounded-2xl p-6 shadow-sm"
            >
              {attendedEventIds.includes(event.id) && (
                <div className="mb-3 inline-flex items-center gap-2 rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700 border border-emerald-200">
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M5 13l4 4L19 7" />
                  </svg>
                  Attendance Confirmed
                </div>
              )}
              <div className="flex justify-between items-start mb-3">
                <h2 className="text-xl font-semibold text-ink">{event.title}</h2>
                <span
                  className={`px-3 py-1 rounded-full text-xs font-semibold ${
                    event.type === 'Professional'
                      ? 'bg-inverse text-on-inverse'
                      : 'bg-line text-ink-muted'
                  }`}
                >
                  {event.type}
                </span>
              </div>

              <div className="space-y-2 text-ink-muted mb-4 text-sm">
                <p>📅 {formatDateInEST(event.date)}</p>
                <p>🕐 {event.time || 'TBA'}</p>
                <p>👥 {event.attendees.length} rushees attended</p>
              </div>

              {event.attendees.length === 0 ? (
                <div className="w-full py-3 bg-surface-sunken text-ink-subtle rounded-lg text-center font-semibold">
                  No Attendees Recorded
                </div>
              ) : event.status === 'evaluation' ? (
                <button
                  onClick={() => handleStartEvaluation(event.id)}
                  className="w-full py-3 bg-inverse text-on-inverse rounded-lg font-semibold hover:bg-inverse-soft transition-colors"
                >
                  Evaluation
                </button>
              ) : (
                <div className="w-full py-3 bg-surface-sunken text-ink-subtle rounded-lg text-center font-semibold">
                  {event.status === 'attendance' ? 'Attendance Phase' : 'Event Locked'}
                </div>
              )}
            </div>
          ))}
        </div>
        </main>
      </PullToRefresh>
    </div>
  )
}

export default function BrotherEvents() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-canvas">
        <BrotherNav />
        <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="text-center text-ink-muted">Loading...</div>
        </main>
      </div>
    }>
      <BrotherEventsContent />
    </Suspense>
  )
}

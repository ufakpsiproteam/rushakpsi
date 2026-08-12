'use client'

import BrotherNav from '@/components/brother/BrotherNav'
import PullToRefresh from '@/components/PullToRefresh'
import Link from 'next/link'
import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'

export default function BrotherDashboard() {
  const [brotherData, setBrotherData] = useState({
    name: '',
    eventsAttended: 0,
    rusheesEvaluated: 0,
    rusheesStarred: 0
  })
  const [loading, setLoading] = useState(true)
  const [showEvaluatedModal, setShowEvaluatedModal] = useState(false)
  const [evaluatedRushees, setEvaluatedRushees] = useState<any[]>([])
  const [attendedEvents, setAttendedEvents] = useState<any[]>([])

  useEffect(() => {
    loadBrotherData()
  }, [])

  async function handleRefresh() {
    await loadBrotherData()
  }

  async function loadBrotherData() {
      try {
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) return

        // Check if user is admin and redirect to admin dashboard
        const { data: brother } = await supabase
          .from('brothers')
          .select('name, access_level')
          .eq('id', user.id)
          .single()

        if (brother) {
          // Redirect admins to admin dashboard
          if ((brother as any).access_level === 'admin') {
            window.location.href = '/admin/dashboard'
            return
          }

          // Get distinct rushees evaluated by this brother
          const { data: evaluations } = await supabase
            .from('evaluations')
            .select(`
              rushee_id,
              rushees (
                id,
                name,
                major,
                year,
                photo
              )
            `)
            .eq('brother_id', user.id)

          const uniqueRushees = new Set(
            (evaluations || [])
              .map((e: any) => e.rushee_id)
              .filter((id: any) => id !== null)
          )

          // Store evaluated rushees for modal
          setEvaluatedRushees(evaluations || [])

          // Get count of unique rushees starred by this brother
          const { count: rusheesStarred } = await supabase
            .from('starred_rushees')
            .select('*', { count: 'exact', head: true })
            .eq('brother_id', user.id)

          const { data: attendance } = await supabase
            .from('brother_event_attendance')
            .select('event_id')
            .eq('brother_id', user.id)

          const uniqueEventsAttended = new Set(
            (attendance || [])
              .map((entry: any) => entry.event_id)
              .filter((id: any) => id !== null)
          )

          setBrotherData({
            name: (brother as any).name,
            eventsAttended: uniqueEventsAttended.size,
            rusheesEvaluated: uniqueRushees.size,
            rusheesStarred: rusheesStarred || 0
          })

          // Load attended events with full event details
          const attendedEventIds = Array.from(uniqueEventsAttended)
          if (attendedEventIds.length > 0) {
            const { data: eventDetails } = await supabase
              .from('events')
              .select('*')
              .in('id', attendedEventIds)
              .order('date', { ascending: false })

            const formattedEvents = (eventDetails || []).map((event: any) => ({
              id: event.id,
              title: event.title,
              type: event.type,
              date: new Date(event.date).toLocaleDateString('en-US', {
                month: 'long',
                day: 'numeric',
                year: 'numeric'
              })
            }))
            setAttendedEvents(formattedEvents)
          }
        }
      } catch (error) {
        console.error('Error loading brother data:', error)
      } finally {
        setLoading(false)
      }
    }

  return (
    <div className="min-h-screen bg-canvas">
      <BrotherNav />

      <PullToRefresh onRefresh={handleRefresh} className="min-h-screen lg:min-h-0">
        <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-8">
          <p className="text-xs uppercase tracking-[0.35em] text-ink-subtle">Brother Dashboard</p>
          <h1 className="mt-2 text-3xl font-semibold text-ink">
            {loading ? 'Welcome!' : `Welcome, ${brotherData.name}!`}
          </h1>
          <p className="mt-2 text-sm text-ink-muted">
            Manage evaluations and track rushees throughout the recruitment process.
          </p>
        </div>

        {/* Stats Overview */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 mb-8">
          <div className="bg-white border border-line rounded-2xl p-6 shadow-sm">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-ink-muted text-sm font-medium mb-1">Events Attended</p>
                <p className="text-3xl font-semibold text-ink">{brotherData.eventsAttended}</p>
              </div>
              <div className="text-2xl text-ink-faint">
                <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6M7 4h6a2 2 0 012 2v2h2a2 2 0 012 2v10a2 2 0 01-2 2H7a2 2 0 01-2-2V6a2 2 0 012-2z" />
                </svg>
              </div>
            </div>
          </div>

          <button
            onClick={() => setShowEvaluatedModal(true)}
            className={`rounded-2xl p-6 shadow-sm w-full text-left transition-all hover:scale-[1.02] cursor-pointer ${
              brotherData.rusheesEvaluated >= 15
                ? 'bg-emerald-600 border border-emerald-600 text-white'
                : 'bg-ink border border-ink text-white'
            }`}
          >
            <div className="flex items-center justify-between">
              <div>
                <p className="text-white/70 text-sm font-medium mb-1">Rushees Evaluated</p>
                <div className="flex items-baseline gap-2">
                  <p className="text-3xl font-semibold text-white">{brotherData.rusheesEvaluated}</p>
                  <span className="text-sm text-white/70">/ 15 minimum</span>
                </div>
                {brotherData.rusheesEvaluated >= 15 && (
                  <p className="text-xs text-white/90 mt-1">✓ Minimum met!</p>
                )}
                <p className="text-xs text-white/60 mt-2">Click to view all →</p>
              </div>
              <div className="text-2xl text-white/70">
                <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 9h6m-6 4h6M7 19h10a2 2 0 002-2V7l-4-4H7a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 15l2 2 4-4" />
                </svg>
              </div>
            </div>
          </button>

          <div className="bg-white border border-line rounded-2xl p-6 shadow-sm">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-ink-muted text-sm font-medium mb-1">Rushees Starred</p>
                <p className="text-3xl font-semibold text-ink">{brotherData.rusheesStarred}</p>
              </div>
              <div className="text-2xl text-ink-faint">
                <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 3.5l2.472 5.006 5.528.804-4 3.902.944 5.508L12 16.9l-4.944 2.82.944-5.508-4-3.902 5.528-.804L12 3.5z" />
                </svg>
              </div>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Main Content */}
          <div className="lg:col-span-2 space-y-6">
            {/* Events Attended */}
            <div className="bg-white border border-line rounded-2xl p-6 shadow-sm">
              <h2 className="text-xl font-semibold text-ink mb-4">Events Attended</h2>
              <div className="space-y-3">
                {attendedEvents.length === 0 ? (
                  <div className="py-6 text-center text-sm text-ink-subtle border border-dashed border-line rounded-xl">
                    No events attended yet. Complete event evaluations to mark attendance.
                  </div>
                ) : (
                  attendedEvents.map((event) => (
                    <div key={event.id} className="bg-surface-alt border border-emerald-200/40 rounded-xl p-4">
                      <div className="flex justify-between items-start">
                        <div>
                          <h3 className="text-lg font-semibold text-ink">{event.title}</h3>
                          <p className="text-sm text-ink-subtle">{event.date}</p>
                          <p className="text-sm text-emerald-600 mt-1">
                            ✓ Attendance confirmed
                          </p>
                        </div>
                        <span className={`px-3 py-1 rounded-full text-xs font-semibold ${
                          event.type === 'Professional'
                            ? 'bg-ink text-white'
                            : 'bg-line text-ink-muted'
                        }`}>
                          {event.type}
                        </span>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            {/* Evaluation Requirement */}
            {brotherData.rusheesEvaluated < 15 && (
              <div className="bg-amber-50 border border-amber-200 rounded-2xl p-5 shadow-sm">
                <h3 className="text-amber-900 font-semibold mb-2 text-sm">⚠️ Evaluation Minimum</h3>
                <p className="text-sm text-amber-800 mb-2">
                  You need to evaluate <span className="font-bold">{15 - brotherData.rusheesEvaluated} more rushee{15 - brotherData.rusheesEvaluated !== 1 ? 's' : ''}</span> to meet the minimum requirement.
                </p>
                <p className="text-xs text-amber-700">
                  Evaluate at least 15 unique rushees throughout the rush process.
                </p>
              </div>
            )}

            {/* Tips */}
            <div className="bg-white border border-line rounded-2xl p-5 shadow-sm">
              <h3 className="text-ink font-semibold mb-2 text-sm">💡 Tip</h3>
              <p className="text-sm text-ink-muted">
                Your detailed feedback helps us make the best decisions! Make sure to evaluate at least 15 unique rushees throughout rush.
              </p>
            </div>
          </div>
        </div>

        {/* Evaluated Rushees Modal */}
        {showEvaluatedModal && (
          <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <div className="bg-white border border-line rounded-2xl p-6 max-w-4xl w-full max-h-[90vh] overflow-y-auto shadow-xl">
              <div className="flex justify-between items-start mb-6">
                <div>
                  <h2 className="text-2xl font-semibold text-ink mb-2">Your Evaluated Rushees</h2>
                  <p className="text-ink-muted">
                    You've evaluated {brotherData.rusheesEvaluated} unique rushee{brotherData.rusheesEvaluated !== 1 ? 's' : ''} so far.
                  </p>
                </div>
                <button
                  onClick={() => setShowEvaluatedModal(false)}
                  className="text-ink-muted hover:text-ink text-2xl"
                >
                  ✕
                </button>
              </div>

              {evaluatedRushees.length === 0 ? (
                <div className="py-12 text-center text-ink-subtle border border-dashed border-line rounded-xl">
                  No rushees evaluated yet. Start evaluating at events!
                </div>
              ) : (
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
                  {evaluatedRushees.map((evaluation: any) => {
                    const rushee = evaluation.rushees
                    return (
                      <Link
                        key={rushee.id}
                        href={`/brother/evaluate/${rushee.id}?return=dashboard`}
                        className="bg-white border border-line rounded-xl overflow-hidden hover:shadow-lg transition-all hover:scale-[1.02] cursor-pointer"
                      >
                        {/* Profile Photo */}
                        <div className="relative aspect-square bg-surface-sunken">
                          {rushee.photo && rushee.photo.startsWith('http') ? (
                            <img
                              src={rushee.photo}
                              alt={rushee.name}
                              className="w-full h-full object-cover"
                            />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-surface-sunken to-line">
                              <svg className="w-1/2 h-1/2 text-ink-faint" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                              </svg>
                            </div>
                          )}
                          {/* Checkmark Badge */}
                          <div className="absolute top-2 right-2 bg-emerald-600 text-white rounded-full w-7 h-7 flex items-center justify-center text-sm font-bold shadow-lg">
                            ✓
                          </div>
                        </div>

                        {/* Info Section */}
                        <div className="p-3">
                          <h3 className="font-bold text-ink text-sm truncate mb-1">{rushee.name}</h3>
                          <p className="text-xs text-ink-muted truncate mb-2">{rushee.major}</p>
                          <p className="text-xs text-emerald-600 font-semibold">Click to update →</p>
                        </div>
                      </Link>
                    )
                  })}
                </div>
              )}

              <div className="mt-6 flex justify-end">
                <button
                  onClick={() => setShowEvaluatedModal(false)}
                  className="px-6 py-2 bg-ink text-white rounded-lg font-semibold hover:bg-inverse-soft transition-colors"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        )}
        </main>
      </PullToRefresh>
    </div>
  )
}

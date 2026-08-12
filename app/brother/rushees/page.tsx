'use client'

import BrotherNav from '@/components/brother/BrotherNav'
import PullToRefresh from '@/components/PullToRefresh'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { getRusheesWithBrotherData, toggleStarRushee, updatePersonalNotes } from '@/lib/api'
import { isRejected } from '@/lib/policy'

export default function BrotherRushees() {
  const router = useRouter()
  const [searchTerm, setSearchTerm] = useState('')
  const [filterStarred, setFilterStarred] = useState(false)
  const [selectedRushee, setSelectedRushee] = useState<string | null>(null)
  const [rushees, setRushees] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [notesCache, setNotesCache] = useState<{ [key: string]: string }>({})

  useEffect(() => {
    checkAccessAndLoadRushees()
  }, [])

  async function handleRefresh() {
    await loadRushees()
  }

  // Reload rushees when navigating back to this page
  useEffect(() => {
    const handleVisibilityChange = async () => {
      if (document.visibilityState === 'visible') {
        await loadRushees()
      }
    }

    const handleFocus = async () => {
      await loadRushees()
    }

    // Listen for both visibility change and focus events
    document.addEventListener('visibilitychange', handleVisibilityChange)
    window.addEventListener('focus', handleFocus)

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange)
      window.removeEventListener('focus', handleFocus)
    }
  }, [])

  async function checkAccessAndLoadRushees() {
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
        window.location.href = '/admin/dashboard'
        return
      }

      await loadRushees()
    } catch (error) {
      console.error('Error checking access:', error)
      setLoading(false)
    }
  }

  async function loadRushees() {
    try {
      const data = await getRusheesWithBrotherData()
      setRushees(data)

      // Initialize notes cache
      const cache: { [key: string]: string } = {}
      data.forEach(rushee => {
        cache[rushee.id] = rushee.personalNotes
      })
      setNotesCache(cache)
    } catch (error) {
      console.error('Error loading rushees:', error)
      alert('Failed to load rushees')
    } finally {
      setLoading(false)
    }
  }

  const toggleStar = async (rusheeId: string) => {
    try {
      const newStarredState = await toggleStarRushee(rusheeId)

      // Update local state
      setRushees(prev => prev.map(r =>
        r.id === rusheeId ? { ...r, starred: newStarredState } : r
      ))
    } catch (error) {
      console.error('Error toggling star:', error)
      alert('Failed to update star status')
    }
  }

  const handleSaveNotes = async (rusheeId: string) => {
    try {
      const notes = notesCache[rusheeId] || ''
      await updatePersonalNotes(rusheeId, notes)

      // Update local state
      setRushees(prev => prev.map(r =>
        r.id === rusheeId ? { ...r, personalNotes: notes } : r
      ))

      alert('Notes saved successfully!')
    } catch (error) {
      console.error('Error saving notes:', error)
      alert('Failed to save notes')
    }
  }

  const filteredRushees = rushees.filter(rushee => {
    const matchesSearch = rushee.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         rushee.major.toLowerCase().includes(searchTerm.toLowerCase())
    const matchesStarred = !filterStarred || rushee.starred
    // R39 — exclude every published rejection, not just Invite Only (N).
    return (
      matchesSearch &&
      matchesStarred &&
      !isRejected({ inviteOnly: rushee.inviteOnly, bidStatus: rushee.bidStatus })
    )
  })

  const selectedRusheeData = rushees.find(r => r.id === selectedRushee)

  if (loading) {
    return (
      <div className="min-h-screen bg-canvas">
        <BrotherNav />
        <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="text-center text-ink-muted">Loading rushees...</div>
        </main>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-canvas">
      <BrotherNav />

      <PullToRefresh onRefresh={handleRefresh} className="min-h-screen lg:min-h-0">
        <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-6">
          <p className="text-xs uppercase tracking-[0.35em] text-ink-subtle">Brother Portal</p>
          <h1 className="mt-2 text-3xl font-semibold text-ink">All Rushees</h1>
          <p className="mt-2 text-sm text-ink-muted">
            Search, star, and take notes on rushees you meet.
          </p>
        </div>

        {/* Search and Filters - Sticky on desktop */}
        <div className="bg-white border border-line rounded-2xl p-4 mb-6 shadow-sm lg:sticky lg:top-20 lg:z-30">
          <div className="flex flex-col sm:flex-row gap-3">
            <input
              type="text"
              placeholder="Search by name or major..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="flex-1 px-4 py-2 bg-white border border-line rounded-lg text-ink placeholder-ink-faint focus:outline-none focus:ring-2 focus:ring-ink"
            />
            <button
              onClick={() => setFilterStarred(!filterStarred)}
              className={`px-6 py-2 rounded-lg font-semibold transition-colors ${
                filterStarred
                  ? 'bg-ink text-white'
                  : 'bg-white text-ink border border-line hover:bg-surface-alt'
              }`}
            >
              Starred Only
            </button>
          </div>
          <p className="text-xs text-ink-subtle mt-2">{filteredRushees.length} rushees</p>
        </div>

        {/* Rushees Grid - More columns on larger screens */}
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 2xl:grid-cols-7 gap-3 lg:gap-4">
          {filteredRushees.map((rushee) => (
            <div
              key={rushee.id}
              className="bg-white border border-line rounded-xl overflow-hidden hover:shadow-lg transition-shadow cursor-pointer group"
              onClick={() => setSelectedRushee(rushee.id)}
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
                    <svg className="w-1/3 h-1/3 text-ink-faint" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                    </svg>
                  </div>
                )}
                {/* Star Badge */}
                <button
                  onClick={(e) => {
                    e.stopPropagation()
                    toggleStar(rushee.id)
                  }}
                  className="absolute top-1.5 right-1.5 bg-white/90 backdrop-blur-sm rounded-full w-7 h-7 flex items-center justify-center hover:scale-110 transition-transform shadow text-sm"
                >
                  {rushee.starred ? '⭐' : '☆'}
                </button>
                {/* Event badges overlaid on photo */}
                <div className="absolute bottom-1.5 left-1.5 flex gap-1">
                  <span className={`px-1.5 py-0.5 rounded text-xs font-medium ${rushee.casualEvents >= 2 ? 'bg-emerald-500 text-white' : 'bg-black/60 text-white'}`}>
                    C:{rushee.casualEvents}
                  </span>
                  <span className={`px-1.5 py-0.5 rounded text-xs font-medium ${rushee.professionalEvents >= 1 ? 'bg-emerald-500 text-white' : 'bg-black/60 text-white'}`}>
                    P:{rushee.professionalEvents}
                  </span>
                </div>
              </div>

              {/* Info Section - More compact */}
              <div className="p-2">
                <h3 className="font-semibold text-ink text-sm truncate">{rushee.name}</h3>
                <p className="text-xs text-ink-subtle truncate">{rushee.major}</p>
              </div>
            </div>
          ))}
        </div>

        {filteredRushees.length === 0 && (
          <div className="bg-white border border-line rounded-2xl p-12 text-center shadow-sm">
            <p className="text-ink-muted">No rushees found matching your criteria.</p>
          </div>
        )}

        {/* Rushee Detail Modal */}
        {selectedRushee && selectedRusheeData && (
          <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <div className="bg-white border border-line rounded-2xl p-6 max-w-2xl w-full max-h-[90vh] overflow-y-auto shadow-xl">
              <div className="flex justify-between items-start mb-6">
                <div className="flex items-center gap-4">
                  {/* Profile Photo */}
                  {selectedRusheeData.photo && selectedRusheeData.photo.startsWith('http') ? (
                    <img
                      src={selectedRusheeData.photo}
                      alt={selectedRusheeData.name}
                      className="w-24 h-24 object-cover rounded-lg border-2 border-black"
                    />
                  ) : (
                    <div className="w-24 h-24 flex items-center justify-center bg-gradient-to-br from-surface-sunken to-line rounded-lg border-2 border-line-strong">
                      <svg className="w-12 h-12 text-ink-faint" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                      </svg>
                    </div>
                  )}
                    <div>
                    <h2 className="text-2xl font-semibold text-ink">{selectedRusheeData.name}</h2>
                    <p className="text-ink-muted">{selectedRusheeData.major}</p>
                    <p className="text-ink-subtle text-sm">{selectedRusheeData.year}</p>
                  </div>
                </div>
                <button
                  onClick={() => setSelectedRushee(null)}
                  className="text-ink-subtle hover:text-ink text-2xl"
                >
                  ✕
                </button>
              </div>

              {/* Stats */}
              <div className="grid grid-cols-2 gap-4 mb-6">
                <div className="bg-surface-sunken rounded-xl p-4">
                  <p className="text-ink-muted text-sm mb-1">Casual Events</p>
                  <p className="text-2xl font-semibold text-ink">{selectedRusheeData.casualEvents}</p>
                </div>
                <div className="bg-surface-sunken rounded-xl p-4">
                  <p className="text-ink-muted text-sm mb-1">Professional Events</p>
                  <p className="text-2xl font-semibold text-ink">{selectedRusheeData.professionalEvents}</p>
                </div>
              </div>

              {/* Personal Notes */}
              <div className="bg-surface-alt rounded-xl p-4 mb-6 border border-line">
                <h3 className="text-ink font-semibold mb-2">Your Personal Notes</h3>
                <textarea
                  value={notesCache[selectedRusheeData.id] || ''}
                  onChange={(e) => setNotesCache({ ...notesCache, [selectedRusheeData.id]: e.target.value })}
                  placeholder="Add your personal notes about this rushee..."
                  className="w-full px-3 py-2 bg-white border border-line rounded-lg text-ink placeholder-ink-faint focus:outline-none focus:ring-2 focus:ring-ink resize-none"
                  rows={4}
                />
                <button
                  onClick={() => handleSaveNotes(selectedRusheeData.id)}
                  className="mt-2 px-4 py-2 bg-ink text-white rounded-lg font-semibold hover:bg-inverse-soft transition-colors text-sm"
                >
                  Save Notes
                </button>
                <button
                  onClick={() => router.push(`/brother/evaluate/${selectedRusheeData.id}`)}
                  className="mt-3 w-full px-4 py-2 border border-line-strong text-ink rounded-lg font-semibold hover:bg-surface-sunken transition-colors text-sm"
                >
                  Update Evaluation
                </button>
              </div>

              {/* Actions */}
              <div className="space-y-3">
                <button
                  onClick={(e) => {
                    e.stopPropagation()
                    toggleStar(selectedRusheeData.id)
                  }}
                  className="w-full py-3 bg-surface-sunken border border-line text-ink rounded-lg font-semibold hover:bg-line transition-colors"
                >
                  {selectedRusheeData.starred ? '⭐ Unstar' : '☆ Star'} Rushee
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

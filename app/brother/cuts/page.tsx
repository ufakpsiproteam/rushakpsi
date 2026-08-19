'use client'

import BrotherNav from '@/components/brother/BrotherNav'
import RusheePhoto from '@/components/RusheePhoto'
import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/contexts/AuthContext'
import { hasCutsAccess } from '@/lib/auth'

interface RusheeData {
  id: string
  name: string
  major: string
  year: string
  gpa: string
  photo: string | null
  inviteOnly: boolean | null
  bidStatus: boolean | null
  casualEvents: number
  professionalEvents: number
  interactions: number
  evaluations: number
  avgScore: number
  professionalAvg: number
  personalAvg: number
  applicationScore: number | null
  application: {
    legalName: string
    preferredName: string
    pronouns: string
    phoneNumber: string
    email: string
    ufAddress: string
    major: string
    minor: string
    gpa: string
    expectedGraduationDate: string
    resumeUrl: string
    outsideInvolvements: string
    howHeardAboutAkpsi: string
    whyInterested: string
    pillarRelation: string
    brotherConnectionReason: string
    monopolyPiece: string
    monopolyThemeLesson: string
    isSubmitted: boolean
  } | null
}

export default function BrotherCuts() {
  const { profile, loading: authLoading } = useAuth()
  const [hasAccess, setHasAccess] = useState(false)
  const [selectedRushee, setSelectedRushee] = useState<string | null>(null)
  const [showApplication, setShowApplication] = useState(false)
  const [showComments, setShowComments] = useState(false)
  const [showGallery, setShowGallery] = useState(false)
  const [evaluations, setEvaluations] = useState<any[]>([])
  const [loadingEvaluations, setLoadingEvaluations] = useState(false)
  const [attendancePhotos, setAttendancePhotos] = useState<any[]>([])
  const [loadingPhotos, setLoadingPhotos] = useState(false)
  const [rushees, setRushees] = useState<RusheeData[]>([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [sortBy, setSortBy] = useState<'name' | 'rating'>('name')
  const [showFilters, setShowFilters] = useState(false)

  // Check access permissions
  useEffect(() => {
    // The auth context resolves `profile` asynchronously; while it's still
    // loading, `profile` is null and would read as "not authorized". Wait
    // for it to settle (one way or the other) before deciding access, so a
    // fresh page load doesn't briefly render "Access Denied" for a user who
    // actually has access.
    if (authLoading) return

    async function checkAccess() {
      const access = await hasCutsAccess(profile)
      setHasAccess(access)

      if (access) {
        await fetchRusheesData()
      }
      setLoading(false)
    }

    checkAccess()
  }, [profile, authLoading])

  // Fetch rushees data
  async function fetchRusheesData() {
    try {
      // Fetch all rushees
      const { data: rusheesData } = await supabase
        .from('rushees')
        .select('*')
        .order('name')

      if (!rusheesData) {
        return
      }

      // Fetch all attendance records
      const { data: attendanceData } = await supabase
        .from('event_attendance')
        .select('rushee_id, event:events(type), status')
        .eq('status', 'approved')

      // Fetch all evaluations
      const { data: evaluationsData } = await supabase
        .from('evaluations')
        .select('rushee_id, professional_score, personal_score')
        .range(0, 9999)

      // Fetch all applications
      const { data: applicationsData } = await supabase
        .from('applications')
        .select('*')

      // Accurate interaction counts (unique brothers) from standings logic
      const interactionCounts = new Map<string, number>()
      await Promise.all(
        rusheesData.map(async (rushee: any) => {
          const { data: interactionData } = await supabase
            .from('brother_rushee_interactions')
            .select('brother_id')
            .eq('rushee_id', rushee.id)
          const uniqueBrothers = new Set((interactionData || []).map((i: any) => i.brother_id))
          interactionCounts.set(rushee.id, uniqueBrothers.size)
        })
      )

      // Accurate evaluation counts (matches standings page)
      const evaluationCounts = new Map<string, number>()
      await Promise.all(
        rusheesData.map(async (rushee: any) => {
          const { count } = await supabase
            .from('evaluations')
            .select('*', { count: 'exact', head: true })
            .eq('rushee_id', rushee.id)
          evaluationCounts.set(rushee.id, count ?? 0)
        })
      )

      // Process data for each rushee
      const processedRushees: RusheeData[] = rusheesData.map((rushee: any) => {
        // Count attendance by type
        const rusheeAttendance = attendanceData?.filter((a: any) => a.rushee_id === rushee.id) || []
        const casualEvents = rusheeAttendance.filter((a: any) => a.event?.type === 'Casual').length
        const professionalEvents = rusheeAttendance.filter((a: any) => a.event?.type === 'Professional').length

        // Calculate evaluation stats
        const rusheeEvals = evaluationsData?.filter((e: any) => e.rushee_id === rushee.id) || []
        const evaluationCount = evaluationCounts.get(rushee.id) ?? rusheeEvals.length
        const interactionCount = interactionCounts.get(rushee.id) ?? evaluationCount

        let avgProfessional = 0
        let avgPersonal = 0
        let avgOverall = 0

        if (evaluationCount > 0) {
          // Only count evaluations with actual scores (not null/undefined)
          const professionalScores = rusheeEvals
            .map((e: any) => e.professional_score)
            .filter((score: any) => score != null && score > 0)
          const personalScores = rusheeEvals
            .map((e: any) => e.personal_score)
            .filter((score: any) => score != null && score > 0)

          // Calculate averages only from actual scores
          if (professionalScores.length > 0) {
            avgProfessional = professionalScores.reduce((sum: number, score: number) => sum + score, 0) / professionalScores.length
          }
          if (personalScores.length > 0) {
            avgPersonal = personalScores.reduce((sum: number, score: number) => sum + score, 0) / personalScores.length
          }

          // Calculate overall average from available scores
          const allScores = [...professionalScores, ...personalScores]
          if (allScores.length > 0) {
            avgOverall = allScores.reduce((sum: number, score: number) => sum + score, 0) / allScores.length
          }
        }

        // Get application data
        const application: any = applicationsData?.find((a: any) => a.rushee_id === rushee.id)

        return {
          id: rushee.id,
          name: rushee.name || 'Unknown',
          major: rushee.major || 'Undeclared',
          year: rushee.year || 'Unknown',
          gpa: rushee.gpa || 'N/A',
          photo: rushee.photo,
          inviteOnly: rushee.invite_only ?? null,
          bidStatus: rushee.bid_status ?? null,
          casualEvents,
          professionalEvents,
          interactions: interactionCount,
          evaluations: evaluationCount,
          avgScore: Number(avgOverall.toFixed(1)),
          professionalAvg: Number(avgProfessional.toFixed(1)),
          personalAvg: Number(avgPersonal.toFixed(1)),
          applicationScore: null,
          application: application && application.is_submitted ? {
            legalName: application.legal_name || '',
            preferredName: application.preferred_name || '',
            pronouns: application.pronouns || '',
            phoneNumber: application.phone_number || '',
            email: application.email || '',
            ufAddress: application.uf_address || '',
            major: application.major || '',
            minor: application.minor || '',
            gpa: application.gpa || '',
            expectedGraduationDate: application.expected_graduation_date || '',
            resumeUrl: application.resume_url || '',
            outsideInvolvements: application.outside_involvements || '',
            howHeardAboutAkpsi: application.how_heard_about_akpsi || '',
            whyInterested: application.why_interested || '',
            pillarRelation: application.pillar_relation || '',
            brotherConnectionReason: application.brother_connection_reason || '',
            monopolyPiece: application.monopoly_piece || '',
            monopolyThemeLesson: application.monopoly_theme_lesson || '',
            isSubmitted: application.is_submitted || false
          } : null
        }
      })

      setRushees(processedRushees)
    } catch (error) {
      console.error('Error fetching rushees data:', error)
    }
  }

  const loadEvaluations = async (rusheeId: string) => {
    setLoadingEvaluations(true)
    setEvaluations([])
    try {
      const { data, error } = await supabase
        .from('evaluations')
        .select('comments, professional_score, personal_score, created_at')
        .eq('rushee_id', rusheeId)
        .order('created_at', { ascending: false })

      if (error) throw error
      setEvaluations(data || [])
    } catch (error) {
      console.error('Error loading evaluations:', error)
    } finally {
      setLoadingEvaluations(false)
    }
  }

  const loadAttendancePhotos = async (rusheeId: string) => {
    setLoadingPhotos(true)
    setAttendancePhotos([])
    try {
      const { data, error } = await supabase
        .from('event_attendance')
        .select('photo_url, event:events(title, date), created_at')
        .eq('rushee_id', rusheeId)
        .not('photo_url', 'is', null)
        .order('created_at', { ascending: false })

      if (error) throw error
      setAttendancePhotos(data || [])
    } catch (error) {
      console.error('Error loading attendance photos:', error)
    } finally {
      setLoadingPhotos(false)
    }
  }

  const selectedRusheeData = rushees.find(r => r.id === selectedRushee)

  // Apply search filter first
  const searchFilteredRushees = rushees.filter(r => {
    if (!searchQuery.trim()) return true

    const query = searchQuery.toLowerCase()
    const matchesName = r.name.toLowerCase().includes(query)
    const matchesMajor = r.major.toLowerCase().includes(query)
    const matchesYear = r.year.toLowerCase().includes(query)

    return matchesName || matchesMajor || matchesYear
  })

  // Sort the results
  const filteredRushees = [...searchFilteredRushees].sort((a, b) => {
    if (sortBy === 'rating') {
      // Sort by avgScore descending (highest first)
      return b.avgScore - a.avgScore
    } else {
      // Sort by name alphabetically
      return a.name.localeCompare(b.name)
    }
  })

  const selectedIndex = filteredRushees.findIndex(r => r.id === selectedRushee)
  const canNavigatePrev = selectedIndex > 0
  const canNavigateNext = selectedIndex !== -1 && selectedIndex < filteredRushees.length - 1

  const handleNavigateRushee = (direction: 'prev' | 'next') => {
    if (selectedIndex === -1) return
    const nextIndex = direction === 'prev' ? selectedIndex - 1 : selectedIndex + 1
    const nextRushee = filteredRushees[nextIndex]
    if (!nextRushee) return
    setSelectedRushee(nextRushee.id)
    setShowApplication(false)
    setShowComments(false)
    setShowGallery(false)
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-canvas">
        <BrotherNav />
        <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="text-center py-12">
            <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-ink"></div>
            <p className="mt-4 text-ink-muted">Loading...</p>
          </div>
        </main>
      </div>
    )
  }

  if (!hasAccess) {
    return (
      <div className="min-h-screen bg-canvas">
        <BrotherNav />
        <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="bg-surface border border-line rounded-2xl p-6 text-center">
            <h2 className="text-xl font-semibold text-ink mb-2">Access Denied</h2>
            <p className="text-ink-muted">
              You need elevated permissions to access this page.
            </p>
          </div>
        </main>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-canvas">
      <BrotherNav />

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between mb-8">
          <div>
            <p className="text-xs uppercase tracking-[0.35em] text-ink-subtle">Cuts Review</p>
            <h1 className="mt-2 text-3xl font-semibold text-ink">Rushee Evaluations</h1>
            <p className="mt-2 text-sm text-ink-muted">View rushee data, evaluations, and applications (read-only).</p>
          </div>
        </div>

        {/* Search Bar and Filters */}
        {rushees.length > 0 && (
          <div className="mb-6 space-y-4">
            {/* Search Bar */}
            <div className="relative">
              <input
                type="text"
                placeholder="Search by name, major, or year..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full px-4 py-3 pl-11 bg-surface border border-line rounded-lg text-ink placeholder-ink-faint focus:ring-2 focus:ring-ink focus:border-transparent"
              />
              <svg
                className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-ink-faint"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="absolute right-3 top-1/2 transform -translate-y-1/2 text-ink-faint hover:text-ink-muted"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              )}
            </div>

            {/* Sort Section */}
            <div className="bg-surface border border-line rounded-lg">
              {/* Collapsible Header */}
              <button
                onClick={() => setShowFilters(!showFilters)}
                className="w-full px-4 py-3 flex items-center justify-between hover:bg-surface-alt transition-colors rounded-lg"
              >
                <div className="flex items-center gap-2">
                  <svg className="w-5 h-5 text-ink-muted" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4h13M3 8h9m-9 4h6m4 0l4-4m0 0l4 4m-4-4v12" />
                  </svg>
                  <span className="text-sm font-semibold text-ink-muted">Sort</span>
                  {sortBy === 'rating' && (
                    <span className="px-2 py-0.5 bg-surface-sunken text-ink text-xs font-semibold rounded-full">
                      Active
                    </span>
                  )}
                </div>
                <svg
                  className={`w-5 h-5 text-ink-muted transition-transform ${showFilters ? 'rotate-180' : ''}`}
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </button>

              {/* Collapsible Content */}
              {showFilters && (
                <div className="px-4 pb-4 pt-2 border-t border-line">
                  {/* Sort Dropdown */}
                  <div>
                    <label className="block text-sm font-semibold text-ink-muted mb-2">Sort by:</label>
                    <select
                      value={sortBy}
                      onChange={(e) => setSortBy(e.target.value as 'name' | 'rating')}
                      className="w-full px-3 py-2 bg-surface border border-line rounded-lg text-ink focus:ring-2 focus:ring-ink focus:border-transparent"
                    >
                      <option value="name">Name (A-Z)</option>
                      <option value="rating">Rating (High to Low)</option>
                    </select>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {rushees.length === 0 && (
          <div className="text-center py-12">
            <p className="text-ink-muted">No rushees found</p>
          </div>
        )}

        {/* No Results Message */}
        {filteredRushees.length === 0 && rushees.length > 0 && (
          <div className="text-center py-12">
            <p className="text-ink-muted">No rushees found matching your search</p>
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="mt-2 text-ink hover:underline text-sm"
              >
                Clear search
              </button>
            )}
          </div>
        )}

        {/* Rushees Grid */}
        {filteredRushees.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredRushees.map((rushee) => {
            return (
              <div
                key={rushee.id}
                className="border border-line bg-surface rounded-2xl p-5 transition-colors cursor-pointer relative shadow-sm hover:shadow-md"
              >
              <div
                className="flex items-center mb-4"
                onClick={() => {
                  setSelectedRushee(rushee.id)
                  setShowApplication(false)
                  setShowComments(false)
                }}
              >
                <div className="w-16 h-16 mr-3 bg-surface-sunken rounded-full overflow-hidden flex items-center justify-center flex-shrink-0">
                  <RusheePhoto
                    photo={rushee.photo}
                    alt={rushee.name}
                    className="w-full h-full object-cover"
                    fallback={
                      <svg className="w-8 h-8 text-ink-faint" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                      </svg>
                    }
                  />
                </div>
                <div className="flex-1">
                  <h3 className="text-lg font-semibold text-ink">{rushee.name}</h3>
                  <p className="text-sm text-ink-muted">{rushee.major}</p>
                  <p className="text-xs text-ink-subtle">{rushee.year} • GPA: {rushee.gpa}</p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3 text-sm mb-3">
                <div className="bg-surface/70 border border-line rounded-lg p-2">
                  <p className="text-ink-subtle text-xs uppercase tracking-[0.2em]">Casual</p>
                  <p className="text-ink font-semibold">{rushee.casualEvents}</p>
                </div>
                <div className="bg-surface/70 border border-line rounded-lg p-2">
                  <p className="text-ink-subtle text-xs uppercase tracking-[0.2em]">Professional</p>
                  <p className="text-ink font-semibold">{rushee.professionalEvents}</p>
                </div>
                <div className="bg-surface/70 border border-line rounded-lg p-2">
                  <p className="text-ink-subtle text-xs uppercase tracking-[0.2em]">Interactions</p>
                  <p className="text-ink font-semibold">{rushee.interactions}</p>
                </div>
                <div className="bg-surface/70 border border-line rounded-lg p-2">
                  <p className="text-ink-subtle text-xs uppercase tracking-[0.2em]">Evals</p>
                  <p className="text-ink font-semibold">{rushee.evaluations}</p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3 mb-3">
                <div className="bg-inverse rounded-lg p-3 text-center">
                  <p className="text-on-inverse/70 text-xs font-semibold mb-1 uppercase tracking-[0.3em]">Avg Score</p>
                  <p className="text-2xl font-semibold text-on-inverse">{rushee.avgScore}</p>
                </div>
                <div className="bg-surface-alt border border-line rounded-lg p-3 text-center">
                  <p className="text-ink-subtle text-xs font-semibold mb-1 uppercase tracking-[0.3em]">App Score</p>
                  <p className="text-2xl font-semibold text-ink">{rushee.applicationScore ?? '—'}</p>
                </div>
              </div>

              {rushee.application ? (
                <button
                  onClick={(e) => {
                    e.stopPropagation()
                    setSelectedRushee(rushee.id)
                    setShowApplication(true)
                    setShowComments(false)
                  }}
                  className="w-full py-2 bg-inverse text-on-inverse text-sm rounded-lg font-semibold hover:bg-inverse-soft transition-colors"
                >
                  View Application
                </button>
              ) : (
                <div className="w-full py-2 bg-surface-sunken text-ink-faint text-sm rounded-lg font-semibold text-center">
                  No Application
                </div>
              )}
              </div>
            )
          })}
        </div>
        )}

        {/* Rushee Detail Modal */}
        {selectedRushee && selectedRusheeData && (
          <div className="fixed inset-0 bg-[var(--color-inverse-soft)]/70 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <div className="bg-surface border border-line rounded-2xl max-w-4xl w-full shadow-xl max-h-[90vh] flex flex-col">
              {/* Fixed Header */}
              <div className="flex-shrink-0 p-6 pb-4 border-b border-line">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                <div className="flex items-center">
                  <div className="w-20 h-20 sm:w-24 sm:h-24 mr-4 bg-surface-sunken rounded-2xl overflow-hidden flex items-center justify-center flex-shrink-0">
                    <RusheePhoto
                      photo={selectedRusheeData.photo}
                      alt={selectedRusheeData.name}
                      className="w-full h-full object-cover"
                      fallback={
                        <svg className="w-12 h-12 text-ink-faint" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                        </svg>
                      }
                    />
                  </div>
                  <div>
                    <h2 className="text-2xl font-semibold text-ink">{selectedRusheeData.name}</h2>
                    <p className="text-sm text-ink-muted">{selectedRusheeData.major} • {selectedRusheeData.year}</p>
                    <p className="text-sm text-ink-subtle">GPA: {selectedRusheeData.gpa}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2 self-end sm:self-auto">
                  <button
                    onClick={() => handleNavigateRushee('prev')}
                    disabled={!canNavigatePrev}
                    className={`px-3 py-2 rounded-lg text-sm font-semibold transition-colors ${
                      canNavigatePrev ? 'bg-surface-sunken text-ink hover:bg-line' : 'bg-surface-sunken text-ink-faint cursor-not-allowed'
                    }`}
                  >
                    ◀
                  </button>
                  <button
                    onClick={() => handleNavigateRushee('next')}
                    disabled={!canNavigateNext}
                    className={`px-3 py-2 rounded-lg text-sm font-semibold transition-colors ${
                      canNavigateNext ? 'bg-surface-sunken text-ink hover:bg-line' : 'bg-surface-sunken text-ink-faint cursor-not-allowed'
                    }`}
                  >
                    ▶
                  </button>
                  <button
                    onClick={async () => {
                      setShowGallery(true)
                      setShowComments(false)
                      setShowApplication(false)
                      await loadAttendancePhotos(selectedRusheeData.id)
                    }}
                    className="p-2 rounded-lg bg-surface-sunken text-ink hover:bg-line transition-colors"
                    title="View photo gallery"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                  </button>
                  <button
                    onClick={() => {
                      setSelectedRushee(null)
                      setShowApplication(false)
                      setShowComments(false)
                      setShowGallery(false)
                    }}
                    className="text-ink-muted hover:text-ink text-2xl px-2"
                  >
                    x
                  </button>
                </div>
              </div>
              </div>

              {/* Scrollable Content */}
              <div className="flex-1 overflow-y-auto p-6 pt-4">

              {showGallery ? (
                /* Gallery View */
                <>
                  <div className="mb-4">
                    <button
                      onClick={() => setShowGallery(false)}
                      className="flex items-center gap-2 text-ink-muted hover:text-ink transition-colors"
                    >
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                      </svg>
                      Back to Details
                    </button>
                  </div>

                  {loadingPhotos ? (
                    <div className="text-center py-12">
                      <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-ink mx-auto mb-4"></div>
                      <p className="text-ink-muted">Loading photos...</p>
                    </div>
                  ) : attendancePhotos.length === 0 ? (
                    <div className="text-center py-12">
                      <svg className="w-16 h-16 text-line-strong mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                      </svg>
                      <p className="text-ink-muted font-semibold mb-1">No attendance photos</p>
                      <p className="text-ink-subtle text-sm">This rushee hasn't checked in with photos yet</p>
                    </div>
                  ) : (
                    <div className="space-y-6">
                      <div className="flex items-center justify-between">
                        <h3 className="text-lg font-semibold text-ink">Attendance Photos</h3>
                        <span className="text-sm text-ink-subtle">{attendancePhotos.length} photo{attendancePhotos.length !== 1 ? 's' : ''}</span>
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        {attendancePhotos.map((photo: any, index: number) => (
                          <div key={index} className="bg-surface-alt border border-line rounded-2xl overflow-hidden">
                            <div className="aspect-square bg-surface-sunken flex items-center justify-center overflow-hidden">
                              <RusheePhoto
                                photo={photo.photo_url}
                                bucket="attendance-photos"
                                alt={`${photo.event?.title || 'Event'} attendance`}
                                className="w-full h-full object-cover"
                                fallback={<div className="w-full h-full flex items-center justify-center text-ink-faint text-sm">No photo</div>}
                              />
                            </div>
                            <div className="p-3">
                              <p className="text-ink font-semibold text-sm mb-1">
                                {photo.event?.title || 'Unknown Event'}
                              </p>
                              <p className="text-ink-subtle text-xs">
                                {photo.event?.date ? new Date(photo.event.date).toLocaleDateString('en-US', {
                                  month: 'short',
                                  day: 'numeric',
                                  year: 'numeric'
                                }) : 'Date unknown'}
                              </p>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </>
              ) : showComments ? (
                /* Comments View */
                <>
                  <div className="mb-4">
                    <button
                      onClick={() => setShowComments(false)}
                      className="flex items-center gap-2 text-ink-muted hover:text-ink transition-colors"
                    >
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                      </svg>
                      Back to Details
                    </button>
                  </div>

                  {loadingEvaluations ? (
                    <div className="text-center py-12">
                      <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-ink mx-auto mb-4"></div>
                      <p className="text-ink-muted">Loading comments...</p>
                    </div>
                  ) : evaluations.length === 0 ? (
                    <div className="text-center py-12">
                      <p className="text-ink-muted">No evaluation comments yet</p>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {evaluations.map((evaluation: any, index: number) => (
                        <div key={index} className="bg-surface-alt border border-line rounded-2xl p-4">
                          <div className="flex justify-between items-start mb-3">
                            <div className="flex gap-2">
                              {evaluation.professional_score > 0 && (
                                <span className="px-2 py-1 bg-line text-ink-muted text-xs rounded-full font-semibold">
                                  Professional: {evaluation.professional_score}/5
                                </span>
                              )}
                              {evaluation.personal_score > 0 && (
                                <span className="px-2 py-1 bg-line text-ink-muted text-xs rounded-full font-semibold">
                                  Personal: {evaluation.personal_score}/5
                                </span>
                              )}
                            </div>
                            <span className="text-xs text-ink-subtle">
                              {new Date(evaluation.created_at).toLocaleDateString()}
                            </span>
                          </div>
                          <p className="text-ink-muted whitespace-pre-wrap">
                            {evaluation.comments || 'No comment provided'}
                          </p>
                        </div>
                      ))}
                    </div>
                  )}
                </>
              ) : (
                /* Regular Details View */
                <>
              {/* Stats Grid */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
                <div className="bg-surface-alt border border-line rounded-xl p-3 text-center">
                  <p className="text-ink-subtle text-xs uppercase tracking-[0.2em] mb-1">Casual</p>
                  <p className="text-xl font-semibold text-ink">{selectedRusheeData.casualEvents}</p>
                </div>
                <div className="bg-surface-alt border border-line rounded-xl p-3 text-center">
                  <p className="text-ink-subtle text-xs uppercase tracking-[0.2em] mb-1">Professional</p>
                  <p className="text-xl font-semibold text-ink">{selectedRusheeData.professionalEvents}</p>
                </div>
                <div className="bg-surface-alt border border-line rounded-xl p-3 text-center">
                  <p className="text-ink-subtle text-xs uppercase tracking-[0.2em] mb-1">Interactions</p>
                  <p className="text-xl font-semibold text-ink">{selectedRusheeData.interactions}</p>
                </div>
                <div className="bg-surface-alt border border-line rounded-xl p-3 text-center">
                  <p className="text-ink-subtle text-xs uppercase tracking-[0.2em] mb-1">Evaluations</p>
                  <p className="text-xl font-semibold text-ink">{selectedRusheeData.evaluations}</p>
                </div>
              </div>

              {/* Average Score */}
              <button
                onClick={async () => {
                  setShowComments(true)
                  await loadEvaluations(selectedRusheeData.id)
                }}
                className="w-full bg-inverse rounded-2xl p-3 mb-6 text-center hover:bg-inverse-soft transition-colors cursor-pointer"
              >
                <p className="text-on-inverse/70 text-xs uppercase tracking-[0.35em] mb-1">Average Score</p>
                <p className="text-3xl font-semibold text-on-inverse">{selectedRusheeData.avgScore} / 5</p>
                <p className="text-on-inverse/50 text-xs mt-1">Click to view comments</p>
              </button>

              {/* Evaluation Summary */}
              {selectedRusheeData.evaluations > 0 && (
              <div className="bg-surface-alt border border-line rounded-2xl p-3 mb-4">
                <h3 className="text-ink font-semibold mb-2 text-sm">Evaluation Breakdown</h3>
                <div className="space-y-2">
                  <div className="flex justify-between items-center">
                    <span className="text-ink-muted text-sm">Professional Score</span>
                    <div className="flex items-center">
                      <div className="w-32 bg-line rounded-full h-2 mr-2">
                        <div className="bg-ink h-2 rounded-full" style={{ width: `${(selectedRusheeData.professionalAvg / 5) * 100}%` }}></div>
                      </div>
                      <span className="text-ink font-semibold text-sm">{selectedRusheeData.professionalAvg} / 5</span>
                    </div>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-ink-muted text-sm">Personal Score</span>
                    <div className="flex items-center">
                      <div className="w-32 bg-line rounded-full h-2 mr-2">
                        <div className="bg-ink h-2 rounded-full" style={{ width: `${(selectedRusheeData.personalAvg / 5) * 100}%` }}></div>
                      </div>
                      <span className="text-ink font-semibold text-sm">{selectedRusheeData.personalAvg} / 5</span>
                    </div>
                  </div>
                </div>
              </div>
              )}

              {selectedRusheeData.evaluations === 0 && (
                <div className="bg-surface-alt border border-line rounded-2xl p-3 mb-4 text-center">
                  <p className="text-ink-muted text-sm">No evaluations submitted yet</p>
                </div>
              )}

              {/* View Application Button */}
              {selectedRusheeData.application && (
                <>
                  <button
                    onClick={() => setShowApplication(!showApplication)}
                    className="w-full py-2.5 bg-inverse text-on-inverse rounded-lg font-semibold hover:bg-inverse-soft transition-colors mb-3 text-sm"
                  >
                    {showApplication ? 'Hide' : 'View'} Application
                  </button>

                  {/* Application Content */}
                  {showApplication && (
                    <div className="bg-surface-alt border border-line rounded-2xl p-4 space-y-3">
                      <div>
                        <p className="text-ink font-semibold text-sm mb-1">Legal Name</p>
                        <p className="text-ink-muted text-sm">{selectedRusheeData.application.legalName || 'Not specified'}</p>
                      </div>
                      <div>
                        <p className="text-ink font-semibold text-sm mb-1">Preferred Name</p>
                        <p className="text-ink-muted text-sm">{selectedRusheeData.application.preferredName || 'Not specified'}</p>
                      </div>
                      <div>
                        <p className="text-ink font-semibold text-sm mb-1">Pronouns</p>
                        <p className="text-ink-muted text-sm">{selectedRusheeData.application.pronouns || 'Not specified'}</p>
                      </div>
                      <div>
                        <p className="text-ink font-semibold text-sm mb-1">Phone Number</p>
                        <p className="text-ink-muted text-sm">{selectedRusheeData.application.phoneNumber || 'Not specified'}</p>
                      </div>
                      <div>
                        <p className="text-ink font-semibold text-sm mb-1">Email</p>
                        <p className="text-ink-muted text-sm">{selectedRusheeData.application.email || 'Not specified'}</p>
                      </div>
                      <div>
                        <p className="text-ink font-semibold text-sm mb-1">UF Address</p>
                        <p className="text-ink-muted text-sm">{selectedRusheeData.application.ufAddress || 'Not specified'}</p>
                      </div>
                      <div>
                        <p className="text-ink font-semibold text-sm mb-1">Major</p>
                        <p className="text-ink-muted text-sm">{selectedRusheeData.application.major || 'Not specified'}</p>
                      </div>
                      <div>
                        <p className="text-ink font-semibold text-sm mb-1">Minor</p>
                        <p className="text-ink-muted text-sm">{selectedRusheeData.application.minor || 'Not specified'}</p>
                      </div>
                      <div>
                        <p className="text-ink font-semibold text-sm mb-1">GPA</p>
                        <p className="text-ink-muted text-sm">{selectedRusheeData.application.gpa || 'Not specified'}</p>
                      </div>
                      <div>
                        <p className="text-ink font-semibold text-sm mb-1">Expected Graduation Date</p>
                        <p className="text-ink-muted text-sm">{selectedRusheeData.application.expectedGraduationDate || 'Not specified'}</p>
                      </div>
                      <div>
                        <p className="text-ink font-semibold text-sm mb-1">Resume</p>
                        {selectedRusheeData.application.resumeUrl ? (
                          <a
                            href={selectedRusheeData.application.resumeUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-ink text-sm hover:underline"
                          >
                            View Resume
                          </a>
                        ) : (
                          <p className="text-ink-muted text-sm">Not uploaded</p>
                        )}
                      </div>
                      <div>
                        <p className="text-ink font-semibold text-sm mb-1">1. Outside Involvements</p>
                        <p className="text-ink-muted text-sm">{selectedRusheeData.application.outsideInvolvements || 'Not answered'}</p>
                      </div>
                      <div>
                        <p className="text-ink font-semibold text-sm mb-1">2. How did you hear about Alpha Kappa Psi?</p>
                        <p className="text-ink-muted text-sm">{selectedRusheeData.application.howHeardAboutAkpsi || 'Not answered'}</p>
                      </div>
                      <div>
                        <p className="text-ink font-semibold text-sm mb-1">3. Why are you interested in becoming a member?</p>
                        <p className="text-ink-muted text-sm">{selectedRusheeData.application.whyInterested || 'Not answered'}</p>
                      </div>
                      <div>
                        <p className="text-ink font-semibold text-sm mb-1">4. Pillar Relation</p>
                        <p className="text-ink-muted text-sm">{selectedRusheeData.application.pillarRelation || 'Not answered'}</p>
                      </div>
                      <div>
                        <p className="text-ink font-semibold text-sm mb-1">5. Brother Connection</p>
                        <p className="text-ink-muted text-sm">{selectedRusheeData.application.brotherConnectionReason || 'Not answered'}</p>
                      </div>
                      <div>
                        <p className="text-ink font-semibold text-sm mb-1">6. Monopoly Piece</p>
                        <p className="text-ink-muted text-sm">{selectedRusheeData.application.monopolyPiece || 'Not answered'}</p>
                      </div>
                      <div>
                        <p className="text-ink font-semibold text-sm mb-1">7. Monopoly Theme Lesson</p>
                        <p className="text-ink-muted text-sm">{selectedRusheeData.application.monopolyThemeLesson || 'Not answered'}</p>
                      </div>
                    </div>
                  )}
                </>
              )}

              {!selectedRusheeData.application && (
                <div className="bg-surface-alt border border-line rounded-2xl p-3 text-center">
                  <p className="text-ink-muted text-sm">Application not yet submitted</p>
                </div>
              )}
                </>
              )}
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  )
}

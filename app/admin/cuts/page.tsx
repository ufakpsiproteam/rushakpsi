'use client'

import AdminNav from '@/components/admin/AdminNav'
import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import RusheePhoto from '@/components/RusheePhoto'
import { getRusheeResumeUrl } from '@/app/brother/cuts/actions'

type ColorStatus = 'normal' | 'green' | 'yellow' | 'red'

interface InterviewPanelistAnswer {
  question_id: string
  order_index: number
  prompt: string
  field_type: string
  score: number | null
  maxScore: number | null
  yes_no: boolean | null
  notes: string | null
}

interface InterviewPanelist {
  brother_id: string
  brother_name: string
  recommendation: number | null
  recommendation_notes: string | null
  knows_personally: boolean
  conflict_flagged_at: string | null
  answers: InterviewPanelistAnswer[]
}

interface InterviewBreakdownItem {
  type: 'casual' | 'professional'
  panelists: InterviewPanelist[]
}

type InterviewBreakdownData = InterviewBreakdownItem[]

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
  professionalInterviewScore: number | null
  professionalInterviewN: number
  casualInterviewScore: number | null
  casualInterviewN: number
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

export default function AdminCuts() {
  const [selectedRushee, setSelectedRushee] = useState<string | null>(null)
  const [showApplication, setShowApplication] = useState(false)
  const [showComments, setShowComments] = useState(false)
  const [evaluations, setEvaluations] = useState<any[]>([])
  const [loadingEvaluations, setLoadingEvaluations] = useState(false)
  const [interviewBreakdown, setInterviewBreakdown] = useState<InterviewBreakdownData | null>(null)
  const [loadingBreakdown, setLoadingBreakdown] = useState(false)
  const [showBreakdown, setShowBreakdown] = useState(false)

  // Load per-panelist interview breakdown whenever a rushee is selected
  useEffect(() => {
    setShowBreakdown(false)
    setInterviewBreakdown(null)
    if (selectedRushee) {
      loadInterviewBreakdown(selectedRushee)
    }
  }, [selectedRushee])
  const [colorStatuses, setColorStatuses] = useState<Record<string, ColorStatus>>({})
  const [rushees, setRushees] = useState<RusheeData[]>([])
  const [loading, setLoading] = useState(true)
  const [colorFilter, setColorFilter] = useState<ColorStatus | 'all'>('all')
  const [showStats, setShowStats] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [sortBy, setSortBy] = useState<'name' | 'rating'>('name')
  const [showFilters, setShowFilters] = useState(false)

  /**
   * R38 — review marks are per reviewer and stored server-side, so they
   * survive a device change and can be aggregated into a consensus view.
   *
   * They previously lived in localStorage under a single shared key,
   * which meant no reviewer could ever see another reviewer's marks (so
   * the consensus view the PRD specifies was impossible), and the marks
   * vanished if the browser was cleared or a different laptop was used.
   *
   * The green/yellow/red vocabulary in this UI maps onto the PRD's
   * strong_yes / maybe / no.
   */
  const MARK_TO_COLOR: Record<string, ColorStatus> = {
    strong_yes: 'green',
    maybe: 'yellow',
    no: 'red',
    undecided: 'normal',
  }
  const COLOR_TO_MARK: Record<string, string> = {
    green: 'strong_yes',
    yellow: 'maybe',
    red: 'no',
    normal: 'undecided',
  }

  useEffect(() => {
    async function loadMarks() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      const { data } = await supabase
        .from('review_marks')
        .select('rushee_id, mark')
        .eq('reviewer_id', user.id)

      if (!data) return

      const next: Record<string, ColorStatus> = {}
      for (const row of data as { rushee_id: string; mark: string }[]) {
        next[row.rushee_id] = MARK_TO_COLOR[row.mark] ?? 'normal'
      }
      setColorStatuses(next)
    }

    loadMarks()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const persistMark = async (rusheeId: string, status: ColorStatus) => {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      await (supabase as any).from('review_marks').upsert(
        {
          reviewer_id: user.id,
          rushee_id: rusheeId,
          mark: COLOR_TO_MARK[status] ?? 'undecided',
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'reviewer_id,rushee_id' }
      )
    } catch {
      // A failed mark write must not lose the reviewer's place in the
      // board; the local state stays and the next change retries.
    }
  }

  // Fetch rushees data
  useEffect(() => {
    async function fetchRusheesData() {
      try {
        // Fetch all rushees
        const { data: rusheesData } = await supabase
          .from('rushees')
          .select('*')
          .order('name')

        if (!rusheesData) {
          setLoading(false)
          return
        }

        // Interview averages + evidence counts (submitted assignments
        // only), COALESCEd against legacy rushees columns during the
        // transition — see v_rushee_board in 20260812_v_rushee_interviews.sql.
        const { data: boardData } = await supabase
          .from('v_rushee_board')
          .select('id, professional_interview_score, professional_interview_n, casual_interview_score, casual_interview_n')
        const boardById = new Map((boardData || []).map((b: any) => [b.id, b]))

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
            applicationScore: null, // Placeholder for future implementation
            professionalInterviewScore: boardById.get(rushee.id)?.professional_interview_score ?? null,
            professionalInterviewN: boardById.get(rushee.id)?.professional_interview_n ?? 0,
            casualInterviewScore: boardById.get(rushee.id)?.casual_interview_score ?? null,
            casualInterviewN: boardById.get(rushee.id)?.casual_interview_n ?? 0,
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
      } finally {
        setLoading(false)
      }
    }

    fetchRusheesData()
  }, [])

  const loadEvaluations = async (rusheeId: string) => {
    setLoadingEvaluations(true)
    setEvaluations([])
    try {
      const { data, error } = await supabase
        .from('evaluations')
        .select('comments, professional_score, personal_score, created_at, knows_personally')
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

  const loadInterviewBreakdown = async (rusheeId: string) => {
    setLoadingBreakdown(true)
    setInterviewBreakdown(null)
    try {
      // Fetch submitted assignments for this rushee, plus any assignment
      // that flagged a conflict — those stay 'pending' forever (the
      // panelist recuses instead of submitting), so a plain status filter
      // silently drops them and the conflict never reaches the review board.
      const { data: assignments } = await (supabase as any)
        .from('interview_assignments')
        .select(`
          interview_id, brother_id, recommendation, recommendation_notes, knows_personally, conflict_flagged_at,
          interviews!inner (type, status)
        `)
        .eq('rushee_id', rusheeId)
        .or('status.eq.submitted,conflict_flagged_at.not.is.null')

      if (!assignments || assignments.length === 0) {
        setInterviewBreakdown([])
        return
      }

      // Fetch all answers for this rushee across these assignments
      const { data: answers } = await (supabase as any)
        .from('interview_answers')
        .select('interview_id, brother_id, question_id, score, yes_no, notes')
        .eq('rushee_id', rusheeId)
        .in('interview_id', assignments.map((a: any) => a.interview_id))

      // Fetch question metadata
      const questionIds = [...new Set((answers ?? []).map((a: any) => a.question_id))]
      const { data: questions } = questionIds.length > 0
        ? await (supabase as any)
            .from('interview_questions')
            .select('id, order_index, prompt, field_type, score_options')
            .in('id', questionIds)
        : { data: [] }

      // Fetch brother names
      const brotherIds = [...new Set(assignments.map((a: any) => a.brother_id))]
      const { data: brothers } = await supabase
        .from('brothers')
        .select('id, name')
        .in('id', brotherIds)

      const brotherMap = new Map((brothers ?? []).map((b: any) => [b.id, b.name]))
      const questionMap = new Map<string, any>((questions ?? []).map((q: any) => [q.id, q]))

      // Group by interview type
      const byType = new Map<string, InterviewPanelist[]>()
      for (const ia of assignments) {
        const ivType = (ia as any).interviews?.type as string
        if (!byType.has(ivType)) byType.set(ivType, [])

        // Scope to this panelist's own answers only — mixing in the full
        // question list here previously showed every other interview
        // type's questions too (as blank "—" rows) since order_index
        // resets per type and collided across casual/professional.
        const panelAnswers: InterviewPanelistAnswer[] = (answers ?? [])
          .filter((a: any) => a.interview_id === ia.interview_id && a.brother_id === ia.brother_id)
          .map((a: any) => {
            const q = questionMap.get(a.question_id)
            const maxScore = q?.score_options?.length
              ? Math.max(...q.score_options.map((o: any) => o.value))
              : null
            return {
              question_id: a.question_id,
              order_index: q?.order_index ?? 0,
              prompt: q?.prompt ?? '',
              field_type: q?.field_type ?? 'score_notes',
              score: a.score,
              maxScore,
              yes_no: a.yes_no,
              notes: a.notes,
            }
          })
          .sort((a: any, b: any) => a.order_index - b.order_index)

        byType.get(ivType)!.push({
          brother_id: ia.brother_id,
          brother_name: brotherMap.get(ia.brother_id) ?? ia.brother_id,
          recommendation: (ia as any).recommendation,
          recommendation_notes: (ia as any).recommendation_notes,
          knows_personally: (ia as any).knows_personally,
          conflict_flagged_at: (ia as any).conflict_flagged_at,
          answers: panelAnswers,
        })
      }

      const result: InterviewBreakdownData = [...byType.entries()].map(([type, panelists]) => ({
        type: type as 'casual' | 'professional',
        panelists,
      }))

      setInterviewBreakdown(result)
    } catch (err) {
      console.error('Error loading interview breakdown:', err)
      setInterviewBreakdown([])
    } finally {
      setLoadingBreakdown(false)
    }
  }

  // R38 — Undecided → Strong Yes → Maybe → No → Undecided, saved
  // immediately, per reviewer.
  const toggleColorStatus = (rusheeId: string) => {
    const current = colorStatuses[rusheeId] || 'normal'
    const next: ColorStatus =
      current === 'normal' ? 'green' :
      current === 'green' ? 'yellow' :
      current === 'yellow' ? 'red' : 'normal'

    setColorStatuses(prev => ({ ...prev, [rusheeId]: next }))
    void persistMark(rusheeId, next)
  }

  const getColorClass = (status: ColorStatus) => {
    switch (status) {
      case 'green': return 'border-emerald-300 bg-emerald-50/60'
      case 'yellow': return 'border-amber-300 bg-amber-50/60'
      case 'red': return 'border-rose-300 bg-rose-50/60'
      default: return 'border-line bg-white'
    }
  }

  const getColorIndicator = (status: ColorStatus) => {
    const colorClass =
      status === 'green'
        ? 'bg-emerald-500'
        : status === 'yellow'
        ? 'bg-amber-400'
        : status === 'red'
        ? 'bg-rose-500'
        : 'bg-line-strong'
    return <span className={`inline-block h-3 w-3 rounded-full ${colorClass}`} />
  }

  const copyResultsToClipboard = () => {
    const greenRushees = rushees.filter(r => colorStatuses[r.id] === 'green')
    const yellowRushees = rushees.filter(r => colorStatuses[r.id] === 'yellow')
    const redRushees = rushees.filter(r => colorStatuses[r.id] === 'red')

    const result = `CUTS RESULTS
================

🟢 GREEN (${greenRushees.length}):
${greenRushees.map(r => `  • ${r.name}`).join('\n') || '  (none)'}

🟡 YELLOW (${yellowRushees.length}):
${yellowRushees.map(r => `  • ${r.name}`).join('\n') || '  (none)'}

🔴 RED (${redRushees.length}):
${redRushees.map(r => `  • ${r.name}`).join('\n') || '  (none)'}`

    navigator.clipboard.writeText(result).then(() => {
      alert('Results copied to clipboard!')
    }).catch(() => {
      alert('Failed to copy to clipboard')
    })
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

  // Then filter by color status
  const colorFiltered = searchFilteredRushees.filter(r => {
    if (colorFilter === 'all') return true

    const status = colorStatuses[r.id] || 'normal'
    return status === colorFilter
  })

  // Finally, sort the results
  const filteredRushees = [...colorFiltered].sort((a, b) => {
    if (sortBy === 'rating') {
      // Sort by avgScore descending (highest first)
      return b.avgScore - a.avgScore
    } else {
      // Sort by name alphabetically
      return a.name.localeCompare(b.name)
    }
  })

  // Calculate counts after all filters for color buttons
  const getColorCount = (color: ColorStatus | 'normal' | 'all') => {
    if (color === 'all') return searchFilteredRushees.length
    return searchFilteredRushees.filter(r => {
      const status = colorStatuses[r.id] || 'normal'
      return status === color
    }).length
  }

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
  }

  // Calculate statistics for green pledges
  const greenRushees = rushees.filter(r => colorStatuses[r.id] === 'green')

  const calculateStats = () => {
    if (greenRushees.length === 0) {
      return {
        total: 0,
        yearBreakdown: {},
        majorBreakdown: {},
        avgGPA: 0
      }
    }

    // Year breakdown
    const yearBreakdown: Record<string, number> = {}
    greenRushees.forEach(r => {
      yearBreakdown[r.year] = (yearBreakdown[r.year] || 0) + 1
    })

    // Major breakdown
    const majorBreakdown: Record<string, number> = {}
    greenRushees.forEach(r => {
      majorBreakdown[r.major] = (majorBreakdown[r.major] || 0) + 1
    })

    // Average GPA (filter out N/A)
    const validGPAs = greenRushees
      .map(r => parseFloat(r.gpa))
      .filter(gpa => !isNaN(gpa))
    const avgGPA = validGPAs.length > 0
      ? validGPAs.reduce((sum, gpa) => sum + gpa, 0) / validGPAs.length
      : 0

    return {
      total: greenRushees.length,
      yearBreakdown,
      majorBreakdown,
      avgGPA: Number(avgGPA.toFixed(2))
    }
  }

  const stats = calculateStats()

  return (
    <div className="min-h-screen bg-canvas">
      <AdminNav />

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between mb-8">
          <div>
            <p className="text-xs uppercase tracking-[0.35em] text-ink-subtle">Admin Cuts</p>
            <h1 className="mt-2 text-3xl font-semibold text-ink">Cuts Review</h1>
            <p className="mt-2 text-sm text-ink-muted">Click the status dot to cycle: Undecided → Strong Yes → Maybe → No.</p>
          </div>
          <button
            onClick={copyResultsToClipboard}
            className="px-6 py-3 bg-ink text-white rounded-lg font-semibold hover:bg-inverse-soft transition-colors"
          >
            Copy Results
          </button>
        </div>

        {/* Search Bar and Filters */}
        {!loading && rushees.length > 0 && (
          <div className="mb-6 space-y-4">
            {/* Search Bar */}
            <div className="relative">
              <input
                type="text"
                placeholder="Search by name, major, or year..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full px-4 py-3 pl-11 bg-white border border-line rounded-lg text-ink placeholder-ink-faint focus:ring-2 focus:ring-ink focus:border-transparent"
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
            <div className="bg-white border border-line rounded-lg">
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
                      className="w-full px-3 py-2 bg-white border border-line rounded-lg text-ink focus:ring-2 focus:ring-ink focus:border-transparent"
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

        {/* Loading State */}
        {loading && (
          <div className="text-center py-12">
            <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-ink"></div>
            <p className="mt-4 text-ink-muted">Loading rushees data...</p>
          </div>
        )}

        {!loading && rushees.length === 0 && (
          <div className="text-center py-12">
            <p className="text-ink-muted">No rushees found</p>
          </div>
        )}

        {/* Color Filters */}
        {!loading && rushees.length > 0 && (
          <div className="flex gap-2 mb-6 flex-wrap">
            <button
              onClick={() => setColorFilter('all')}
              className={`px-4 py-2 rounded-lg font-semibold transition-colors ${
                colorFilter === 'all'
                  ? 'bg-ink text-white'
                  : 'bg-white border border-line text-ink-muted hover:bg-surface-alt'
              }`}
            >
              All ({getColorCount('all')})
            </button>
            <button
              onClick={() => setColorFilter('green')}
              className={`px-4 py-2 rounded-lg font-semibold transition-colors ${
                colorFilter === 'green'
                  ? 'bg-emerald-600 text-white'
                  : 'bg-emerald-50 border border-emerald-200 text-emerald-700 hover:bg-emerald-100'
              }`}
            >
              <span className="inline-flex items-center gap-2">
                <span className="h-2.5 w-2.5 rounded-full bg-emerald-500" />
                Strong Yes ({getColorCount('green')})
              </span>
            </button>
            <button
              onClick={() => setColorFilter('yellow')}
              className={`px-4 py-2 rounded-lg font-semibold transition-colors ${
                colorFilter === 'yellow'
                  ? 'bg-amber-500 text-white'
                  : 'bg-amber-50 border border-amber-200 text-amber-700 hover:bg-amber-100'
              }`}
            >
              <span className="inline-flex items-center gap-2">
                <span className="h-2.5 w-2.5 rounded-full bg-amber-400" />
                Maybe ({getColorCount('yellow')})
              </span>
            </button>
            <button
              onClick={() => setColorFilter('red')}
              className={`px-4 py-2 rounded-lg font-semibold transition-colors ${
                colorFilter === 'red'
                  ? 'bg-rose-600 text-white'
                  : 'bg-rose-50 border border-rose-200 text-rose-700 hover:bg-rose-100'
              }`}
            >
              <span className="inline-flex items-center gap-2">
                <span className="h-2.5 w-2.5 rounded-full bg-rose-500" />
                No ({getColorCount('red')})
              </span>
            </button>
            <button
              onClick={() => setColorFilter('normal')}
              className={`px-4 py-2 rounded-lg font-semibold transition-colors ${
                colorFilter === 'normal'
                  ? 'bg-ink-muted text-white'
                  : 'bg-white border border-line text-ink-muted hover:bg-surface-alt'
              }`}
            >
              <span className="inline-flex items-center gap-2">
                <span className="h-2.5 w-2.5 rounded-full bg-line-strong" />
                Undecided ({getColorCount('normal')})
              </span>
            </button>
          </div>
        )}

        {/* Summary Counts */}
        {!loading && rushees.length > 0 && (
        <>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-4 text-center shadow-sm">
            <div className="flex items-center justify-center gap-2 text-emerald-700 text-xs uppercase tracking-[0.2em] mb-2">
              <span className="h-2.5 w-2.5 rounded-full bg-emerald-500" />
              Strong Yes
            </div>
            <div className="text-2xl font-semibold text-ink">
              {rushees.filter(r => colorStatuses[r.id] === 'green').length}
            </div>
          </div>
          <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 text-center shadow-sm">
            <div className="flex items-center justify-center gap-2 text-amber-700 text-xs uppercase tracking-[0.2em] mb-2">
              <span className="h-2.5 w-2.5 rounded-full bg-amber-400" />
              Maybe
            </div>
            <div className="text-2xl font-semibold text-ink">
              {rushees.filter(r => colorStatuses[r.id] === 'yellow').length}
            </div>
          </div>
          <div className="bg-rose-50 border border-rose-200 rounded-2xl p-4 text-center shadow-sm">
            <div className="flex items-center justify-center gap-2 text-rose-700 text-xs uppercase tracking-[0.2em] mb-2">
              <span className="h-2.5 w-2.5 rounded-full bg-rose-500" />
              No
            </div>
            <div className="text-2xl font-semibold text-ink">
              {rushees.filter(r => colorStatuses[r.id] === 'red').length}
            </div>
          </div>
          <div className="bg-white border border-line rounded-2xl p-4 text-center shadow-sm">
            <div className="flex items-center justify-center gap-2 text-ink-subtle text-xs uppercase tracking-[0.2em] mb-2">
              <span className="h-2.5 w-2.5 rounded-full bg-line-strong" />
              Undecided
            </div>
            <div className="text-2xl font-semibold text-ink">
              {rushees.filter(r => !colorStatuses[r.id] || colorStatuses[r.id] === 'normal').length}
            </div>
          </div>
        </div>

        {/* No Results Message */}
        {filteredRushees.length === 0 && (
          <div className="text-center py-12">
            <p className="text-ink-muted">No rushees found matching your filters</p>
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
            const status = colorStatuses[rushee.id] || 'normal'
            return (
              <div
                key={rushee.id}
                className={`border rounded-2xl p-5 transition-colors cursor-pointer relative shadow-sm ${getColorClass(status)}`}
              >
              {/* Color indicator in top right */}
              <div className="absolute top-3 right-3">
                <button
                  onClick={(e) => {
                    e.stopPropagation()
                    toggleColorStatus(rushee.id)
                  }}
                  className="h-9 w-9 rounded-full bg-white border border-line shadow-sm flex items-center justify-center hover:scale-105 transition-transform"
                  title="Click to cycle status"
                >
                  {getColorIndicator(status)}
                </button>
              </div>

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
                <div className="bg-white/70 border border-line rounded-lg p-2">
                  <p className="text-ink-subtle text-xs uppercase tracking-[0.2em]">Casual</p>
                  <p className="text-ink font-semibold">{rushee.casualEvents}</p>
                </div>
                <div className="bg-white/70 border border-line rounded-lg p-2">
                  <p className="text-ink-subtle text-xs uppercase tracking-[0.2em]">Professional</p>
                  <p className="text-ink font-semibold">{rushee.professionalEvents}</p>
                </div>
                <div className="bg-white/70 border border-line rounded-lg p-2">
                  <p className="text-ink-subtle text-xs uppercase tracking-[0.2em]">Interactions</p>
                  <p className="text-ink font-semibold">{rushee.interactions}</p>
                </div>
                <div className="bg-white/70 border border-line rounded-lg p-2">
                  <p className="text-ink-subtle text-xs uppercase tracking-[0.2em]">Evals</p>
                  <p className="text-ink font-semibold">{rushee.evaluations}</p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3 mb-3">
                <div className="bg-ink rounded-lg p-3 text-center">
                  <p className="text-white/70 text-xs font-semibold mb-1 uppercase tracking-[0.3em]">Avg Score</p>
                  <p className="text-2xl font-semibold text-white">{rushee.avgScore}</p>
                </div>
                <div className="bg-surface-alt border border-line rounded-lg p-3 text-center">
                  <p className="text-ink-subtle text-xs font-semibold mb-1 uppercase tracking-[0.3em]">App Score</p>
                  <p className="text-2xl font-semibold text-ink">{rushee.applicationScore ?? '—'}</p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3 mb-3">
                <div className="bg-surface-alt border border-line rounded-lg p-3 text-center">
                  <p className="text-ink-subtle text-xs font-semibold mb-1 uppercase tracking-[0.3em]">Casual Interview</p>
                  <p className="text-2xl font-semibold text-ink">
                    {rushee.casualInterviewScore !== null ? `${rushee.casualInterviewScore} / 10` : '—'}
                  </p>
                  {rushee.casualInterviewN > 0 && (
                    <p className="text-ink-subtle text-xs mt-1">n={rushee.casualInterviewN}</p>
                  )}
                </div>
                <div className="bg-surface-alt border border-line rounded-lg p-3 text-center">
                  <p className="text-ink-subtle text-xs font-semibold mb-1 uppercase tracking-[0.3em]">Professional Interview</p>
                  <p className="text-2xl font-semibold text-ink">
                    {rushee.professionalInterviewScore !== null ? `${rushee.professionalInterviewScore} / 20` : '—'}
                  </p>
                  {rushee.professionalInterviewN > 0 && (
                    <p className="text-ink-subtle text-xs mt-1">n={rushee.professionalInterviewN}</p>
                  )}
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
                  className="w-full py-2 bg-ink text-white text-sm rounded-lg font-semibold hover:bg-inverse-soft transition-colors"
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
        </>
        )}

        {/* Rushee Detail Modal */}
        {selectedRushee && selectedRusheeData && (
          <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <div className="bg-white border border-line rounded-2xl max-w-4xl w-full shadow-xl max-h-[90vh] flex flex-col">
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
                    onClick={() => {
                      setSelectedRushee(null)
                      setShowApplication(false)
                      setShowComments(false)
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

              {showComments ? (
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
                          {evaluation.knows_personally && (
                            <div className="flex justify-end mt-2">
                              <span className="badge badge-warning">Knows rushee personally</span>
                            </div>
                          )}
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
                className="w-full bg-ink rounded-2xl p-3 mb-6 text-center hover:bg-inverse-soft transition-colors cursor-pointer"
              >
                <p className="text-white/70 text-xs uppercase tracking-[0.35em] mb-1">Average Score</p>
                <p className="text-3xl font-semibold text-white">{selectedRusheeData.avgScore} / 5</p>
                <p className="text-white/50 text-xs mt-1">Click to view comments</p>
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

              {/* Interview Recommendation */}
              {loadingBreakdown && (
                <div className="bg-surface-alt border border-line rounded-2xl p-3 mb-4 text-center">
                  <p className="text-ink-muted text-sm">Loading interview data…</p>
                </div>
              )}
              {!loadingBreakdown && interviewBreakdown && interviewBreakdown.length > 0 && (
                <div className="bg-surface-alt border border-line rounded-2xl p-3 mb-4">
                  <h3 className="text-ink font-semibold mb-2 text-sm">Interview Recommendation</h3>
                  <div className="space-y-2">
                    {(['casual', 'professional'] as const).map(type => {
                      const group = interviewBreakdown.find(g => g.type === type)
                      if (!group || group.panelists.length === 0) return null
                      const recs = group.panelists
                        .map(p => p.recommendation)
                        .filter((r): r is number => r !== null)
                      const avg = recs.length > 0 ? recs.reduce((a, b) => a + b, 0) / recs.length : 0
                      return (
                        <div key={type} className="flex justify-between items-center">
                          <span className="text-ink-muted text-sm capitalize">{type} Interview</span>
                          <div className="flex items-center">
                            <div className="w-32 bg-line rounded-full h-2 mr-2">
                              <div className="bg-ink h-2 rounded-full" style={{ width: `${(avg / 5) * 100}%` }}></div>
                            </div>
                            <span className="text-ink font-semibold text-sm">{avg.toFixed(1)} / 5</span>
                          </div>
                        </div>
                      )
                    })}
                  </div>

                  <button
                    onClick={() => setShowBreakdown(!showBreakdown)}
                    className="mt-3 w-full text-left text-xs font-semibold text-ink-subtle uppercase tracking-[0.3em] flex items-center justify-between py-1"
                  >
                    <span>Show Interview</span>
                    <span>{showBreakdown ? '▲' : '▼'}</span>
                  </button>

                  {showBreakdown && (
                    <div className="mt-2 space-y-4">
                      {interviewBreakdown.map(group => (
                        <div key={group.type}>
                          <p className="text-xs font-semibold text-ink-subtle uppercase tracking-widest mb-1 capitalize">
                            {group.type}
                          </p>
                          {group.panelists.map(panelist => {
                            const scored = panelist.answers.filter(a => a.field_type !== 'yes_no' && a.maxScore !== null)
                            const scoreTotal = scored.reduce((sum, a) => sum + (a.score ?? 0), 0)
                            const scoreMax = scored.reduce((sum, a) => sum + (a.maxScore ?? 0), 0)
                            return (
                            <div key={panelist.brother_id} className="bg-surface border border-line rounded-lg p-3 mb-2">
                              <div className="flex items-start justify-between mb-1">
                                <p className="text-sm font-medium text-ink">{panelist.brother_name}</p>
                                <div className="flex flex-col items-end gap-1">
                                  {panelist.recommendation !== null && (
                                    <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full">
                                      Rec: {panelist.recommendation}/5
                                    </span>
                                  )}
                                  {scoreMax > 0 && (
                                    <span className="text-xs bg-purple-100 text-purple-700 px-2 py-0.5 rounded-full">
                                      Score: {scoreTotal}/{scoreMax}
                                    </span>
                                  )}
                                  {panelist.conflict_flagged_at && (
                                    <span className="text-xs bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full">
                                      Conflict flagged
                                    </span>
                                  )}
                                </div>
                              </div>
                              {panelist.knows_personally && (
                                <p className="text-xs text-amber-600 mb-1">Knows personally</p>
                              )}
                              {panelist.recommendation_notes && (
                                <p className="text-xs text-ink-subtle italic mb-2">&ldquo;{panelist.recommendation_notes}&rdquo;</p>
                              )}
                              <div className="space-y-1">
                                {panelist.answers.map(ans => (
                                  <div key={ans.question_id} className="text-xs">
                                    <span className="text-ink-subtle">Q{ans.order_index} - </span>
                                    {ans.field_type === 'yes_no' ? (
                                      <span className={ans.yes_no ? 'text-green-600' : 'text-red-600'}>
                                        {ans.yes_no === null ? '—' : ans.yes_no ? 'Yes' : 'No'}
                                      </span>
                                    ) : (
                                      <span className="text-ink font-medium">
                                        {ans.score ?? '—'}{ans.maxScore ? `/${ans.maxScore}` : ''}
                                      </span>
                                    )}
                                    {ans.notes && (
                                      <span className="text-ink-subtle ml-1">- {ans.notes}</span>
                                    )}
                                  </div>
                                ))}
                              </div>
                            </div>
                          )})}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
              {!loadingBreakdown && interviewBreakdown && interviewBreakdown.length === 0 && (
                <div className="bg-surface-alt border border-line rounded-2xl p-3 mb-4 text-center">
                  <p className="text-ink-muted text-sm">No interviews submitted yet</p>
                </div>
              )}

              {/* View Application Button */}
              {selectedRusheeData.application && (
                <>
                  <button
                    onClick={() => setShowApplication(!showApplication)}
                    className="w-full py-2.5 bg-ink text-white rounded-lg font-semibold hover:bg-inverse-soft transition-colors mb-3 text-sm"
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
                          <button
                            type="button"
                            onClick={async () => {
                              const { url, error } = await getRusheeResumeUrl(selectedRusheeData.id)
                              if (url) {
                                window.open(url, '_blank', 'noopener,noreferrer')
                              } else {
                                alert(error || 'Could not open resume.')
                              }
                            }}
                            className="text-ink text-sm hover:underline"
                          >
                            View Resume
                          </button>
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

        {/* Floating Statistics Button */}
        {!loading && greenRushees.length > 0 && (
          <button
            onClick={() => setShowStats(true)}
            className="fixed bottom-8 right-8 w-16 h-16 bg-emerald-600 text-white rounded-full shadow-lg hover:bg-emerald-700 transition-all hover:scale-110 flex items-center justify-center z-40"
            title="View Green Pledge Statistics"
          >
            <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
            </svg>
          </button>
        )}

        {/* Statistics Modal */}
        {showStats && (
          <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <div className="bg-white border border-line rounded-2xl p-6 max-w-2xl w-full shadow-xl">
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-2xl font-semibold text-ink">Green Pledge Class Statistics</h2>
                <button
                  onClick={() => setShowStats(false)}
                  className="text-ink-muted hover:text-ink text-2xl"
                >
                  x
                </button>
              </div>

              <div className="space-y-6">
                {/* Total Count */}
                <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-4 text-center">
                  <p className="text-emerald-700 font-semibold mb-1">Total Green Pledges</p>
                  <p className="text-4xl font-semibold text-ink">{stats.total}</p>
                </div>

                {/* Average GPA */}
                <div className="bg-surface-alt border border-line rounded-2xl p-4">
                  <p className="text-ink font-semibold mb-2">Average GPA</p>
                  <p className="text-3xl font-semibold text-ink">{stats.avgGPA > 0 ? stats.avgGPA.toFixed(2) : 'N/A'}</p>
                </div>

                {/* Year Breakdown */}
                <div className="bg-surface-alt border border-line rounded-2xl p-4">
                  <p className="text-ink font-semibold mb-3">Year Breakdown</p>
                  <div className="space-y-2">
                    {Object.entries(stats.yearBreakdown).map(([year, count]) => (
                      <div key={year} className="flex justify-between items-center">
                        <span className="text-ink-muted">{year}</span>
                        <div className="flex items-center gap-2">
                          <div className="w-32 bg-line rounded-full h-2">
                            <div
                              className="bg-emerald-600 h-2 rounded-full"
                              style={{ width: `${(count / stats.total) * 100}%` }}
                            ></div>
                          </div>
                          <span className="text-ink font-semibold text-sm w-16">
                            {count} ({((count / stats.total) * 100).toFixed(0)}%)
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Major Breakdown */}
                <div className="bg-surface-alt border border-line rounded-2xl p-4">
                  <p className="text-ink font-semibold mb-3">Major Breakdown</p>
                  <div className="space-y-2 max-h-64 overflow-y-auto">
                    {Object.entries(stats.majorBreakdown)
                      .sort((a, b) => b[1] - a[1])
                      .map(([major, count]) => (
                        <div key={major} className="flex justify-between items-center">
                          <span className="text-ink-muted text-sm">{major}</span>
                          <div className="flex items-center gap-2">
                            <div className="w-24 bg-line rounded-full h-2">
                              <div
                                className="bg-ink h-2 rounded-full"
                                style={{ width: `${(count / stats.total) * 100}%` }}
                              ></div>
                            </div>
                            <span className="text-ink font-semibold text-sm w-16">
                              {count} ({((count / stats.total) * 100).toFixed(0)}%)
                            </span>
                          </div>
                        </div>
                      ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  )
}

'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/contexts/AuthContext'
import TypewriterText from '@/components/TypewriterText'
import { isRejected } from '@/lib/policy'
import { resolvePhotoUrl } from '@/lib/resolvePhotoUrl'
import RusheePhoto from '@/components/RusheePhoto'

interface RusheeData {
  id: string
  name: string
  major: string
  year: string
  gpa: string
  photo: string | null
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
  professionalRecommendation: number | null
  professionalOptionScore: number | null
  casualInterviewScore: number | null
  casualInterviewN: number
  casualRecommendation: number | null
  professionalInterviewComment: string | null
  casualInterviewComment: string | null
  aiSummary: string | null
  inviteOnly: boolean | null
  bidStatus: boolean | null
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

interface Evaluation {
  comments: string
  professional_score: number
  personal_score: number
  created_at: string
}

export default function RusheeSlidesPresentation() {
  const { profile } = useAuth()
  const [rushees, setRushees] = useState<RusheeData[]>([])
  const [loading, setLoading] = useState(true)
  const [currentIndex, setCurrentIndex] = useState(0)
  const [searchQuery, setSearchQuery] = useState('')
  const [showSearch, setShowSearch] = useState(false)
  const [evaluations, setEvaluations] = useState<Evaluation[]>([])
  const [loadingEvaluations, setLoadingEvaluations] = useState(false)
  const [attendancePhotos, setAttendancePhotos] = useState<any[]>([])
  const [showGallery, setShowGallery] = useState(false)
  const [loadingPhotos, setLoadingPhotos] = useState(false)
  const [generatingSummary, setGeneratingSummary] = useState(false)
  const [showTypewriter, setShowTypewriter] = useState(false)
  const [showSummaryMenu, setShowSummaryMenu] = useState(false)

  useEffect(() => {
    fetchRusheesData()
  }, [])

  // Keyboard navigation
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'ArrowLeft') {
        e.preventDefault()
        navigatePrev()
      } else if (e.key === 'ArrowRight') {
        e.preventDefault()
        navigateNext()
      } else if ((e.metaKey || e.ctrlKey) && e.key === 'f') {
        e.preventDefault()
        setShowSearch(!showSearch)
      } else if (e.key === 'Escape') {
        setShowSearch(false)
        setSearchQuery('')
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [currentIndex, rushees.length, showSearch])

  // Load evaluations when rushee changes
  useEffect(() => {
    if (rushees[currentIndex]) {
      loadEvaluations(rushees[currentIndex].id)
      // Trigger typewriter animation if AI summary exists
      if (rushees[currentIndex].aiSummary) {
        setShowTypewriter(true)
      } else {
        setShowTypewriter(false)
      }
      // Close menu when switching slides
      setShowSummaryMenu(false)
    }
  }, [currentIndex, rushees])

  // Close menu when clicking outside
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (showSummaryMenu) {
        const target = e.target as HTMLElement
        if (!target.closest('.summary-menu-container')) {
          setShowSummaryMenu(false)
        }
      }
    }

    document.addEventListener('click', handleClickOutside)
    return () => document.removeEventListener('click', handleClickOutside)
  }, [showSummaryMenu])

  async function fetchRusheesData() {
    try {
      // Fetch all rushees with interview data and AI summary
      const { data: rusheesData } = await supabase
        .from('rushees')
        .select('*, ai_summary')
        .order('name')

      if (!rusheesData) return

      // Interview averages + evidence counts (submitted assignments
      // only) from the new interview tables, COALESCEd against the
      // legacy rushees columns during the transition — see
      // v_rushee_board in 20260812_v_rushee_interviews.sql.
      const { data: boardData } = await supabase
        .from('v_rushee_board')
        .select('id, professional_interview_score, professional_interview_n, professional_recommendation, casual_interview_score, casual_interview_n, casual_recommendation')
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

      // Fetch all applications
      const { data: applicationsData } = await supabase
        .from('applications')
        .select('*')

      // Process data for each rushee
      const processedRushees: RusheeData[] = rusheesData.map((rushee: any) => {
        const rusheeAttendance = attendanceData?.filter((a: any) => a.rushee_id === rushee.id) || []
        const casualEvents = rusheeAttendance.filter((a: any) => a.event?.type === 'Casual').length
        const professionalEvents = rusheeAttendance.filter((a: any) => a.event?.type === 'Professional').length

        const rusheeEvals = evaluationsData?.filter((e: any) => e.rushee_id === rushee.id) || []
        const evaluationCount = rusheeEvals.length

        let avgProfessional = 0
        let avgPersonal = 0
        let avgOverall = 0

        if (evaluationCount > 0) {
          const professionalScores = rusheeEvals
            .map((e: any) => e.professional_score)
            .filter((score: any) => score != null && score > 0)
          const personalScores = rusheeEvals
            .map((e: any) => e.personal_score)
            .filter((score: any) => score != null && score > 0)

          if (professionalScores.length > 0) {
            avgProfessional = professionalScores.reduce((sum: number, score: number) => sum + score, 0) / professionalScores.length
          }
          if (personalScores.length > 0) {
            avgPersonal = personalScores.reduce((sum: number, score: number) => sum + score, 0) / personalScores.length
          }

          const allScores = [...professionalScores, ...personalScores]
          if (allScores.length > 0) {
            avgOverall = allScores.reduce((sum: number, score: number) => sum + score, 0) / allScores.length
          }
        }

        const application: any = applicationsData?.find((a: any) => a.rushee_id === rushee.id)

        return {
          id: rushee.id,
          name: rushee.name || 'Unknown',
          major: rushee.major || 'Undeclared',
          year: rushee.year || 'Unknown',
          gpa: rushee.gpa || 'N/A',
          photo: rushee.photo,
          casualEvents,
          professionalEvents,
          interactions: evaluationCount,
          evaluations: evaluationCount,
          avgScore: Number(avgOverall.toFixed(1)),
          professionalAvg: Number(avgProfessional.toFixed(1)),
          personalAvg: Number(avgPersonal.toFixed(1)),
          applicationScore: null,
          professionalInterviewScore: boardById.get(rushee.id)?.professional_interview_score ?? null,
          professionalInterviewN: boardById.get(rushee.id)?.professional_interview_n ?? 0,
          professionalRecommendation: boardById.get(rushee.id)?.professional_recommendation ?? null,
          professionalOptionScore: null,
          casualInterviewScore: boardById.get(rushee.id)?.casual_interview_score ?? null,
          casualInterviewN: boardById.get(rushee.id)?.casual_interview_n ?? 0,
          casualRecommendation: boardById.get(rushee.id)?.casual_recommendation ?? null,
          professionalInterviewComment: null,
          casualInterviewComment: null,
          aiSummary: rushee.ai_summary,
          inviteOnly: rushee.invite_only ?? null,
          bidStatus: rushee.bid_status ?? null,
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

      // R39 — the deck excludes every published rejection. This
      // previously filtered only Invite Only (N), so a rushee rejected at
      // bid night reappeared whenever the deck was reopened.
      const filteredRushees = processedRushees.filter(
        (rushee) => !isRejected({ inviteOnly: rushee.inviteOnly, bidStatus: rushee.bidStatus })
      )

      setRushees(filteredRushees)
    } catch (error) {
      console.error('Error fetching rushees data:', error)
    } finally {
      setLoading(false)
    }
  }

  async function loadEvaluations(rusheeId: string) {
    setLoadingEvaluations(true)
    try {
      const { data } = await supabase
        .from('evaluations')
        .select('comments, professional_score, personal_score, created_at')
        .eq('rushee_id', rusheeId)
        .order('created_at', { ascending: false })

      setEvaluations(data || [])
    } catch (error) {
      console.error('Error loading evaluations:', error)
    } finally {
      setLoadingEvaluations(false)
    }
  }

  async function loadAttendancePhotos(rusheeId: string) {
    setLoadingPhotos(true)
    try {
      const { data } = await supabase
        .from('event_attendance')
        .select('photo_url, event:events(title, date), created_at')
        .eq('rushee_id', rusheeId)
        .not('photo_url', 'is', null)
        .order('created_at', { ascending: false })

      setAttendancePhotos(data || [])
    } catch (error) {
      console.error('Error loading attendance photos:', error)
    } finally {
      setLoadingPhotos(false)
    }
  }

  async function generateAISummary(rusheeId: string) {
    setGeneratingSummary(true)
    setShowTypewriter(false)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) {
        throw new Error('Not authenticated')
      }

      const response = await fetch('/api/rushees/generate-summary', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`
        },
        body: JSON.stringify({ rusheeId }),
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Failed to generate summary')
      }

      const { summary } = await response.json()

      // Update the current rushee in state
      setRushees(prev => prev.map(r =>
        r.id === rusheeId ? { ...r, aiSummary: summary } : r
      ))

      // Show typewriter effect
      setShowTypewriter(true)
    } catch (error) {
      console.error('Error generating AI summary:', error)
      alert(`Failed to generate AI summary: ${error instanceof Error ? error.message : 'Unknown error'}`)
    } finally {
      setGeneratingSummary(false)
    }
  }

  async function exportToPDF() {
    try {
      // Loaded on demand instead of at module scope — jspdf +
      // jspdf-autotable otherwise ship in this page's initial JS bundle
      // even though they're only needed once someone clicks Export PDF.
      const [{ default: jsPDF }, { default: autoTable }] = await Promise.all([
        import('jspdf'),
        import('jspdf-autotable'),
      ])

      const doc = new jsPDF('portrait', 'mm', 'a4')
      const pageWidth = doc.internal.pageSize.getWidth()
      const pageHeight = doc.internal.pageSize.getHeight()
      const margin = 15

      // Helper function to convert image URL to base64 and get dimensions
      const getImageData = async (url: string): Promise<{ data: string; width: number; height: number } | null> => {
        try {
          const response = await fetch(url)
          const blob = await response.blob()
          const base64 = await new Promise<string>((resolve, reject) => {
            const reader = new FileReader()
            reader.onloadend = () => resolve(reader.result as string)
            reader.onerror = reject
            reader.readAsDataURL(blob)
          })

          // Get image dimensions
          const img = new Image()
          await new Promise((resolve, reject) => {
            img.onload = resolve
            img.onerror = reject
            img.src = base64
          })

          return {
            data: base64,
            width: img.width,
            height: img.height
          }
        } catch (error) {
          console.error('Error loading image:', error)
          return null
        }
      }

      for (let index = 0; index < rushees.length; index++) {
        const rushee = rushees[index]

        if (index > 0) {
          doc.addPage()
        }

        // Header
        doc.setFillColor(30, 41, 59) // ink
        doc.rect(0, 0, pageWidth, 50, 'F')

        // Add photo if available (maintaining aspect ratio)
        if (rushee.photo) {
          const resolvedPhoto = await resolvePhotoUrl(rushee.photo)
          const imageInfo = resolvedPhoto ? await getImageData(resolvedPhoto) : null
          if (imageInfo) {
            try {
              const maxWidth = 35
              const maxHeight = 35
              const aspectRatio = imageInfo.width / imageInfo.height

              let imgWidth = maxWidth
              let imgHeight = maxHeight

              // Calculate dimensions to fit within box while maintaining aspect ratio
              if (aspectRatio > 1) {
                // Landscape
                imgHeight = maxWidth / aspectRatio
              } else {
                // Portrait
                imgWidth = maxHeight * aspectRatio
              }

              // Center the image in the box
              const xOffset = margin + (maxWidth - imgWidth) / 2
              const yOffset = 8 + (maxHeight - imgHeight) / 2

              doc.addImage(imageInfo.data, 'JPEG', xOffset, yOffset, imgWidth, imgHeight, undefined, 'FAST')
            } catch (error) {
              console.error('Error adding image to PDF:', error)
            }
          }
        }

        // Name and info (adjusted position for photo)
        doc.setTextColor(255, 255, 255)
        doc.setFontSize(24)
        doc.setFont('helvetica', 'bold')
        doc.text(rushee.name, margin + 40, 20)

        doc.setFontSize(14)
        doc.setFont('helvetica', 'normal')
        doc.text(`${rushee.major} • ${rushee.year}`, margin + 40, 30)

        // Average Score Box
        doc.setFontSize(10)
        doc.text('AVERAGE SCORE', pageWidth - 40, 15)
        doc.setFontSize(28)
        doc.setFont('helvetica', 'bold')
        doc.text(rushee.avgScore.toString(), pageWidth - 35, 30)
        doc.setFontSize(10)
        doc.setFont('helvetica', 'normal')
        doc.text('/ 5', pageWidth - 20, 30)

        // AI Summary
        doc.setTextColor(0, 0, 0)
        let yPos = 60

        if (rushee.aiSummary) {
          doc.setFontSize(10)
          doc.setFont('helvetica', 'bold')
          doc.text('AI EVALUATION SUMMARY', margin, yPos)
          yPos += 7

          doc.setFont('helvetica', 'normal')
          doc.setFontSize(9)
          const summaryLines = doc.splitTextToSize(rushee.aiSummary, pageWidth - 2 * margin)
          doc.text(summaryLines, margin, yPos)
          yPos += summaryLines.length * 5 + 5
        }

        // Stats Table
        yPos += 5
        autoTable(doc, {
          startY: yPos,
          head: [['Metric', 'Value']],
          body: [
            ['Casual Events', rushee.casualEvents.toString()],
            ['Professional Events', rushee.professionalEvents.toString()],
            ['Professional Score Avg', rushee.professionalAvg.toString()],
            ['Personal Score Avg', rushee.personalAvg.toString()],
            ['Total Evaluations', rushee.evaluations.toString()],
          ],
          theme: 'striped',
          headStyles: { fillColor: [30, 41, 59] },
          margin: { left: margin, right: margin },
          styles: { fontSize: 9 },
        })

        yPos = (doc as any).lastAutoTable.finalY + 10

        // Interview Scores
        if (rushee.professionalInterviewScore !== null || rushee.casualInterviewScore !== null) {
          doc.setFontSize(12)
          doc.setFont('helvetica', 'bold')
          doc.text('Interview Scores', margin, yPos)
          yPos += 7

          autoTable(doc, {
            startY: yPos,
            head: [['Type', 'Score', 'Comment']],
            body: [
              [
                'Professional',
                rushee.professionalInterviewScore !== null ? `${rushee.professionalInterviewScore}/20` : '—',
                rushee.professionalInterviewComment || 'No comment'
              ],
              [
                'Casual',
                rushee.casualInterviewScore !== null ? `${rushee.casualInterviewScore}/10` : '—',
                rushee.casualInterviewComment || 'No comment'
              ]
            ],
            theme: 'striped',
            headStyles: { fillColor: [30, 41, 59] },
            margin: { left: margin, right: margin },
            styles: { fontSize: 9 },
            columnStyles: {
              0: { cellWidth: 30 },
              1: { cellWidth: 25 },
              2: { cellWidth: 'auto' }
            }
          })
        }

        // Footer
        doc.setFontSize(8)
        doc.setTextColor(100, 100, 100)
        doc.text(`Slide ${index + 1} of ${rushees.length}`, pageWidth / 2, pageHeight - 10, { align: 'center' })
      }

      doc.save('rushee-slides-export.pdf')
    } catch (error) {
      console.error('Error generating PDF:', error)
      alert('Failed to generate PDF. Please try again.')
    }
  }

  function navigateNext() {
    if (currentIndex < rushees.length - 1) {
      setCurrentIndex(currentIndex + 1)
    }
  }

  function navigatePrev() {
    if (currentIndex > 0) {
      setCurrentIndex(currentIndex - 1)
    }
  }

  function handleSearch(query: string) {
    setSearchQuery(query)
    if (!query.trim()) return

    const index = rushees.findIndex(r =>
      r.name.toLowerCase().includes(query.toLowerCase())
    )
    if (index !== -1) {
      setCurrentIndex(index)
      setShowSearch(false)
      setSearchQuery('')
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-surface-alt to-surface-sunken">
        <main className="flex items-center justify-center min-h-screen">
          <div className="text-center">
            <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-ink"></div>
            <p className="mt-4 text-ink-muted">Loading rushees...</p>
          </div>
        </main>
      </div>
    )
  }

  if (rushees.length === 0) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-surface-alt to-surface-sunken">
        <main className="flex items-center justify-center min-h-screen">
          <div className="text-center">
            <p className="text-ink-muted">No rushees found</p>
          </div>
        </main>
      </div>
    )
  }

  const currentRushee = rushees[currentIndex]

  return (
    <div className="min-h-screen bg-gradient-to-br from-surface-alt to-surface-sunken">
      {/* Slide Controls - Top Bar */}
      <div className="fixed top-0 left-0 right-0 bg-white/95 backdrop-blur-sm border-b border-line z-40 px-6 py-4">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button
              onClick={navigatePrev}
              disabled={currentIndex === 0}
              className={`p-2 rounded-lg transition-colors ${
                currentIndex === 0
                  ? 'text-line-strong cursor-not-allowed'
                  : 'text-ink-muted hover:bg-surface-sunken'
              }`}
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </button>
            <div className="text-center">
              <p className="text-lg font-bold text-ink">{currentRushee.name}</p>
              <p className="text-xs text-ink-subtle">
                Slide {currentIndex + 1} of {rushees.length}
              </p>
            </div>
            <button
              onClick={navigateNext}
              disabled={currentIndex === rushees.length - 1}
              className={`p-2 rounded-lg transition-colors ${
                currentIndex === rushees.length - 1
                  ? 'text-line-strong cursor-not-allowed'
                  : 'text-ink-muted hover:bg-surface-sunken'
              }`}
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </button>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={exportToPDF}
              className="flex items-center gap-2 px-4 py-2 bg-ink text-white rounded-lg hover:bg-inverse-soft transition-colors"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              <span className="text-sm font-semibold">Export PDF</span>
            </button>
            <button
              onClick={() => setShowSearch(!showSearch)}
              className="flex items-center gap-2 px-4 py-2 bg-surface-sunken text-ink-muted rounded-lg hover:bg-line transition-colors"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              <span className="text-sm font-semibold">Search (⌘F)</span>
            </button>
            <div className="text-xs text-ink-subtle">
              Use ← → arrow keys to navigate
            </div>
          </div>
        </div>
      </div>

      {/* Search Modal */}
      {showSearch && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-start justify-center pt-32 z-50">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl p-6">
            <div className="flex items-center gap-3 mb-4">
              <svg className="w-6 h-6 text-ink-faint" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              <input
                type="text"
                placeholder="Search for a rushee..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    handleSearch(searchQuery)
                  }
                }}
                autoFocus
                className="flex-1 text-xl font-medium border-none outline-none"
              />
              <button
                onClick={() => {
                  setShowSearch(false)
                  setSearchQuery('')
                }}
                className="text-ink-faint hover:text-ink-muted"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="max-h-96 overflow-y-auto">
              {rushees
                .filter(r => r.name.toLowerCase().includes(searchQuery.toLowerCase()))
                .map((rushee, idx) => (
                  <button
                    key={rushee.id}
                    onClick={() => {
                      setCurrentIndex(rushees.indexOf(rushee))
                      setShowSearch(false)
                      setSearchQuery('')
                    }}
                    className="w-full flex items-center gap-4 p-3 hover:bg-surface-alt rounded-lg transition-colors text-left"
                  >
                    <div className="w-12 h-12 bg-surface-sunken rounded-full overflow-hidden flex-shrink-0">
                      <RusheePhoto
                        photo={rushee.photo}
                        alt={rushee.name}
                        className="w-full h-full object-cover"
                        fallback={<div className="w-full h-full flex items-center justify-center text-ink-faint">?</div>}
                      />
                    </div>
                    <div className="flex-1">
                      <p className="font-semibold text-ink">{rushee.name}</p>
                      <p className="text-sm text-ink-subtle">{rushee.major} • {rushee.year}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-semibold text-ink">{rushee.avgScore}/5</p>
                      <p className="text-xs text-ink-subtle">{rushee.evaluations} evals</p>
                    </div>
                  </button>
                ))}
            </div>
          </div>
        </div>
      )}

      {/* Main Slide Content */}
      <main className="fixed top-24 left-0 right-0 bottom-0 px-6 py-6 overflow-hidden">
        <div className="max-w-none mx-auto h-full w-full">
          {/* Slide Card */}
          <div className="bg-white rounded-3xl shadow-2xl overflow-hidden h-full flex flex-col">
            {/* Header Section */}
            <div className="bg-gradient-to-r from-ink to-inverse-soft p-10">
              <div className="flex items-start gap-8">
                <div className="relative w-72 h-72 flex-shrink-0">
                  <div className="w-full h-full bg-surface-sunken rounded-2xl overflow-hidden border-4 border-white shadow-lg">
                    <RusheePhoto
                      photo={currentRushee.photo}
                      alt={currentRushee.name}
                      className="w-full h-full object-cover"
                      fallback={
                        <svg className="w-full h-full text-ink-faint p-12" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                        </svg>
                      }
                    />
                  </div>
                  <button
                    onClick={() => {
                      loadAttendancePhotos(currentRushee.id)
                      setShowGallery(true)
                    }}
                    className="absolute top-2 right-2 p-2 bg-black/60 hover:bg-black/80 backdrop-blur-sm text-white rounded-lg transition-colors shadow-lg"
                    title="View photo gallery"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                  </button>
                </div>
                <div className="flex-1 flex flex-col">
                  <h1 className="text-5xl font-bold text-white mb-2">{currentRushee.name}</h1>
                  <p className="text-2xl text-line-strong mb-5">{currentRushee.major} • {currentRushee.year}</p>

                  {/* AI Summary in Header */}
                  <div className="flex-1 flex flex-col">
                    {currentRushee.evaluations === 0 ? (
                      <div className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-xl p-5">
                        <p className="text-base text-ink-faint italic">No evaluations yet</p>
                      </div>
                    ) : currentRushee.aiSummary ? (
                      <div className="bg-white/10 backdrop-blur-sm border border-white/20 rounded-xl p-5 flex-1 flex flex-col relative">
                        {/* Three-dot menu */}
                        <div className="absolute top-3 right-3 summary-menu-container">
                          <button
                            onClick={() => setShowSummaryMenu(!showSummaryMenu)}
                            className="p-1 hover:bg-white/10 rounded-lg transition-colors"
                            disabled={generatingSummary}
                          >
                            <svg className="w-5 h-5 text-white/70" fill="currentColor" viewBox="0 0 24 24">
                              <circle cx="12" cy="5" r="2" />
                              <circle cx="12" cy="12" r="2" />
                              <circle cx="12" cy="19" r="2" />
                            </svg>
                          </button>

                          {/* Dropdown menu */}
                          {showSummaryMenu && !generatingSummary && (
                            <div className="absolute right-0 mt-2 w-48 bg-white rounded-lg shadow-xl border border-line py-1 z-10">
                              <button
                                onClick={() => {
                                  generateAISummary(currentRushee.id)
                                  setShowSummaryMenu(false)
                                }}
                                className="w-full text-left px-4 py-2 text-sm text-ink-muted hover:bg-surface-sunken transition-colors"
                              >
                                Regenerate Summary
                              </button>
                            </div>
                          )}
                        </div>

                        {showTypewriter ? (
                          <TypewriterText
                            text={currentRushee.aiSummary}
                            speed={15}
                            className="text-lg font-semibold text-white/90 leading-relaxed flex-1 pr-8"
                            onComplete={() => setShowTypewriter(false)}
                          />
                        ) : (
                          <p className="text-lg font-semibold text-white/90 leading-relaxed flex-1 pr-8">
                            {currentRushee.aiSummary}
                          </p>
                        )}

                        {/* AI Disclaimer */}
                        <div className="mt-4 pt-3 border-t border-white/10">
                          <p className="text-xs text-white/50 flex items-center gap-1.5">
                            <span className="relative group">
                              <svg className="w-3.5 h-3.5 cursor-help" fill="currentColor" viewBox="0 0 24 24">
                                <path d="M13 9h-2V7h2m0 10h-2v-6h2m-1-9A10 10 0 0 0 2 12a10 10 0 0 0 10 10 10 10 0 0 0 10-10A10 10 0 0 0 12 2z" />
                              </svg>
                              {/* Tooltip */}
                              <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-80 bg-ink text-white text-xs rounded-lg p-3 shadow-xl opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 pointer-events-none z-50">
                                <div className="font-semibold mb-2 text-white">AI Summary Guidelines:</div>
                                <ul className="space-y-1 text-line-strong text-[11px] leading-relaxed">
                                  <li>• Be objective to what the brothers text says</li>
                                  <li>• Keep it short (4 sentences max)</li>
                                  <li>• Remove filler words and unnecessary pretext</li>
                                  <li>• Mention overall score trends (e.g., "generally high", "mixed")</li>
                                  <li>• Do NOT state specific numerical scores</li>
                                  <li>• Include 1-2 brief direct quotes if evaluations are strongly worded</li>
                                  <li>• Tone should be casual but straightforward</li>
                                  <li>• Assume audience knows the context (we're brothers in the room)</li>
                                </ul>
                                {/* Arrow */}
                                <div className="absolute top-full left-1/2 -translate-x-1/2 -mt-1 w-0 h-0 border-l-4 border-r-4 border-t-4 border-transparent border-t-ink"></div>
                              </div>
                            </span>
                            Generated with artificial intelligence
                          </p>
                        </div>

                        {generatingSummary && (
                          <div className="mt-3 flex items-center gap-2 text-white/60 text-sm">
                            <div className="inline-block animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                            <span>Regenerating...</span>
                          </div>
                        )}
                      </div>
                    ) : (
                      <button
                        onClick={() => generateAISummary(currentRushee.id)}
                        disabled={generatingSummary}
                        className={`bg-white/10 hover:bg-white/20 backdrop-blur-sm border border-white/20 rounded-xl p-5 transition-all ${
                          generatingSummary ? 'cursor-not-allowed opacity-50' : ''
                        }`}
                      >
                        {generatingSummary ? (
                          <span className="flex items-center gap-2 text-white/90">
                            <div className="inline-block animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                            <span className="text-base">Generating AI Summary...</span>
                          </span>
                        ) : (
                          <span className="text-base text-white/70 hover:text-white/90 transition-colors">
                            Click to generate AI summary from {currentRushee.evaluations} evaluations
                          </span>
                        )}
                      </button>
                    )}
                  </div>
                </div>
                <div className="flex flex-col gap-3">
                  {/* Average Score */}
                  <div className="bg-white/10 backdrop-blur-sm rounded-2xl px-7 py-5 border border-white/20 text-center">
                    <p className="text-sm text-line-strong uppercase tracking-wider mb-1">Average Score</p>
                    <p className="text-6xl font-bold text-white">{currentRushee.avgScore}</p>
                    <p className="text-sm text-line-strong mt-1">/ 5</p>
                  </div>

                  {/* Stats Grid - 1x2 */}
                  <div className="grid grid-cols-2 gap-2">
                    <div className="text-center p-2 bg-white/10 backdrop-blur-sm rounded-lg border border-white/20">
                      <p className="text-xs text-line-strong uppercase tracking-wider mb-1">Casual</p>
                      <p className="text-2xl font-bold text-white">{currentRushee.casualEvents}</p>
                    </div>
                    <div className="text-center p-2 bg-white/10 backdrop-blur-sm rounded-lg border border-white/20">
                      <p className="text-xs text-line-strong uppercase tracking-wider mb-1">Professional</p>
                      <p className="text-2xl font-bold text-white">{currentRushee.professionalEvents}</p>
                    </div>
                  </div>

                  {/* Professional & Personal Scores - Smaller */}
                  <div className="grid grid-cols-2 gap-2">
                    <div className="text-center p-2 bg-white/10 backdrop-blur-sm rounded-lg border border-white/20">
                      <p className="text-xs text-line-strong uppercase tracking-wider mb-0.5">Pro Score</p>
                      <p className="text-xl font-bold text-white">{currentRushee.professionalAvg}</p>
                    </div>
                    <div className="text-center p-2 bg-white/10 backdrop-blur-sm rounded-lg border border-white/20">
                      <p className="text-xs text-line-strong uppercase tracking-wider mb-0.5">Personal</p>
                      <p className="text-xl font-bold text-white">{currentRushee.personalAvg}</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Two Column Layout */}
            <div className="grid grid-cols-12 gap-8 p-10 flex-1 overflow-hidden">
              {/* Left Column - Main Content */}
              <div className="col-span-8 space-y-8 overflow-y-auto">
                {/* Interview Scores */}
                <div>
                  <h3 className="text-3xl font-bold text-ink mb-6">Interview Scores</h3>
                  <div className="space-y-8">
                    {/* Professional Interview */}
                    <div>
                      <div className="flex items-center justify-between mb-3">
                        <span className="text-xl font-semibold text-ink-muted">
                          Professional Interview
                          {currentRushee.professionalOptionScore !== null && (
                            <span className="ml-2 text-ink-subtle">({currentRushee.professionalOptionScore})</span>
                          )}
                        </span>
                        <span className="text-3xl font-bold text-ink">
                          {currentRushee.professionalInterviewScore !== null ? `${currentRushee.professionalInterviewScore} / 20` : '—'}
                          {currentRushee.professionalInterviewN > 0 && (
                            <span className="ml-2 text-lg font-normal text-ink-subtle">(n={currentRushee.professionalInterviewN})</span>
                          )}
                        </span>
                      </div>
                      {currentRushee.professionalRecommendation !== null && (
                        <p className="text-lg text-ink-subtle mb-2">Panel recommendation avg: {currentRushee.professionalRecommendation.toFixed(1)} / 5</p>
                      )}
                      <div className="w-full bg-line rounded-full h-5 mb-4">
                        <div
                          className="bg-ink h-5 rounded-full transition-all duration-500"
                          style={{ width: `${currentRushee.professionalInterviewScore ? (currentRushee.professionalInterviewScore / 20) * 100 : 0}%` }}
                        ></div>
                      </div>
                      {currentRushee.professionalInterviewComment ? (
                        <div className="bg-surface-alt border border-line rounded-lg p-5">
                          <p className="text-lg text-ink-muted leading-relaxed">{currentRushee.professionalInterviewComment}</p>
                        </div>
                      ) : (
                        <div className="bg-surface-sunken border border-line rounded-lg p-5 text-center">
                          <p className="text-lg text-ink-subtle italic">No professional interview comment yet</p>
                        </div>
                      )}
                    </div>

                    {/* Casual Interview */}
                    <div>
                      <div className="flex items-center justify-between mb-3">
                        <span className="text-xl font-semibold text-ink-muted">Casual Interview</span>
                        <span className="text-3xl font-bold text-ink">
                          {currentRushee.casualInterviewScore !== null ? `${currentRushee.casualInterviewScore} / 10` : '—'}
                          {currentRushee.casualInterviewN > 0 && (
                            <span className="ml-2 text-lg font-normal text-ink-subtle">(n={currentRushee.casualInterviewN})</span>
                          )}
                        </span>
                      </div>
                      {currentRushee.casualRecommendation !== null && (
                        <p className="text-lg text-ink-subtle mb-2">Panel recommendation avg: {currentRushee.casualRecommendation.toFixed(1)} / 5</p>
                      )}
                      <div className="w-full bg-line rounded-full h-5 mb-4">
                        <div
                          className="bg-ink h-5 rounded-full transition-all duration-500"
                          style={{ width: `${currentRushee.casualInterviewScore ? (currentRushee.casualInterviewScore / 10) * 100 : 0}%` }}
                        ></div>
                      </div>
                      {currentRushee.casualInterviewComment ? (
                        <div className="bg-amber-50 border border-amber-200 rounded-lg p-5">
                          <p className="text-lg text-ink-muted leading-relaxed">{currentRushee.casualInterviewComment}</p>
                        </div>
                      ) : (
                        <div className="bg-surface-sunken border border-line rounded-lg p-5 text-center">
                          <p className="text-lg text-ink-subtle italic">No casual interview comment yet</p>
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {/* Application Info (if exists) */}
                {currentRushee.application && (
                  <div className="pt-6 border-t border-line">
                    <h3 className="text-3xl font-bold text-ink mb-6">Application Information</h3>
                    <div className="grid grid-cols-2 gap-6">
                      <div>
                        <p className="text-sm font-semibold text-ink-subtle uppercase tracking-wider mb-1">Legal Name</p>
                        <p className="text-xl text-ink">{currentRushee.application.legalName}</p>
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-ink-subtle uppercase tracking-wider mb-1">Email</p>
                        <p className="text-xl text-ink">{currentRushee.application.email}</p>
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-ink-subtle uppercase tracking-wider mb-1">Phone</p>
                        <p className="text-xl text-ink">{currentRushee.application.phoneNumber}</p>
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-ink-subtle uppercase tracking-wider mb-1">Graduation</p>
                        <p className="text-xl text-ink">{currentRushee.application.expectedGraduationDate}</p>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Right Column - Evaluations */}
              <div className="col-span-4 bg-surface-alt rounded-2xl p-7 flex flex-col overflow-hidden">
                <h3 className="text-2xl font-bold text-ink mb-4">All Evaluations ({evaluations.length})</h3>
                {loadingEvaluations ? (
                  <div className="flex items-center justify-center py-8">
                    <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-ink"></div>
                  </div>
                ) : evaluations.length === 0 ? (
                  <p className="text-center text-ink-subtle py-8 text-base">No evaluations yet</p>
                ) : (
                  <div className="space-y-4 overflow-y-auto flex-1">
                    {evaluations.map((evaluation, index) => (
                      <div key={index} className="bg-white rounded-lg p-5 shadow-sm border border-line">
                        <div className="flex flex-col gap-2 mb-2">
                          <div className="flex flex-wrap gap-1">
                            {evaluation.professional_score > 0 && (
                              <span className="px-2 py-0.5 bg-surface-sunken text-ink text-sm rounded-full font-semibold">
                                Pro: {evaluation.professional_score}/5
                              </span>
                            )}
                            {evaluation.personal_score > 0 && (
                              <span className="px-2 py-0.5 bg-emerald-100 text-emerald-700 text-sm rounded-full font-semibold">
                                Per: {evaluation.personal_score}/5
                              </span>
                            )}
                          </div>
                          <span className="text-sm text-ink-subtle">
                            {new Date(evaluation.created_at).toLocaleDateString()}
                          </span>
                        </div>
                        <p className="text-base text-ink-muted leading-relaxed">
                          {evaluation.comments || 'No comment provided'}
                        </p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

          </div>

        </div>
      </main>

      {/* Navigation Hints - Fixed at Bottom */}
      <div className="fixed bottom-4 left-0 right-0 flex items-center justify-center gap-8 text-ink-subtle text-sm pointer-events-none">
        <div className="flex items-center gap-2 bg-white/90 backdrop-blur-sm px-4 py-2 rounded-full shadow-lg">
          <kbd className="px-2 py-1 bg-surface-sunken rounded shadow-sm border border-line-strong font-mono text-xs">←</kbd>
          <span>Previous</span>
        </div>
        <div className="flex items-center gap-2 bg-white/90 backdrop-blur-sm px-4 py-2 rounded-full shadow-lg">
          <kbd className="px-2 py-1 bg-surface-sunken rounded shadow-sm border border-line-strong font-mono text-xs">→</kbd>
          <span>Next</span>
        </div>
        <div className="flex items-center gap-2 bg-white/90 backdrop-blur-sm px-4 py-2 rounded-full shadow-lg">
          <kbd className="px-2 py-1 bg-surface-sunken rounded shadow-sm border border-line-strong font-mono text-xs">⌘F</kbd>
          <span>Search</span>
        </div>
      </div>

      {/* Attendance Photos Gallery Modal */}
      {showGallery && (
        <div className="fixed inset-0 bg-black/90 backdrop-blur-sm flex items-center justify-center z-50 p-8">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-6xl max-h-[90vh] overflow-hidden flex flex-col">
            {/* Gallery Header */}
            <div className="flex items-center justify-between p-6 border-b border-line">
              <div>
                <h2 className="text-2xl font-bold text-ink">{currentRushee.name}'s Attendance Photos</h2>
                <p className="text-ink-subtle mt-1">{attendancePhotos.length} photo{attendancePhotos.length !== 1 ? 's' : ''}</p>
              </div>
              <button
                onClick={() => setShowGallery(false)}
                className="p-2 hover:bg-surface-sunken rounded-lg transition-colors"
              >
                <svg className="w-6 h-6 text-ink-muted" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Gallery Content */}
            <div className="flex-1 overflow-y-auto p-6">
              {loadingPhotos ? (
                <div className="flex items-center justify-center py-20">
                  <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-ink"></div>
                </div>
              ) : attendancePhotos.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-20">
                  <svg className="w-20 h-20 text-line-strong mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                  <p className="text-ink-muted font-semibold text-lg">No attendance photos</p>
                  <p className="text-ink-subtle text-sm mt-1">This rushee hasn't checked in with photos yet</p>
                </div>
              ) : (
                <div className="grid grid-cols-2 lg:grid-cols-3 gap-6">
                  {attendancePhotos.map((photo: any, index: number) => (
                    <div key={index} className="group relative bg-surface-alt rounded-2xl overflow-hidden shadow-lg hover:shadow-2xl transition-all duration-300">
                      <div className="aspect-square bg-surface-sunken overflow-hidden">
                        <RusheePhoto
                          photo={photo.photo_url}
                          bucket="attendance-photos"
                          alt={`${photo.event?.title || 'Event'} attendance`}
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                          fallback={<div className="w-full h-full flex items-center justify-center text-ink-faint text-sm">No photo</div>}
                        />
                      </div>
                      <div className="p-4 bg-white">
                        <p className="font-bold text-ink mb-1">
                          {photo.event?.title || 'Unknown Event'}
                        </p>
                        <p className="text-sm text-ink-subtle">
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
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

'use client'

import AdminNav from '@/components/admin/AdminNav'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/contexts/AuthContext'

type BrotherRow = {
  id: string
  name: string
  email: string | null
  accessLevel: string | null
  attendanceCount: number
  evaluationCount: number
}

export default function AdminBrotherInsights() {
  const router = useRouter()
  const { profile } = useAuth()
  const [loading, setLoading] = useState(true)
  const [rows, setRows] = useState<BrotherRow[]>([])
  const [error, setError] = useState<string | null>(null)
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)
  const [showEvaluationsModal, setShowEvaluationsModal] = useState(false)
  const [selectedBrother, setSelectedBrother] = useState<BrotherRow | null>(null)
  const [evaluations, setEvaluations] = useState<any[]>([])
  const [loadingEvaluations, setLoadingEvaluations] = useState(false)
  const [sortKey, setSortKey] = useState<'alpha' | 'evals' | 'events'>('alpha')

  useEffect(() => {
    if (!profile) return

    if (!['admin', 'pro'].includes(profile.access_level)) {
      router.push('/brother/dashboard')
      return
    }

    async function loadInsights() {
      try {

        const { data: brothers } = await supabase
          .from('brothers')
          .select('id, name, email, access_level')
          .order('name')

        const { data: attendance } = await supabase
          .from('brother_event_attendance')
          .select('brother_id')

        const { data: evaluations } = await supabase
          .from('evaluations')
          .select('brother_id')

        const attendanceCounts = new Map<string, number>()
        ;(attendance || []).forEach((entry: any) => {
          attendanceCounts.set(entry.brother_id, (attendanceCounts.get(entry.brother_id) || 0) + 1)
        })

        const evaluationCounts = new Map<string, number>()
        ;(evaluations || []).forEach((entry: any) => {
          evaluationCounts.set(entry.brother_id, (evaluationCounts.get(entry.brother_id) || 0) + 1)
        })

        const normalizedRows = (brothers || []).map((brother: any) => ({
          id: brother.id,
          name: brother.name || 'Unknown',
          email: brother.email || null,
          accessLevel: brother.access_level || null,
          attendanceCount: attendanceCounts.get(brother.id) || 0,
          evaluationCount: evaluationCounts.get(brother.id) || 0
        }))

        setRows(normalizedRows)
      } catch (fetchError) {
        console.error('Error loading brother insights:', fetchError)
        setError('Failed to load brother insights.')
      } finally {
        setLoading(false)
      }
    }

    loadInsights()
  }, [profile, router])

  const handleBrotherClick = async (brother: BrotherRow) => {
    setSelectedBrother(brother)
    setShowEvaluationsModal(true)
    setLoadingEvaluations(true)
    setEvaluations([])

    try {
      const { data, error: evalError } = await supabase
        .from('evaluations')
        .select(`
          *,
          rushee:rushees(name),
          event:events(title, type, date)
        `)
        .eq('brother_id', brother.id)
        .order('created_at', { ascending: false })

      if (evalError) throw evalError

      setEvaluations(data || [])
    } catch (evalError) {
      console.error('Error loading evaluations:', evalError)
      setEvaluations([])
    } finally {
      setLoadingEvaluations(false)
    }
  }

  const sortedRows = [...rows].sort((a, b) => {
    if (sortKey === 'evals') {
      return b.evaluationCount - a.evaluationCount
    }
    if (sortKey === 'events') {
      return b.attendanceCount - a.attendanceCount
    }
    return a.name.localeCompare(b.name)
  })

  return (
    <div className="min-h-screen bg-canvas">
      <AdminNav />

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-8">
          <p className="text-xs uppercase tracking-[0.35em] text-ink-subtle">Admin Insights</p>
          <h1 className="mt-2 text-3xl font-semibold text-ink">Brother Insights</h1>
          <p className="mt-2 text-sm text-ink-muted">
            Track attendance and evaluation volume across the brotherhood.
          </p>
        </div>

        {loading && (
          <div className="text-center py-12">
            <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-ink"></div>
            <p className="mt-4 text-ink-muted">Loading brother insights...</p>
          </div>
        )}

        {!loading && error && (
          <div className="bg-white border border-red-200 rounded-2xl p-6 text-red-700 shadow-sm">
            {error}
          </div>
        )}

        {!loading && !error && (
          <div className="bg-white border border-line rounded-2xl shadow-sm overflow-hidden">
            {message && (
              <div className={`m-6 rounded-2xl border px-4 py-3 text-sm ${
                message.type === 'success'
                  ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                  : 'bg-rose-50 border-rose-200 text-rose-800'
              }`}>
                <div className="flex items-center justify-between">
                  <span>{message.text}</span>
                  <button
                    onClick={() => setMessage(null)}
                    className="text-xs uppercase tracking-[0.2em]"
                  >
                    Close
                  </button>
                </div>
              </div>
            )}
            <div className="px-6 py-4 border-b border-line flex items-center justify-between">
              <p className="text-sm text-ink-muted">
                {rows.length} brother{rows.length === 1 ? '' : 's'}
              </p>
              <div className="flex items-center gap-2">
                <span className="text-xs uppercase tracking-[0.2em] text-ink-subtle">Sort</span>
                <select
                  value={sortKey}
                  onChange={(event) => setSortKey(event.target.value as typeof sortKey)}
                  className="rounded-lg border border-line bg-white px-3 py-2 text-sm text-ink-muted focus:outline-none focus:ring-2 focus:ring-ink"
                >
                  <option value="alpha">Alphabetical</option>
                  <option value="evals">Evaluations (High to Low)</option>
                  <option value="events">Events Attended (High to Low)</option>
                </select>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-line">
                <thead className="bg-surface-alt">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs uppercase tracking-[0.2em] text-ink-subtle">Brother</th>
                    <th className="px-6 py-3 text-left text-xs uppercase tracking-[0.2em] text-ink-subtle">Email</th>
                    <th className="px-6 py-3 text-right text-xs uppercase tracking-[0.2em] text-ink-subtle">Events Attended</th>
                    <th className="px-6 py-3 text-right text-xs uppercase tracking-[0.2em] text-ink-subtle">Evaluations</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line">
                  {sortedRows.map((brother) => (
                    <tr key={brother.id} className="hover:bg-surface-alt">
                      <td className="px-6 py-4 text-sm font-semibold text-ink">
                        <button
                          onClick={() => handleBrotherClick(brother)}
                          className="text-left text-ink hover:text-ink-muted transition-colors"
                        >
                          {brother.name}
                        </button>
                      </td>
                      <td className="px-6 py-4 text-sm text-ink-muted">{brother.email || '—'}</td>
                      <td className="px-6 py-4 text-sm text-ink-muted text-right">{brother.attendanceCount}</td>
                      <td className="px-6 py-4 text-sm text-ink-muted text-right">{brother.evaluationCount}</td>
                    </tr>
                  ))}
                  {rows.length === 0 && (
                    <tr>
                      <td className="px-6 py-10 text-center text-sm text-ink-subtle" colSpan={4}>
                        No brothers found.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {showEvaluationsModal && selectedBrother && (
          <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <div className="bg-white border border-line rounded-2xl p-6 max-w-4xl w-full max-h-[80vh] overflow-y-auto shadow-xl">
              <div className="flex justify-between items-start mb-6">
                <div>
                  <h2 className="text-2xl font-semibold text-ink">{selectedBrother.name}</h2>
                  <p className="text-ink-muted">Evaluations Completed</p>
                </div>
                <button
                  onClick={() => setShowEvaluationsModal(false)}
                  className="text-ink-muted hover:text-ink text-2xl font-bold"
                >
                  x
                </button>
              </div>

              {loadingEvaluations ? (
                <div className="text-center py-12">
                  <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-ink mx-auto mb-4"></div>
                  <p className="text-ink-muted">Loading evaluations...</p>
                </div>
              ) : evaluations.length === 0 ? (
                <div className="text-center py-12">
                  <p className="text-ink-muted">No evaluations completed yet.</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {evaluations.map((evaluation: any, index: number) => (
                    <div key={evaluation.id || index} className="bg-surface-alt border border-line rounded-2xl p-4">
                      <div className="flex justify-between items-start mb-3">
                        <div>
                          <p className="font-semibold text-ink">
                            {evaluation.rushee?.name || 'Unknown Rushee'}
                          </p>
                          <p className="text-sm text-ink-muted">
                            {evaluation.event?.title} ({evaluation.event?.type}) - {evaluation.event?.date ? new Date(evaluation.event.date).toLocaleDateString() : 'Unknown date'}
                          </p>
                        </div>
                        <div className="text-right">
                          <p className="text-sm text-ink-subtle">Professional</p>
                          <p className="text-lg font-semibold text-ink">
                            {evaluation.professional_score === 0 ? 'N/A' : `${evaluation.professional_score}/5`}
                          </p>
                        </div>
                        <div className="text-right">
                          <p className="text-sm text-ink-subtle">Personal</p>
                          <p className="text-lg font-semibold text-ink">
                            {evaluation.personal_score === 0 ? 'N/A' : `${evaluation.personal_score}/5`}
                          </p>
                        </div>
                      </div>

                      <div className="mt-3 pt-3 border-t border-line">
                        <p className="text-sm font-semibold text-ink-muted mb-1">Comments:</p>
                        <p className="text-ink-muted">{evaluation.comments || 'No comments provided'}</p>
                      </div>

                      <div className="mt-2 text-xs text-ink-subtle">
                        Submitted: {new Date(evaluation.created_at).toLocaleString()}
                      </div>
                    </div>
                  ))}
                </div>
              )}

              <div className="mt-6 flex justify-between items-center pt-4 border-t border-line">
                <div className="text-sm text-ink-muted">
                  Total evaluations: <span className="font-semibold text-ink">{evaluations.length}</span>
                </div>
                <button
                  onClick={() => setShowEvaluationsModal(false)}
                  className="px-6 py-2 bg-ink text-white rounded-lg font-semibold hover:bg-inverse-soft transition-colors"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  )
}

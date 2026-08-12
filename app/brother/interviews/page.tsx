'use client'

import BrotherNav from '@/components/brother/BrotherNav'
import { useState, useEffect, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { startInterview } from './actions'
import {
  getManageableInterviews,
  reassignPanelist,
  dropRushee,
  removePanelist,
  cancelInterview,
  type ManageableInterview,
  type ManageableAssignment,
} from './manage-actions'

type InterviewType = 'casual' | 'professional'
type InterviewStatus = 'in_progress' | 'completed' | 'cancelled'

interface ProgressRow {
  rushee_id: string
  type: InterviewType
  interview_status: InterviewStatus
  pending_count: number
  submitted_count: number
  removed_count: number
  started_at: string
}

interface RusheeRow {
  id: string
  name: string
  major: string | null
  year: string | null
}

interface BrotherRow {
  id: string
  name: string
  access_level: string | null
}

// Ordered preference for display when multiple rows exist for same (rushee, type)
const STATUS_RANK: Record<InterviewStatus, number> = { in_progress: 0, completed: 1, cancelled: 2 }

function bestStatus(rows: ProgressRow[]): ProgressRow | undefined {
  return rows.slice().sort((a, b) => STATUS_RANK[a.interview_status] - STATUS_RANK[b.interview_status])[0]
}

function StatusCell({ row }: { row: ProgressRow | undefined }) {
  if (!row) {
    return <span className="text-gray-300 text-lg">✗</span>
  }
  if (row.interview_status === 'completed') {
    if (row.submitted_count === 0) {
      return <span className="text-gray-300 text-lg">✗</span>
    }
    return (
      <span className="inline-flex items-center gap-1 text-green-600 font-medium text-sm">
        <span className="text-base">✓</span>
        <span className="text-xs text-gray-400">({row.submitted_count})</span>
      </span>
    )
  }
  if (row.interview_status === 'in_progress') {
    const total = row.pending_count + row.submitted_count + row.removed_count
    return (
      <span className="inline-flex flex-col items-center gap-0.5">
        <span className="text-xs font-medium text-amber-600 bg-amber-50 px-2 py-0.5 rounded-full border border-amber-200">
          In Progress
        </span>
        <span className="text-xs text-gray-400">
          {row.submitted_count}/{total - row.removed_count} done
        </span>
      </span>
    )
  }
  return <span className="text-gray-300 text-sm">Cancelled</span>
}

function MultiSelect({
  label,
  items,
  selected,
  onChange,
  renderLabel,
}: {
  label: string
  items: { id: string; label: string }[]
  selected: string[]
  onChange: (ids: string[]) => void
  renderLabel?: (item: { id: string; label: string }) => React.ReactNode
}) {
  function toggle(id: string) {
    onChange(selected.includes(id) ? selected.filter(s => s !== id) : [...selected, id])
  }
  return (
    <div>
      <p className="text-sm font-medium text-gray-700 mb-1">{label}</p>
      <div className="border border-gray-200 rounded max-h-48 overflow-y-auto divide-y divide-gray-100">
        {items.length === 0 && <p className="text-xs text-gray-400 px-3 py-2">None available</p>}
        {items.map(item => (
          <label key={item.id} className="flex items-center gap-2 px-3 py-1.5 hover:bg-gray-50 cursor-pointer">
            <input
              type="checkbox"
              checked={selected.includes(item.id)}
              onChange={() => toggle(item.id)}
              className="rounded"
            />
            <span className="text-sm">{renderLabel ? renderLabel(item) : item.label}</span>
          </label>
        ))}
      </div>
      {selected.length > 0 && (
        <p className="text-xs text-gray-400 mt-0.5">{selected.length} selected</p>
      )}
    </div>
  )
}

function StartInterviewSheet({
  rushees,
  brothers,
  onClose,
  onStarted,
}: {
  rushees: RusheeRow[]
  brothers: BrotherRow[]
  onClose: () => void
  onStarted: () => void
}) {
  const [pending, startTransition] = useTransition()
  const [type, setType] = useState<InterviewType>('casual')
  const [selectedRushees, setSelectedRushees] = useState<string[]>([])
  const [selectedBrothers, setSelectedBrothers] = useState<string[]>([])
  const [error, setError] = useState<string | null>(null)

  function handleSubmit() {
    setError(null)
    startTransition(async () => {
      const { error: err } = await startInterview(type, selectedRushees, selectedBrothers)
      if (err) {
        setError(err)
        return
      }
      onStarted()
    })
  }

  const rusheeItems = rushees.map(r => ({ id: r.id, label: r.name }))
  const brotherItems = brothers.map(b => ({ id: b.id, label: b.name }))

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/40 z-40"
        onClick={onClose}
      />
      {/* Sheet */}
      <div className="fixed right-0 top-0 bottom-0 w-full max-w-md bg-white shadow-2xl z-50 flex flex-col">
        <div className="flex items-center justify-between px-5 py-4 border-b">
          <h2 className="text-lg font-semibold text-gray-900">Start Interview</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-2xl leading-none">&times;</button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-5">
          <div>
            <p className="text-sm font-medium text-gray-700 mb-1">Interview type</p>
            <div className="flex gap-3">
              {(['casual', 'professional'] as InterviewType[]).map(t => (
                <button
                  key={t}
                  onClick={() => setType(t)}
                  className={`flex-1 py-2 rounded border text-sm font-medium capitalize transition-colors ${
                    type === t
                      ? 'bg-black text-white border-black'
                      : 'bg-white text-gray-700 border-gray-200 hover:border-gray-400'
                  }`}
                >
                  {t}
                </button>
              ))}
            </div>
          </div>

          <MultiSelect
            label="Rushees to interview"
            items={rusheeItems}
            selected={selectedRushees}
            onChange={setSelectedRushees}
          />

          <MultiSelect
            label="Panelists (brothers)"
            items={brotherItems}
            selected={selectedBrothers}
            onChange={setSelectedBrothers}
          />

          {error && <p className="text-red-600 text-sm">{error}</p>}
        </div>

        <div className="px-5 py-4 border-t">
          <p className="text-xs text-gray-400 mb-3">
            Each panelist will be assigned to each selected rushee. They can open their rubric
            from the Interviews tab.
          </p>
          <button
            onClick={handleSubmit}
            disabled={pending || selectedRushees.length === 0 || selectedBrothers.length === 0}
            className="w-full bg-black hover:bg-gray-800 text-white py-2.5 rounded font-medium text-sm disabled:opacity-40"
          >
            {pending
              ? 'Starting…'
              : `Start ${type} interview (${selectedRushees.length} rushee${selectedRushees.length !== 1 ? 's' : ''}, ${selectedBrothers.length} panelist${selectedBrothers.length !== 1 ? 's' : ''})`}
          </button>
        </div>
      </div>
    </>
  )
}

function ManagePanel({
  interviews,
  rushees,
  onAction,
}: {
  interviews: ManageableInterview[]
  rushees: RusheeRow[]
  onAction: () => void
}) {
  const [actionPending, startActionTransition] = useTransition()
  const [expanded, setExpanded] = useState<string | null>(null)
  const [cancelTarget, setCancelTarget] = useState<string | null>(null)
  const [cancelReason, setCancelReason] = useState('')
  const [actionError, setActionError] = useState<string | null>(null)
  const [reassignState, setReassignState] = useState<{
    interviewId: string; brotherId: string; oldRusheeId: string
  } | null>(null)
  const [reassignNewRusheeId, setReassignNewRusheeId] = useState('')

  function doAction(fn: () => Promise<{ error: string | null }>) {
    setActionError(null)
    startActionTransition(async () => {
      const { error } = await fn()
      if (error) { setActionError(error); return }
      onAction()
    })
  }

  if (interviews.length === 0) {
    return <p className="text-gray-400 text-sm py-2">No in-progress interviews.</p>
  }

  return (
    <div className="space-y-3">
      {actionError && (
        <p className="text-red-600 text-sm bg-red-50 border border-red-200 rounded px-3 py-2">{actionError}</p>
      )}

      {interviews.map(iv => {
        const isExpanded = expanded === iv.id
        // Group assignments by rushee
        const rusheeGroups = new Map<string, ManageableAssignment[]>()
        for (const a of iv.assignments) {
          if (!rusheeGroups.has(a.rushee_id)) rusheeGroups.set(a.rushee_id, [])
          rusheeGroups.get(a.rushee_id)!.push(a)
        }
        const rusheeIds = [...rusheeGroups.keys()]

        return (
          <div key={iv.id} className={`bg-white rounded-lg shadow border ${iv.is_stuck ? 'border-amber-300' : 'border-transparent'}`}>
            <button
              className="w-full flex items-center justify-between px-4 py-3 text-left"
              onClick={() => setExpanded(isExpanded ? null : iv.id)}
            >
              <div className="flex items-center gap-2">
                <span className="font-medium text-gray-900 capitalize">{iv.type} interview</span>
                {iv.is_stuck && (
                  <span className="text-xs bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full border border-amber-200">
                    Stuck
                  </span>
                )}
              </div>
              <div className="flex items-center gap-3">
                <span className="text-xs text-gray-400">
                  {new Date(iv.started_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </span>
                <span className="text-gray-400">{isExpanded ? '▲' : '▼'}</span>
              </div>
            </button>

            {isExpanded && (
              <div className="border-t px-4 py-3 space-y-4">
                {rusheeIds.map(rusheeId => {
                  const group = rusheeGroups.get(rusheeId)!
                  const rusheeName = group[0].rushee_name
                  return (
                    <div key={rusheeId} className="border border-gray-100 rounded-lg p-3">
                      <div className="flex items-center justify-between mb-2">
                        <p className="text-sm font-medium text-gray-800">{rusheeName}</p>
                        <button
                          onClick={() => doAction(() => dropRushee(iv.id, rusheeId))}
                          disabled={actionPending}
                          className="text-xs text-red-600 hover:text-red-700 disabled:opacity-50"
                        >
                          Drop rushee
                        </button>
                      </div>
                      <div className="space-y-1.5">
                        {group.map(a => (
                          <div key={a.brother_id} className="flex items-center justify-between text-xs">
                            <div className="flex items-center gap-2">
                              <span className="text-gray-700">{a.brother_name}</span>
                              <span className={`px-1.5 py-0.5 rounded text-xs ${
                                a.status === 'submitted' ? 'bg-green-100 text-green-700' :
                                a.status === 'removed' ? 'bg-gray-100 text-gray-500' :
                                'bg-blue-50 text-blue-700'
                              }`}>
                                {a.status}
                              </span>
                              {a.conflict_flagged_at && (
                                <span className="text-red-500">conflict</span>
                              )}
                              {a.knows_personally && (
                                <span className="text-amber-600">knows</span>
                              )}
                            </div>
                            <div className="flex gap-2">
                              {a.status === 'pending' && (
                                <>
                                  <button
                                    onClick={() => {
                                      setReassignState({ interviewId: iv.id, brotherId: a.brother_id, oldRusheeId: rusheeId })
                                      setReassignNewRusheeId('')
                                    }}
                                    className="text-blue-600 hover:text-blue-700"
                                  >
                                    Reassign
                                  </button>
                                  <span className="text-gray-300">|</span>
                                </>
                              )}
                              <button
                                onClick={() => doAction(() => removePanelist(iv.id, a.brother_id, rusheeId))}
                                disabled={actionPending || a.status === 'removed'}
                                className="text-red-500 hover:text-red-600 disabled:opacity-40"
                              >
                                Remove
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>

                      {/* Reassign mini-form */}
                      {reassignState?.interviewId === iv.id &&
                        reassignState.brotherId === group[0].brother_id &&
                        reassignState.oldRusheeId === rusheeId && (
                        <div className="mt-2 pt-2 border-t border-gray-100 flex gap-2 items-center">
                          <select
                            value={reassignNewRusheeId}
                            onChange={e => setReassignNewRusheeId(e.target.value)}
                            className="flex-1 text-xs border border-gray-200 rounded px-2 py-1"
                          >
                            <option value="">Select new rushee…</option>
                            {rushees.filter(r => r.id !== rusheeId).map(r => (
                              <option key={r.id} value={r.id}>{r.name}</option>
                            ))}
                          </select>
                          <button
                            onClick={() => {
                              if (!reassignNewRusheeId) return
                              doAction(() => reassignPanelist(
                                reassignState.interviewId,
                                reassignState.brotherId,
                                reassignState.oldRusheeId,
                                reassignNewRusheeId
                              ))
                              setReassignState(null)
                            }}
                            disabled={!reassignNewRusheeId || actionPending}
                            className="text-xs bg-blue-600 text-white px-2 py-1 rounded disabled:opacity-40"
                          >
                            Confirm
                          </button>
                          <button
                            onClick={() => setReassignState(null)}
                            className="text-xs text-gray-400"
                          >
                            Cancel
                          </button>
                        </div>
                      )}
                    </div>
                  )
                })}

                {/* Cancel interview */}
                {cancelTarget === iv.id ? (
                  <div className="pt-2 border-t border-gray-100">
                    <p className="text-xs text-gray-600 mb-2">Reason for cancellation:</p>
                    <input
                      type="text"
                      value={cancelReason}
                      onChange={e => setCancelReason(e.target.value)}
                      placeholder="Enter reason…"
                      className="w-full text-xs border border-gray-200 rounded px-2 py-1.5 mb-2 focus:outline-none focus:ring-1 focus:ring-red-500"
                    />
                    <div className="flex gap-2">
                      <button
                        onClick={() => {
                          doAction(() => cancelInterview(iv.id, cancelReason))
                          setCancelTarget(null)
                          setCancelReason('')
                        }}
                        disabled={!cancelReason.trim() || actionPending}
                        className="text-xs bg-red-600 text-white px-3 py-1.5 rounded disabled:opacity-40"
                      >
                        Confirm cancel
                      </button>
                      <button onClick={() => setCancelTarget(null)} className="text-xs text-gray-500">
                        Back
                      </button>
                    </div>
                  </div>
                ) : (
                  <button
                    onClick={() => { setCancelTarget(iv.id); setCancelReason('') }}
                    className="text-xs text-red-600 hover:text-red-700 pt-1"
                  >
                    Cancel interview…
                  </button>
                )}
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}

export default function BrotherInterviewsPage() {
  const router = useRouter()
  const [rushees, setRushees] = useState<RusheeRow[]>([])
  const [brothers, setBrothers] = useState<BrotherRow[]>([])
  const [progress, setProgress] = useState<ProgressRow[]>([])
  const [canManage, setCanManage] = useState(false)
  const [userId, setUserId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [showSheet, setShowSheet] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [manageInterviews, setManageInterviews] = useState<ManageableInterview[]>([])
  const [showManage, setShowManage] = useState(false)

  useEffect(() => {
    loadData()
  }, [])

  async function navigateToInterview(rusheeId: string, type: InterviewType) {
    if (!userId) return
    // Own assignments are visible via RLS (brother_id = auth.uid())
    const { data } = await (supabase as any)
      .from('interview_assignments')
      .select('interview_id, interviews!inner(type, status)')
      .eq('brother_id', userId)
      .eq('rushee_id', rusheeId)
      .eq('status', 'pending')
      .eq('interviews.type', type)
      .eq('interviews.status', 'in_progress')
      .maybeSingle()
    if (data?.interview_id) {
      router.push(`/brother/interview/${data.interview_id}/${rusheeId}`)
    }
  }

  async function loadData() {
    setLoading(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { setLoading(false); return }
    setUserId(user.id)

    const [rusheesRes, progressRes, brotherRes, selfRes] = await Promise.all([
      supabase.from('rushees').select('id, name, major, year').order('name'),
      supabase.rpc('fn_interview_progress'),
      supabase.from('brothers').select('id, name, access_level').order('name'),
      supabase.from('brothers').select('access_level, id').eq('id', user.id).maybeSingle(),
    ])

    setRushees((rusheesRes.data as unknown as RusheeRow[]) ?? [])
    setProgress((progressRes.data as unknown as ProgressRow[]) ?? [])
    setBrothers((brotherRes.data as unknown as BrotherRow[]) ?? [])

    // Check if current user can manage interviews (excludes professional_chair)
    const selfData = selfRes.data as { access_level: string | null; id: string } | null
    if (selfData) {
      const { data: roleRows } = await (supabase as any)
        .from('brother_roles')
        .select('role')
        .eq('brother_id', user.id)

      const roles = (roleRows ?? []).map((r: { role: string }) => r.role)
      const isAdmin = selfData.access_level === 'admin'
      const hasManageRole = roles.some((r: string) =>
        ['recruitment_director', 'professional_team', 'admin'].includes(r)
      )
      const manage = isAdmin || hasManageRole
      setCanManage(manage)

      if (manage) {
        const { data: ivs } = await getManageableInterviews()
        setManageInterviews(ivs ?? [])
      }
    }

    setLoading(false)
  }

  async function reloadManage() {
    const { data: ivs } = await getManageableInterviews()
    setManageInterviews(ivs ?? [])
    await loadData()
  }

  // Map progress by rushee_id → type → best row
  const progressMap = new Map<string, Map<InterviewType, ProgressRow>>()
  for (const row of progress) {
    if (!progressMap.has(row.rushee_id)) progressMap.set(row.rushee_id, new Map())
    const typeMap = progressMap.get(row.rushee_id)!
    const existing = typeMap.get(row.type)
    if (!existing || STATUS_RANK[row.interview_status] < STATUS_RANK[existing.interview_status]) {
      typeMap.set(row.type, row)
    }
  }

  const filtered = rushees.filter(r =>
    !searchQuery || r.name.toLowerCase().includes(searchQuery.toLowerCase())
  )

  return (
    <div className="min-h-screen bg-gray-50 pb-24 lg:pb-0">
      <BrotherNav />

      <div className="max-w-4xl mx-auto px-4 py-6">
        <div className="flex items-center justify-between mb-5">
          <h1 className="text-xl font-bold text-gray-900">Interviews</h1>
          {canManage && (
            <button
              onClick={() => setShowSheet(true)}
              className="bg-black hover:bg-gray-800 text-white text-sm px-4 py-2 rounded font-medium"
            >
              + Start Interview
            </button>
          )}
        </div>

        <input
          type="text"
          placeholder="Search rushees…"
          value={searchQuery}
          onChange={e => setSearchQuery(e.target.value)}
          className="w-full border border-gray-200 rounded px-3 py-2 text-sm mb-4 focus:outline-none focus:ring-2 focus:ring-black"
        />

        {loading && <p className="text-gray-400 text-sm">Loading…</p>}

        {!loading && (
          <div className="bg-white rounded-lg shadow overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-gray-50">
                  <th className="text-left px-4 py-3 font-medium text-gray-600">Rushee</th>
                  <th className="text-center px-4 py-3 font-medium text-gray-600">Casual</th>
                  <th className="text-center px-4 py-3 font-medium text-gray-600">Professional</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filtered.length === 0 && (
                  <tr>
                    <td colSpan={3} className="px-4 py-6 text-center text-gray-400">
                      {searchQuery ? 'No rushees match.' : 'No rushees yet.'}
                    </td>
                  </tr>
                )}
                {filtered.map(rushee => {
                  const typeMap = progressMap.get(rushee.id)
                  const casual = typeMap?.get('casual')
                  const professional = typeMap?.get('professional')
                  return (
                    <tr key={rushee.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3">
                        <p className="font-medium text-gray-900">{rushee.name}</p>
                        {rushee.major && (
                          <p className="text-xs text-gray-400">{rushee.major}</p>
                        )}
                      </td>
                      <td className="px-4 py-3 text-center">
                        {casual?.interview_status === 'in_progress' ? (
                          <button onClick={() => navigateToInterview(rushee.id, 'casual')} className="hover:opacity-70 transition-opacity">
                            <StatusCell row={casual} />
                          </button>
                        ) : (
                          <StatusCell row={casual} />
                        )}
                      </td>
                      <td className="px-4 py-3 text-center">
                        {professional?.interview_status === 'in_progress' ? (
                          <button onClick={() => navigateToInterview(rushee.id, 'professional')} className="hover:opacity-70 transition-opacity">
                            <StatusCell row={professional} />
                          </button>
                        ) : (
                          <StatusCell row={professional} />
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}

        {canManage && !loading && (
          <div className="mt-6">
            <button
              onClick={() => setShowManage(v => !v)}
              className="flex items-center gap-2 text-sm font-medium text-gray-700 hover:text-gray-900"
            >
              <span>Manage Sessions</span>
              <span className="text-gray-400 text-xs">{showManage ? '▲' : '▼'}</span>
              {manageInterviews.length > 0 && (
                <span className="ml-1 bg-gray-100 text-gray-600 text-xs px-2 py-0.5 rounded-full">
                  {manageInterviews.length} active
                </span>
              )}
              {manageInterviews.some(iv => iv.is_stuck) && (
                <span className="text-xs bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full">
                  stuck
                </span>
              )}
            </button>

            {showManage && (
              <div className="mt-3">
                <ManagePanel
                  interviews={manageInterviews}
                  rushees={rushees}
                  onAction={reloadManage}
                />
              </div>
            )}
          </div>
        )}
      </div>

      {showSheet && (
        <StartInterviewSheet
          rushees={rushees}
          brothers={brothers}
          onClose={() => setShowSheet(false)}
          onStarted={() => {
            setShowSheet(false)
            loadData()
          }}
        />
      )}
    </div>
  )
}

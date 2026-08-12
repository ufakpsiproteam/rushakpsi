'use client'

import AdminNav from '@/components/admin/AdminNav'
import { useState, useEffect } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import type { Database } from '@/lib/database.types'
import { useAuth } from '@/contexts/AuthContext'
import { POLICY, evaluateEligibility } from '@/lib/policy'

type TriState = 'undecided' | 'yes' | 'no'

function toTriState(value: boolean | null | undefined): TriState {
  if (value === true) return 'yes'
  if (value === false) return 'no'
  return 'undecided'
}

function fromTriState(value: string): boolean | null {
  if (value === 'yes') return true
  if (value === 'no') return false
  return null
}

interface RusheeWithStats {
  /** Admin-only staged decisions, not yet visible to the rushee (§6.7.4).
   *  undefined = no staged change; null/true/false = staged value. */
  stagedInviteOnly?: boolean | null
  stagedBidStatus?: boolean | null
  id: string
  name: string
  email: string
  major: string
  year: string
  gpa: number | null
  photo: string | null
  casualEvents: number
  professionalEvents: number
  interactions: number
  evaluations: number
  avgRating: number | null
  minimumsMet: boolean
  inviteOnly: boolean | null
  bidStatus: boolean | null
  professionalInterviewScore: number | null
  professionalInterviewN: number
  casualInterviewScore: number | null
  casualInterviewN: number
}

interface StatusChange {
  type: string
  color: string
  rushees: RusheeWithStats[]
}

export default function AdminStanding() {
  const { profile } = useAuth()
  const userAccessLevel = profile?.access_level || null
  const [showConfirmation, setShowConfirmation] = useState(false)
  const [publishConfirmText, setPublishConfirmText] = useState('')
  const [changes, setChanges] = useState<StatusChange[]>([])
  const [showEvaluationsModal, setShowEvaluationsModal] = useState(false)
  const [selectedRushee, setSelectedRushee] = useState<RusheeWithStats | null>(null)
  const [resolvedPhotoUrl, setResolvedPhotoUrl] = useState<string | null>(null)
  const [evaluations, setEvaluations] = useState<any[]>([])
  const [loadingEvaluations, setLoadingEvaluations] = useState(false)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [sortMode, setSortMode] = useState<'alpha' | 'avg'>('alpha')
  const [showDeleteModal, setShowDeleteModal] = useState(false)
  const [rusheeToDelete, setRusheeToDelete] = useState<RusheeWithStats | null>(null)
  const [deleteConfirmText, setDeleteConfirmText] = useState('')
  const [deleting, setDeleting] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [copyingEmails, setCopyingEmails] = useState(false)

  const [rushees, setRushees] = useState<RusheeWithStats[]>([])

  // Copy all rushees' emails to clipboard
  const handleCopyEmails = async () => {
    setCopyingEmails(true)
    try {
      const emails = rushees.map(r => r.email).filter(email => email).join(', ')
      await navigator.clipboard.writeText(emails)
      alert(`Copied ${rushees.length} email addresses to clipboard!`)
    } catch (error) {
      console.error('Error copying emails:', error)
      alert('Failed to copy emails. Please try again.')
    } finally {
      setCopyingEmails(false)
    }
  }

  // Load real rushee data from database
  useEffect(() => {
    loadRushees()
  }, [])

  // Filter rushees by search query
  const filteredRushees = rushees.filter(r => {
    if (!searchQuery.trim()) return true

    const query = searchQuery.toLowerCase()
    const matchesName = r.name.toLowerCase().includes(query)
    const matchesMajor = r.major.toLowerCase().includes(query)
    const matchesYear = r.year.toLowerCase().includes(query)
    const matchesEmail = r.email.toLowerCase().includes(query)

    return matchesName || matchesMajor || matchesYear || matchesEmail
  })

  const sortedRushees = [...filteredRushees].sort((a, b) => {
    if (sortMode === 'alpha') {
      return a.name.localeCompare(b.name)
    }
    if (a.avgRating === null && b.avgRating === null) return 0
    if (a.avgRating === null) return 1
    if (b.avgRating === null) return -1
    return b.avgRating - a.avgRating
  })

  useEffect(() => {
    if (!selectedRushee) {
      setResolvedPhotoUrl(null)
      return
    }

    const photo = selectedRushee.photo
    if (photo && photo.startsWith('http')) {
      setResolvedPhotoUrl(photo)
      return
    }

    if (photo && photo.includes('/')) {
      const { data } = supabase.storage.from('profile-photos').getPublicUrl(photo)
      setResolvedPhotoUrl(data.publicUrl)
      return
    }

    async function resolveFromStorage() {
      if (!selectedRushee) return
      setResolvedPhotoUrl(null)
      const { data, error } = await supabase.storage
        .from('profile-photos')
        .list(selectedRushee.id, { limit: 1, sortBy: { column: 'name', order: 'asc' } })

      if (error || !data || data.length === 0) return

      const filePath = `${selectedRushee.id}/${data[0].name}`
      const { data: urlData } = supabase.storage.from('profile-photos').getPublicUrl(filePath)
      setResolvedPhotoUrl(urlData.publicUrl)
    }

    resolveFromStorage()
  }, [selectedRushee])

  async function loadRushees() {
    try {
      setLoading(true)

      // Get all rushees
      const { data: rusheesData, error: rusheesError } = await supabase
        .from('rushees')
        .select('*')
        .order('name')

      if (rusheesError) throw rusheesError

      // Interview averages + evidence counts (submitted assignments
      // only), COALESCEd against legacy rushees columns during the
      // transition — see v_rushee_board in 20260812_v_rushee_interviews.sql.
      const { data: boardData } = await supabase
        .from('v_rushee_board')
        .select('id, professional_interview_score, professional_interview_n, casual_interview_score, casual_interview_n')
      const boardById = new Map((boardData || []).map((b: any) => [b.id, b]))

      // For each rushee, calculate their stats
      const rusheesWithStats = await Promise.all(
        (rusheesData || []).map(async (rushee: any) => {
          // Count attendance by event type
          const { data: attendance } = await supabase
            .from('event_attendance')
            .select('event_id, events(type)')
            .eq('rushee_id', rushee.id)
            .eq('status', 'approved')

          const casualEvents = attendance?.filter((a: any) => a.events?.type === 'Casual').length || 0
          const professionalEvents = attendance?.filter((a: any) => a.events?.type === 'Professional').length || 0

          // Count unique brothers who interacted with this rushee
          const { data: interactionData } = await supabase
            .from('brother_rushee_interactions')
            .select('brother_id')
            .eq('rushee_id', rushee.id)

          // Count unique brothers (a brother might interact at multiple events)
          const uniqueBrothers = new Set((interactionData || []).map((i: any) => i.brother_id))
          const interactionCount = uniqueBrothers.size

          // Count evaluations
          const { count: evaluationCount } = await supabase
            .from('evaluations')
            .select('*', { count: 'exact', head: true })
            .eq('rushee_id', rushee.id)

          const { data: evalScores } = await supabase
            .from('evaluations')
            .select('professional_score, personal_score')
            .eq('rushee_id', rushee.id)

          let avgRating: number | null = null
          if (evalScores && evalScores.length > 0) {
            // Only count evaluations with actual scores (not null/undefined/0)
            const allScores: number[] = []
            evalScores.forEach((evaluation: any) => {
              if (evaluation.professional_score != null && evaluation.professional_score > 0) {
                allScores.push(evaluation.professional_score)
              }
              if (evaluation.personal_score != null && evaluation.personal_score > 0) {
                allScores.push(evaluation.personal_score)
              }
            })

            // Calculate average only from actual scores
            if (allScores.length > 0) {
              const total = allScores.reduce((sum: number, score: number) => sum + score, 0)
              avgRating = Number((total / allScores.length).toFixed(1))
            }
          }

          // §4.3 — 'minimumsMet' is a live read of attendance, never
          // stored. R2 supplies the thresholds, so this can never
          // disagree with the progress rings or the application gate.
          const eligibility = evaluateEligibility(
            { casual: casualEvents, professional: professionalEvents, total: casualEvents + professionalEvents },
            POLICY
          )

          return {
            id: rushee.id,
            name: rushee.name,
            email: rushee.email,
            major: rushee.major,
            year: rushee.year,
            gpa: rushee.gpa ?? null,
            photo: rushee.photo ?? null,
            casualEvents,
            professionalEvents,
            interactions: interactionCount,
            evaluations: evaluationCount || 0,
            avgRating,
            minimumsMet: eligibility.minimumsMet,
            inviteOnly: rushee.invite_only ?? null,
            bidStatus: rushee.bid_status ?? null,
            professionalInterviewScore: boardById.get(rushee.id)?.professional_interview_score ?? null,
            professionalInterviewN: boardById.get(rushee.id)?.professional_interview_n ?? 0,
            casualInterviewScore: boardById.get(rushee.id)?.casual_interview_score ?? null,
            casualInterviewN: boardById.get(rushee.id)?.casual_interview_n ?? 0,
            stagedInviteOnly: undefined as boolean | null | undefined,
            stagedBidStatus: undefined as boolean | null | undefined,
          }
        })
      )

      // Hydrate staged decisions (§6.7.4). Readable by admins only, so a
      // non-admin simply gets an empty set here.
      const { data: staged } = await (supabase as any)
        .from('rushee_standing_staging')
        .select('rushee_id, staged_invite_only, staged_bid_status')

      const stagedInviteById = new Map<string, boolean>(
        (staged || [])
          .filter((row: any) => row.staged_invite_only !== null && row.staged_invite_only !== undefined)
          .map((row: any) => [row.rushee_id, row.staged_invite_only])
      )
      const stagedBidById = new Map<string, boolean>(
        (staged || [])
          .filter((row: any) => row.staged_bid_status !== null && row.staged_bid_status !== undefined)
          .map((row: any) => [row.rushee_id, row.staged_bid_status])
      )

      setRushees(
        rusheesWithStats.map((r) => ({
          ...r,
          stagedInviteOnly: stagedInviteById.has(r.id) ? stagedInviteById.get(r.id) : undefined,
          stagedBidStatus: stagedBidById.has(r.id) ? stagedBidById.get(r.id) : undefined,
        }))
      )
    } catch (error) {
      console.error('Error loading rushees:', error)
      alert('Failed to load rushees')
    } finally {
      setLoading(false)
    }
  }

  const decisionColor = (value: boolean | null | undefined) => {
    if (value === true) return 'bg-emerald-100 text-emerald-700'
    if (value === false) return 'bg-rose-100 text-rose-700'
    return 'bg-surface-sunken text-ink-muted'
  }

  /**
   * Staging only. Nothing reaches a rushee here — the value is held
   * against the row in memory and written to the admin-only
   * rushee_standing_staging table, never to rushees.invite_only (§6.7.4).
   */
  const handleInviteOnlyChange = async (rusheeId: string, triValue: string) => {
    const value = fromTriState(triValue)
    const current = rushees.find(r => r.id === rusheeId)
    if (!current) return

    setRushees(prev => prev.map(r =>
      r.id === rusheeId ? { ...r, stagedInviteOnly: value === current.inviteOnly ? undefined : value } : r
    ))

    const { data: { user } } = await supabase.auth.getUser()

    if (value === current.inviteOnly) {
      await (supabase as any)
        .from('rushee_standing_staging')
        .update({ staged_invite_only: null, staged_invite_only_by: null, staged_invite_only_at: null })
        .eq('rushee_id', rusheeId)
      return
    }

    await (supabase as any).from('rushee_standing_staging').upsert(
      {
        rushee_id: rusheeId,
        staged_invite_only: value,
        staged_invite_only_by: user?.id ?? null,
        staged_invite_only_at: new Date().toISOString(),
      },
      { onConflict: 'rushee_id' }
    )
  }

  /** Bid can only ever be staged once Invite Only has published Yes. */
  const handleBidStatusChange = async (rusheeId: string, triValue: string) => {
    const value = fromTriState(triValue)
    const current = rushees.find(r => r.id === rusheeId)
    if (!current) return

    setRushees(prev => prev.map(r =>
      r.id === rusheeId ? { ...r, stagedBidStatus: value === current.bidStatus ? undefined : value } : r
    ))

    const { data: { user } } = await supabase.auth.getUser()

    if (value === current.bidStatus) {
      await (supabase as any)
        .from('rushee_standing_staging')
        .update({ staged_bid_status: null, staged_bid_status_by: null, staged_bid_status_at: null })
        .eq('rushee_id', rusheeId)
      return
    }

    await (supabase as any).from('rushee_standing_staging').upsert(
      {
        rushee_id: rusheeId,
        staged_bid_status: value,
        staged_bid_status_by: user?.id ?? null,
        staged_bid_status_at: new Date().toISOString(),
      },
      { onConflict: 'rushee_id' }
    )
  }

  /** Only rows with at least one staged decision that differs from what is published. */
  const stagedChanges = rushees.filter(
    (r) =>
      (r.stagedInviteOnly !== undefined && r.stagedInviteOnly !== r.inviteOnly) ||
      (r.stagedBidStatus !== undefined && r.stagedBidStatus !== r.bidStatus)
  )

  const decisionLetterCount = stagedChanges.length

  const handleSave = () => {
    if (stagedChanges.length === 0) {
      alert('Nothing to publish — no decisions have been staged.')
      return
    }

    const groups: StatusChange[] = [
      {
        type: 'Invite Only — Yes',
        color: 'bg-emerald-100 text-emerald-700',
        rushees: stagedChanges.filter(r => r.stagedInviteOnly === true && r.stagedInviteOnly !== r.inviteOnly),
      },
      {
        type: 'Invite Only — No',
        color: 'bg-rose-100 text-rose-700',
        rushees: stagedChanges.filter(r => r.stagedInviteOnly === false && r.stagedInviteOnly !== r.inviteOnly),
      },
      {
        type: 'Bid — Yes',
        color: 'bg-ink text-white',
        rushees: stagedChanges.filter(r => r.stagedBidStatus === true && r.stagedBidStatus !== r.bidStatus),
      },
      {
        type: 'Bid — No',
        color: 'bg-rose-200 text-rose-700',
        rushees: stagedChanges.filter(r => r.stagedBidStatus === false && r.stagedBidStatus !== r.bidStatus),
      },
    ]

    setChanges(groups)
    setPublishConfirmText('')
    setShowConfirmation(true)
  }

  /**
   * Publication — the moment a decision becomes visible. §6.7.4:
   * "Only staged changes are written; unchanged rows are untouched."
   * The database enforces sequencing (bid only after a published invite
   * Yes) and terminality (no changes after a published No) — a rejected
   * write surfaces here as the trigger's error message.
   */
  const handleConfirmSave = async () => {
    if (publishConfirmText.trim().toUpperCase() !== 'PUBLISH') return

    try {
      setSaving(true)

      const publishedAt = new Date().toISOString()
      const { data: { user } } = await supabase.auth.getUser()

      for (const rushee of stagedChanges) {
        const updatePayload: Record<string, any> = {}
        const auditEntries: { action: string; before: any; after: any }[] = []
        const stagingClear: Record<string, any> = {}

        if (rushee.stagedInviteOnly !== undefined && rushee.stagedInviteOnly !== rushee.inviteOnly) {
          updatePayload.invite_only = rushee.stagedInviteOnly
          updatePayload.invite_only_published_at = publishedAt
          updatePayload.invite_only_published_by = user?.id ?? null
          auditEntries.push({
            action: 'invite_only.publish',
            before: { invite_only: rushee.inviteOnly },
            after: { invite_only: rushee.stagedInviteOnly },
          })
          stagingClear.staged_invite_only = null
          stagingClear.staged_invite_only_by = null
          stagingClear.staged_invite_only_at = null
        }

        if (rushee.stagedBidStatus !== undefined && rushee.stagedBidStatus !== rushee.bidStatus) {
          updatePayload.bid_status = rushee.stagedBidStatus
          updatePayload.bid_status_published_at = publishedAt
          updatePayload.bid_status_published_by = user?.id ?? null
          auditEntries.push({
            action: 'bid_status.publish',
            before: { bid_status: rushee.bidStatus },
            after: { bid_status: rushee.stagedBidStatus },
          })
          stagingClear.staged_bid_status = null
          stagingClear.staged_bid_status_by = null
          stagingClear.staged_bid_status_at = null
        }

        if (Object.keys(updatePayload).length === 0) continue

        const { error } = await (supabase as any)
          .from('rushees')
          .update(updatePayload)
          .eq('id', rushee.id)

        if (error) throw error

        // §7.6 — every publication is audited with the prior value.
        for (const entry of auditEntries) {
          await (supabase as any).from('audit_log').insert({
            actor_id: user?.id ?? null,
            entity_type: 'rushee',
            entity_id: rushee.id,
            ...entry,
          })
        }

        await (supabase as any)
          .from('rushee_standing_staging')
          .update(stagingClear)
          .eq('rushee_id', rushee.id)
      }

      setShowConfirmation(false)
      setPublishConfirmText('')
      await loadRushees()
    } catch (error: any) {
      alert(error?.message || 'Could not publish these decisions. No further changes were made.')
    } finally {
      setSaving(false)
    }
  }


  const handleDeleteClick = (rushee: RusheeWithStats) => {
    setRusheeToDelete(rushee)
    setShowDeleteModal(true)
    setDeleteConfirmText('')
  }

  const handleConfirmDelete = async () => {
    if (!rusheeToDelete || deleteConfirmText !== 'CONFIRM') {
      alert('Please type CONFIRM to delete this account')
      return
    }

    setDeleting(true)
    try {
      const rusheeId = rusheeToDelete.id

      // Delete all related data first (due to foreign key constraints)
      // Delete evaluations
      await supabase
        .from('evaluations')
        .delete()
        .eq('rushee_id', rusheeId)

      // Delete event attendance
      await supabase
        .from('event_attendance')
        .delete()
        .eq('rushee_id', rusheeId)

      // Delete brother-rushee interactions
      await supabase
        .from('brother_rushee_interactions')
        .delete()
        .eq('rushee_id', rusheeId)

      // Delete application
      await supabase
        .from('applications')
        .delete()
        .eq('rushee_id', rusheeId)

      // Delete the rushee profile
      const { error: deleteRusheeError } = await supabase
        .from('rushees')
        .delete()
        .eq('id', rusheeId)

      if (deleteRusheeError) throw deleteRusheeError

      // Delete the auth user via API route (requires service role key)
      const { data: { session } } = await supabase.auth.getSession()
      if (session?.access_token) {
        const response = await fetch('/api/admin/delete-user', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${session.access_token}`
          },
          body: JSON.stringify({ rusheeId })
        })

        if (!response.ok) {
          const errorData = await response.json()
          console.error('Error deleting auth user:', errorData)
          throw new Error(`Failed to delete auth user: ${errorData.error || 'Unknown error'}`)
        }
      } else {
        throw new Error('No active session found')
      }

      alert(`Successfully deleted ${rusheeToDelete.name}'s account`)
      setShowDeleteModal(false)
      setRusheeToDelete(null)
      setDeleteConfirmText('')

      // Reload rushees list
      await loadRushees()
    } catch (error) {
      console.error('Error deleting rushee:', error)
      alert('Failed to delete account. Please try again.')
    } finally {
      setDeleting(false)
    }
  }

  const handleRusheeClick = async (rushee: RusheeWithStats) => {
    setSelectedRushee(rushee)
    setShowEvaluationsModal(true)
    setLoadingEvaluations(true)
    setEvaluations([])

    try {
      // Fetch evaluations for this rushee
      const { data, error } = await supabase
        .from('evaluations')
        .select(`
          *,
          brother:brothers(name),
          event:events(title, type, date)
        `)
        .eq('rushee_id', rushee.id)
        .order('created_at', { ascending: false })


      if (error) {
        console.error('Supabase error:', error)
        throw error
      }

      setEvaluations(data || [])
    } catch (error) {
      console.error('Error loading evaluations:', error)
      alert('Failed to load evaluations')
    } finally {
      setLoadingEvaluations(false)
    }
  }

  return (
    <div className="min-h-screen bg-canvas">
      <AdminNav />

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between mb-8">
          <div>
            <p className="text-xs uppercase tracking-[0.35em] text-ink-subtle">Admin Standing</p>
            <div className="mt-2 flex flex-wrap items-center gap-3">
              <h1 className="text-3xl font-semibold text-ink">Rushee Standing</h1>
              <Link
                href="/admin/password-reset"
                className="text-sm font-semibold text-ink-muted hover:text-ink"
              >
                Reset Password
              </Link>
            </div>
            <p className="mt-2 text-sm text-ink-muted">Admin & Pro Access</p>
          </div>
          <div className="flex gap-3">
            <button
              onClick={handleCopyEmails}
              disabled={copyingEmails || rushees.length === 0}
              className="px-6 py-3 bg-ink text-white rounded-lg font-semibold hover:bg-ink transition-colors disabled:bg-line-strong disabled:text-ink-subtle disabled:cursor-not-allowed flex items-center gap-2"
              title="Copy all rushees' email addresses"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
              </svg>
              {copyingEmails ? 'Copying...' : 'Copy All Emails'}
            </button>
            {userAccessLevel === 'admin' && (
              <button
                onClick={handleSave}
                disabled={saving}
                className="px-6 py-3 bg-ink text-white rounded-lg font-semibold hover:bg-inverse-soft transition-colors disabled:bg-line-strong disabled:text-ink-subtle disabled:cursor-not-allowed"
              >
                {saving ? 'Saving...' : 'Publish Decisions'}
              </button>
            )}
          </div>
        </div>

        {/* Info Box */}
        <div className="bg-surface-alt border border-line rounded-2xl p-4 mb-6">
          <p className="text-ink-muted text-sm">
            {userAccessLevel === 'admin'
              ? 'Invite Only and Bid are independent decisions — Bid can only be set once Invite Only has been published Yes, and a published No is final. Changes will be confirmed before saving to the database.'
              : 'Viewing rushee decisions in read-only mode. Only administrators can modify them.'}
          </p>
        </div>

        {/* Search Bar */}
        {!loading && rushees.length > 0 && (
          <div className="mb-6">
            <div className="relative">
              <input
                type="text"
                placeholder="Search by name, email, major, or year..."
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
          </div>
        )}

        {/* Rushees Table */}
        <div className="bg-white border border-line rounded-2xl shadow-sm overflow-hidden">
          {loading ? (
            <div className="text-center py-12">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-ink mx-auto mb-4"></div>
              <p className="text-ink-muted">Loading rushees...</p>
            </div>
          ) : rushees.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-ink-muted">No rushees found</p>
            </div>
          ) : sortedRushees.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-ink-muted">No rushees found matching your search</p>
              <button
                onClick={() => setSearchQuery('')}
                className="mt-2 text-ink hover:underline text-sm"
              >
                Clear search
              </button>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-line">
                <thead className="bg-surface-alt">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs uppercase tracking-[0.2em] text-ink-subtle">Rushee</th>
                    <th className="px-6 py-3 text-center text-xs uppercase tracking-[0.2em] text-ink-subtle">Casual</th>
                    <th className="px-6 py-3 text-center text-xs uppercase tracking-[0.2em] text-ink-subtle">Professional</th>
                    <th className="px-6 py-3 text-center text-xs uppercase tracking-[0.2em] text-ink-subtle">Interactions</th>
                    <th className="px-6 py-3 text-center text-xs uppercase tracking-[0.2em] text-ink-subtle">Evals</th>
                    <th className="px-6 py-3 text-center text-xs uppercase tracking-[0.2em] text-ink-subtle">Casual Int.</th>
                    <th className="px-6 py-3 text-center text-xs uppercase tracking-[0.2em] text-ink-subtle">Prof. Int.</th>
                    <th className="px-6 py-3 text-center text-xs uppercase tracking-[0.2em] text-ink-subtle">
                      <button
                        onClick={() => setSortMode(sortMode === 'avg' ? 'alpha' : 'avg')}
                        className="inline-flex items-center gap-1 text-ink-subtle hover:text-ink-muted transition-colors"
                      >
                        Avg Rating
                        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d={sortMode === 'avg' ? 'M5 15l7-7 7 7' : 'M19 9l-7 7-7-7'}
                          />
                        </svg>
                      </button>
                    </th>
                    <th className="px-6 py-3 text-left text-xs uppercase tracking-[0.2em] text-ink-subtle">Invite Only</th>
                    <th className="px-6 py-3 text-left text-xs uppercase tracking-[0.2em] text-ink-subtle">Bid</th>
                    {userAccessLevel === 'admin' && (
                      <th className="px-6 py-3 text-center text-xs uppercase tracking-[0.2em] text-ink-subtle">Actions</th>
                    )}
                  </tr>
                </thead>
                <tbody className="divide-y divide-line">
                  {sortedRushees.map((rushee) => (
                  <tr key={rushee.id} className="hover:bg-surface-alt">
                    <td className="px-6 py-4">
                      <button
                        onClick={() => handleRusheeClick(rushee)}
                        className="text-ink font-semibold hover:text-ink-muted transition-colors text-left"
                      >
                        {rushee.name}
                      </button>
                    </td>
                    <td className="px-6 py-4 text-center text-ink-muted">{rushee.casualEvents}</td>
                    <td className="px-6 py-4 text-center text-ink-muted">{rushee.professionalEvents}</td>
                    <td className="px-6 py-4 text-center text-ink-muted">{rushee.interactions}</td>
                    <td className="px-6 py-4 text-center text-ink-muted">{rushee.evaluations}</td>
                    <td className="px-6 py-4 text-center text-ink-muted">
                      {rushee.casualInterviewScore !== null ? (
                        <>
                          {rushee.casualInterviewScore}/10
                          {rushee.casualInterviewN > 0 && <span className="text-ink-faint text-xs"> (n={rushee.casualInterviewN})</span>}
                        </>
                      ) : '—'}
                    </td>
                    <td className="px-6 py-4 text-center text-ink-muted">
                      {rushee.professionalInterviewScore !== null ? (
                        <>
                          {rushee.professionalInterviewScore}/20
                          {rushee.professionalInterviewN > 0 && <span className="text-ink-faint text-xs"> (n={rushee.professionalInterviewN})</span>}
                        </>
                      ) : '—'}
                    </td>
                    <td className="px-6 py-4 text-center text-ink-muted">{rushee.avgRating ?? '—'}</td>
                    <td className="px-6 py-4">
                      <p className="text-[11px] uppercase tracking-wider text-ink-faint mb-1">
                        {rushee.inviteOnly === null && rushee.minimumsMet ? 'Minimums met' : 'Published'}
                      </p>
                      <select
                        value={toTriState(rushee.stagedInviteOnly !== undefined ? rushee.stagedInviteOnly : rushee.inviteOnly)}
                        onChange={(e) => handleInviteOnlyChange(rushee.id, e.target.value)}
                        disabled={userAccessLevel === 'pro' || rushee.inviteOnly === false}
                        aria-label={`Staged Invite Only decision for ${rushee.name}`}
                        className={`px-3 py-2 rounded-lg font-semibold text-sm border focus:outline-none focus:ring-2 focus:ring-ink ${
                          userAccessLevel === 'pro' || rushee.inviteOnly === false
                            ? 'cursor-not-allowed opacity-60 border-transparent'
                            : 'cursor-pointer'
                        } ${
                          rushee.stagedInviteOnly !== undefined && rushee.stagedInviteOnly !== rushee.inviteOnly
                            ? 'border-ink border-dashed'
                            : 'border-transparent'
                        } ${decisionColor(rushee.stagedInviteOnly !== undefined ? rushee.stagedInviteOnly : rushee.inviteOnly)}`}
                      >
                        <option value="undecided">Undecided</option>
                        <option value="yes">Yes</option>
                        <option value="no">No</option>
                      </select>
                    </td>
                    <td className="px-6 py-4">
                      <select
                        value={toTriState(rushee.stagedBidStatus !== undefined ? rushee.stagedBidStatus : rushee.bidStatus)}
                        onChange={(e) => handleBidStatusChange(rushee.id, e.target.value)}
                        disabled={
                          userAccessLevel === 'pro' ||
                          rushee.bidStatus === false ||
                          (rushee.stagedInviteOnly !== undefined ? rushee.stagedInviteOnly !== true : rushee.inviteOnly !== true)
                        }
                        aria-label={`Staged Bid decision for ${rushee.name}`}
                        title={rushee.inviteOnly !== true ? 'Invite Only must be published Yes first' : undefined}
                        className={`px-3 py-2 rounded-lg font-semibold text-sm border focus:outline-none focus:ring-2 focus:ring-ink ${
                          userAccessLevel === 'pro' ||
                          rushee.bidStatus === false ||
                          (rushee.stagedInviteOnly !== undefined ? rushee.stagedInviteOnly !== true : rushee.inviteOnly !== true)
                            ? 'cursor-not-allowed opacity-60 border-transparent'
                            : 'cursor-pointer'
                        } ${
                          rushee.stagedBidStatus !== undefined && rushee.stagedBidStatus !== rushee.bidStatus
                            ? 'border-ink border-dashed'
                            : 'border-transparent'
                        } ${decisionColor(rushee.stagedBidStatus !== undefined ? rushee.stagedBidStatus : rushee.bidStatus)}`}
                      >
                        <option value="undecided">Undecided</option>
                        <option value="yes">Yes</option>
                        <option value="no">No</option>
                      </select>
                    </td>
                    {userAccessLevel === 'admin' && (
                      <td className="px-6 py-4 text-center">
                        <button
                          onClick={() => handleDeleteClick(rushee)}
                          className="px-3 py-1 bg-rose-600 text-white text-xs rounded-lg font-semibold hover:bg-rose-700 transition-colors"
                        >
                          Delete
                        </button>
                      </td>
                    )}
                  </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Confirmation Modal */}
        {showConfirmation && (
          <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <div className="bg-white border border-line rounded-2xl p-6 max-w-2xl w-full max-h-[80vh] overflow-y-auto shadow-xl">
              <h2 className="text-2xl font-semibold text-ink mb-2">Publish Decisions</h2>
              <p className="text-ink-muted mb-6">
                Review every staged change before publishing. Nothing has reached a rushee yet.
              </p>

              <div className="space-y-4 mb-6">
                {changes.filter(c => c.rushees.length > 0).map((change) => (
                  <div key={change.type} className="bg-surface-alt border border-line rounded-2xl p-4">
                    <h3 className={`font-semibold mb-2 px-3 py-1 rounded-lg inline-block ${change.color}`}>
                      {change.type} ({change.rushees.length})
                    </h3>
                    <ul className="mt-2 space-y-1">
                      {change.rushees.map((rushee: any) => (
                        <li key={rushee.id} className="text-ink-muted text-sm ml-4">
                          {rushee.name}
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>

              <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 mb-5">
                <p className="text-amber-900 text-sm font-semibold">
                  {decisionLetterCount} {decisionLetterCount === 1 ? 'rushee' : 'rushees'} will see
                  an updated decision letter in the app.
                </p>
                <p className="text-amber-800 text-sm mt-2">
                  Publication is visible immediately and cannot be unseen. Rejections are terminal —
                  a rejected rushee receives one letter and no further updates.
                </p>
              </div>

              <div className="mb-6">
                <label className="block text-sm font-semibold text-ink mb-2" htmlFor="publish-confirm">
                  Type PUBLISH to confirm
                </label>
                <input
                  id="publish-confirm"
                  value={publishConfirmText}
                  onChange={(e) => setPublishConfirmText(e.target.value)}
                  placeholder="PUBLISH"
                  autoComplete="off"
                  className="w-full px-4 py-2.5 border border-line-strong rounded-lg focus:outline-none focus:ring-2 focus:ring-ink"
                />
              </div>

              <div className="flex gap-3">
                <button
                  onClick={() => setShowConfirmation(false)}
                  disabled={saving}
                  className="flex-1 py-3 bg-line text-ink rounded-lg font-semibold hover:bg-line-strong transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Cancel
                </button>
                <button
                  onClick={handleConfirmSave}
                  disabled={saving || publishConfirmText.trim().toUpperCase() !== 'PUBLISH'}
                  className="flex-1 py-3 bg-ink text-white rounded-lg font-semibold hover:bg-inverse-soft transition-colors disabled:bg-line-strong disabled:text-ink-subtle disabled:cursor-not-allowed"
                >
                  {saving ? 'Publishing...' : 'Publish Decisions'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Evaluations Modal */}
        {showEvaluationsModal && selectedRushee && (
          <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <div className="bg-white border border-line rounded-2xl p-6 max-w-4xl w-full max-h-[80vh] overflow-y-auto shadow-xl">
              <div className="flex justify-between items-start mb-6">
                <div>
                  <h2 className="text-2xl font-semibold text-ink">{selectedRushee.name}</h2>
                  <p className="text-ink-muted">All Evaluations</p>
                </div>
                <button
                  onClick={() => setShowEvaluationsModal(false)}
                  className="text-ink-muted hover:text-ink text-2xl font-bold"
                >
                  x
                </button>
              </div>

              <div className="flex flex-col gap-4 mb-6 sm:flex-row sm:items-center">
                <div className="h-24 w-24 rounded-full border border-line bg-surface-sunken flex items-center justify-center overflow-hidden text-3xl text-ink-muted">
                  {resolvedPhotoUrl ? (
                    <img src={resolvedPhotoUrl} alt={selectedRushee.name} className="h-full w-full object-cover" />
                  ) : (
                    <span>{selectedRushee.photo || '👤'}</span>
                  )}
                </div>
                <div className="grid grid-cols-1 gap-x-8 gap-y-2 text-sm text-ink-muted sm:grid-cols-2">
                  <div>
                    <span className="text-ink-subtle">Email</span>
                    <p className="font-medium text-ink">{selectedRushee.email || 'N/A'}</p>
                  </div>
                  <div>
                    <span className="text-ink-subtle">Major</span>
                    <p className="font-medium text-ink">{selectedRushee.major || 'Undeclared'}</p>
                  </div>
                  <div>
                    <span className="text-ink-subtle">Year</span>
                    <p className="font-medium text-ink">{selectedRushee.year || 'N/A'}</p>
                  </div>
                  <div>
                    <span className="text-ink-subtle">GPA</span>
                    <p className="font-medium text-ink">{selectedRushee.gpa ?? 'N/A'}</p>
                  </div>
                </div>
              </div>

              {loadingEvaluations ? (
                <div className="text-center py-12">
                  <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-ink mx-auto mb-4"></div>
                  <p className="text-ink-muted">Loading evaluations...</p>
                </div>
              ) : evaluations.length === 0 ? (
                <div className="text-center py-12">
                  <p className="text-ink-muted">No evaluations yet for this rushee.</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {evaluations.map((evaluation: any, index: number) => (
                    <div key={evaluation.id || index} className="bg-surface-alt border border-line rounded-2xl p-4">
                      <div className="flex justify-between items-start mb-3">
                        <div>
                          <p className="font-semibold text-ink">
                            {evaluation.brother?.name || 'Anonymous'}
                          </p>
                          <p className="text-sm text-ink-muted">
                            {evaluation.event?.title} ({evaluation.event?.type}) - {new Date(evaluation.event?.date).toLocaleDateString()}
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

        {/* Delete Confirmation Modal */}
        {showDeleteModal && rusheeToDelete && (
          <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <div className="bg-white border border-line rounded-2xl p-6 max-w-md w-full shadow-xl">
              <h2 className="text-2xl font-semibold text-ink mb-4">Delete Account</h2>

              <div className="bg-rose-50 border border-rose-200 rounded-2xl p-4 mb-4">
                <p className="text-rose-800 text-sm font-semibold mb-2">
                  ⚠️ Warning: This action cannot be undone!
                </p>
                <p className="text-rose-700 text-sm">
                  This will permanently delete <span className="font-semibold">{rusheeToDelete.name}'s</span> account and all associated data including:
                </p>
                <ul className="text-rose-700 text-sm mt-2 ml-4 list-disc">
                  <li>Profile information</li>
                  <li>Application</li>
                  <li>Event attendance records</li>
                  <li>Evaluations</li>
                  <li>Brother interactions</li>
                </ul>
              </div>

              <div className="mb-6">
                <label className="block text-sm font-semibold text-ink mb-2">
                  Type <span className="font-mono bg-surface-sunken px-2 py-0.5 rounded">CONFIRM</span> to delete this account:
                </label>
                <input
                  type="text"
                  value={deleteConfirmText}
                  onChange={(e) => setDeleteConfirmText(e.target.value)}
                  className="w-full px-4 py-2 border-2 border-line-strong rounded-lg focus:outline-none focus:ring-2 focus:ring-rose-500 focus:border-transparent"
                  placeholder="Type CONFIRM"
                  autoFocus
                />
              </div>

              <div className="flex gap-3">
                <button
                  onClick={() => {
                    setShowDeleteModal(false)
                    setRusheeToDelete(null)
                    setDeleteConfirmText('')
                  }}
                  disabled={deleting}
                  className="flex-1 py-3 bg-line text-ink rounded-lg font-semibold hover:bg-line-strong transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Cancel
                </button>
                <button
                  onClick={handleConfirmDelete}
                  disabled={deleting || deleteConfirmText !== 'CONFIRM'}
                  className="flex-1 py-3 bg-rose-600 text-white rounded-lg font-semibold hover:bg-rose-700 transition-colors disabled:bg-rose-300 disabled:cursor-not-allowed"
                >
                  {deleting ? 'Deleting...' : 'Delete Account'}
                </button>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  )
}

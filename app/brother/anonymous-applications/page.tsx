'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import BrotherNav from '@/components/brother/BrotherNav'
import { useAuth } from '@/contexts/AuthContext'
import { supabase } from '@/lib/supabase'

type AnonymousApplication = {
  id: string
  created_at: string | null
  pronouns: string | null
  major: string | null
  minor: string | null
  gpa: string | null
  expected_graduation_date: string | null
  outside_involvements: string | null
  how_heard_about_akpsi: string | null
  why_interested: string | null
  pillar_relation: string | null
  brother_connection_reason: string | null
  monopoly_piece: string | null
  monopoly_theme_lesson: string | null
}

const EMPTY_TEXT = 'Not answered'

export default function AnonymousApplicationsPage() {
  const router = useRouter()
  const { profile, roles, refreshRoles } = useAuth()
  const [applications, setApplications] = useState<AnonymousApplication[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [currentIndex, setCurrentIndex] = useState(0)
  const [rolesChecked, setRolesChecked] = useState(false)

  const hasAccess = useMemo(() => {
    if (!profile || profile.account_type !== 'brother') return false
    if (profile.access_level === 'admin' || profile.access_level === 'recruitment') return true
    return roles.includes('recruitment_director')
  }, [profile, roles])

  useEffect(() => {
    let mounted = true

    async function ensureRoles() {
      if (!profile || profile.account_type !== 'brother') return
      if (profile.access_level === 'admin' || profile.access_level === 'recruitment') {
        if (mounted) setRolesChecked(true)
        return
      }
      await refreshRoles()
      if (mounted) setRolesChecked(true)
    }

    ensureRoles()

    return () => {
      mounted = false
    }
  }, [profile])

  useEffect(() => {
    if (!profile || !rolesChecked) return
    if (!hasAccess) {
      router.push('/brother/dashboard')
    }
  }, [hasAccess, profile, rolesChecked, router])

  useEffect(() => {
    if (!hasAccess) return

    async function loadApplications() {
      try {
        setLoading(true)
        const { data, error: fetchError } = await supabase
          .from('applications')
          .select(`
            id,
            created_at,
            pronouns,
            major,
            minor,
            gpa,
            expected_graduation_date,
            outside_involvements,
            how_heard_about_akpsi,
            why_interested,
            pillar_relation,
            brother_connection_reason,
            monopoly_piece,
            monopoly_theme_lesson
          `)
          .eq('is_submitted', true)
          .order('created_at', { ascending: true })

        if (fetchError) throw fetchError

        setApplications((data as AnonymousApplication[]) || [])
        setCurrentIndex(0)
        setError(null)
      } catch (fetchError) {
        console.error('Error loading anonymous applications:', fetchError)
        setError('Failed to load applications.')
      } finally {
        setLoading(false)
      }
    }

    loadApplications()
  }, [hasAccess])

  const currentApplication = applications[currentIndex]
  const total = applications.length
  const hasPrev = currentIndex > 0
  const hasNext = currentIndex < total - 1

  return (
    <div className="min-h-screen bg-canvas">
      <BrotherNav />

      <main className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-3xl font-semibold text-ink">Anonymous Applications</h1>
            <p className="text-ink-muted mt-1">Review one submitted application at a time with identifying info hidden.</p>
          </div>
          <div className="rounded-full bg-inverse text-on-inverse px-4 py-2 text-sm font-semibold w-fit">
            Directors of Recruitment Access
          </div>
        </div>

        <div className="mt-8 bg-surface rounded-2xl shadow-sm border border-line p-6">
          {loading ? (
            <div className="text-ink-muted">Loading applications...</div>
          ) : error ? (
            <div className="text-red-600">{error}</div>
          ) : total === 0 ? (
            <div className="text-ink-muted">No submitted applications yet.</div>
          ) : (
            <>
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <div className="text-sm text-ink-subtle">
                  Application {currentIndex + 1} of {total}
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setCurrentIndex((index) => Math.max(0, index - 1))}
                    disabled={!hasPrev}
                    className={`px-3 py-2 rounded-lg text-sm font-semibold border transition-colors ${
                      hasPrev
                        ? 'border-line-strong text-ink-muted hover:bg-surface-sunken'
                        : 'border-line text-line-strong cursor-not-allowed'
                    }`}
                  >
                    Previous
                  </button>
                  <button
                    type="button"
                    onClick={() => setCurrentIndex((index) => Math.min(total - 1, index + 1))}
                    disabled={!hasNext}
                    className={`px-3 py-2 rounded-lg text-sm font-semibold border transition-colors ${
                      hasNext
                        ? 'border-inverse bg-inverse text-on-inverse hover:bg-inverse-soft'
                        : 'border-line text-line-strong cursor-not-allowed'
                    }`}
                  >
                    Next
                  </button>
                </div>
              </div>

              <div className="mt-6 grid gap-6">
                <section className="grid gap-4 sm:grid-cols-2">
                  <div className="rounded-xl border border-line bg-surface-alt p-4">
                    <div className="text-xs uppercase tracking-wide text-ink-subtle font-semibold">Submitted</div>
                    <div className="text-ink font-semibold mt-1">
                      {currentApplication?.created_at ? new Date(currentApplication.created_at).toLocaleString() : 'Unknown'}
                    </div>
                  </div>
                  <div className="rounded-xl border border-line bg-surface-alt p-4">
                    <div className="text-xs uppercase tracking-wide text-ink-subtle font-semibold">Pronouns</div>
                    <div className="text-ink font-semibold mt-1">{currentApplication?.pronouns || EMPTY_TEXT}</div>
                  </div>
                  <div className="rounded-xl border border-line bg-surface-alt p-4">
                    <div className="text-xs uppercase tracking-wide text-ink-subtle font-semibold">Major</div>
                    <div className="text-ink font-semibold mt-1">{currentApplication?.major || EMPTY_TEXT}</div>
                  </div>
                  <div className="rounded-xl border border-line bg-surface-alt p-4">
                    <div className="text-xs uppercase tracking-wide text-ink-subtle font-semibold">Minor</div>
                    <div className="text-ink font-semibold mt-1">{currentApplication?.minor || EMPTY_TEXT}</div>
                  </div>
                  <div className="rounded-xl border border-line bg-surface-alt p-4">
                    <div className="text-xs uppercase tracking-wide text-ink-subtle font-semibold">GPA</div>
                    <div className="text-ink font-semibold mt-1">{currentApplication?.gpa || EMPTY_TEXT}</div>
                  </div>
                  <div className="rounded-xl border border-line bg-surface-alt p-4">
                    <div className="text-xs uppercase tracking-wide text-ink-subtle font-semibold">Expected Graduation</div>
                    <div className="text-ink font-semibold mt-1">{currentApplication?.expected_graduation_date || EMPTY_TEXT}</div>
                  </div>
                </section>

                <section className="grid gap-4">
                  <div className="rounded-xl border border-line bg-surface p-5">
                    <h2 className="text-base font-semibold text-ink">Outside Involvements</h2>
                    <p className="text-ink-muted mt-2 whitespace-pre-wrap">{currentApplication?.outside_involvements || EMPTY_TEXT}</p>
                  </div>
                  <div className="rounded-xl border border-line bg-surface p-5">
                    <h2 className="text-base font-semibold text-ink">How They Heard About AKPsi</h2>
                    <p className="text-ink-muted mt-2 whitespace-pre-wrap">{currentApplication?.how_heard_about_akpsi || EMPTY_TEXT}</p>
                  </div>
                  <div className="rounded-xl border border-line bg-surface p-5">
                    <h2 className="text-base font-semibold text-ink">Why They&apos;re Interested</h2>
                    <p className="text-ink-muted mt-2 whitespace-pre-wrap">{currentApplication?.why_interested || EMPTY_TEXT}</p>
                  </div>
                  <div className="rounded-xl border border-line bg-surface p-5">
                    <h2 className="text-base font-semibold text-ink">Pillar Relation</h2>
                    <p className="text-ink-muted mt-2 whitespace-pre-wrap">{currentApplication?.pillar_relation || EMPTY_TEXT}</p>
                  </div>
                  <div className="rounded-xl border border-line bg-surface p-5">
                    <h2 className="text-base font-semibold text-ink">Brother Connection</h2>
                    <p className="text-ink-muted mt-2 whitespace-pre-wrap">{currentApplication?.brother_connection_reason || EMPTY_TEXT}</p>
                  </div>
                  <div className="rounded-xl border border-line bg-surface p-5">
                    <h2 className="text-base font-semibold text-ink">Monopoly Piece</h2>
                    <p className="text-ink-muted mt-2 whitespace-pre-wrap">{currentApplication?.monopoly_piece || EMPTY_TEXT}</p>
                  </div>
                  <div className="rounded-xl border border-line bg-surface p-5">
                    <h2 className="text-base font-semibold text-ink">Monopoly Theme Lesson</h2>
                    <p className="text-ink-muted mt-2 whitespace-pre-wrap">{currentApplication?.monopoly_theme_lesson || EMPTY_TEXT}</p>
                  </div>
                </section>
              </div>
            </>
          )}
        </div>
      </main>
    </div>
  )
}

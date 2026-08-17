'use client'

import BrotherNav from '@/components/brother/BrotherNav'
import RusheePhoto from '@/components/RusheePhoto'
import { useParams, useRouter, useSearchParams } from 'next/navigation'
import { useState, useEffect, useCallback } from 'react'
import { getRushee, createOrUpdateEvaluation, getEvaluation, getPersonalNotes, hasMetRusheeAtEvent } from '@/lib/api'
import { getEventById } from '@/lib/database'
import {
  POLICY,
  loadPolicy,
  PROFESSIONAL_LABELS,
  PERSONAL_LABELS,
  CATEGORY_DESCRIPTIONS,
  evaluationAverage,
  toProfessionalRating,
  type ProfessionalRating,
} from '@/lib/policy'

/**
 * Evaluation form — PRD §6.4.5.
 *
 * The important correction here is R23: a professional rating has three
 * distinct states — not yet rated, deliberately N/A, and a score of 1–5.
 * This form previously initialised `professional: 0`, which meant every
 * evaluation a brother submitted without touching the professional row
 * was recorded as "N/A — can't speak to professionalism" and rendered
 * with that option already highlighted. Downstream, the events page then
 * flagged those same evaluations as "awaiting professional score" and
 * nagged brothers to fix evaluations they had already completed.
 *
 * Neither score is pre-selected now. N/A is an explicit choice, stored as
 * `professional_na`, distinct from `professional_score IS NULL`.
 */

type ProfessionalChoice = 'unrated' | 'na' | number

export default function EvaluateRushee() {
  const params = useParams()
  const router = useRouter()
  const searchParams = useSearchParams()
  const rusheeId = params.id as string
  const eventId = searchParams.get('event')
  const returnTo = searchParams.get('return')

  const [professional, setProfessional] = useState<ProfessionalChoice>('unrated')
  const [personal, setPersonal] = useState<number | null>(null)
  const [knowsPersonally, setKnowsPersonally] = useState(false)
  const [qualities, setQualities] = useState<string[]>([])
  const [comments, setComments] = useState('')

  const [rushee, setRushee] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [isUpdate, setIsUpdate] = useState(false)
  const [personalNotes, setPersonalNotes] = useState('')
  const [error, setError] = useState('')
  const [dirty, setDirty] = useState(false)
  const [policy, setPolicy] = useState(POLICY)

  const commentLimit = policy.evaluation.commentCharLimit

  useEffect(() => {
    loadPolicy().then(setPolicy)
  }, [])

  useEffect(() => {
    let cancelled = false

    async function loadData() {
      try {
        const [rusheeData, notes, existing] = await Promise.all([
          getRushee(rusheeId),
          getPersonalNotes(rusheeId),
          getEvaluation(rusheeId),
        ])

        if (cancelled) return

        // A brother may only create a first-time evaluation for a rushee
        // they've met during an event currently in its evaluation phase.
        // Editing an existing evaluation is unrestricted — allowed anytime.
        if (!existing) {
          if (!eventId) {
            setError('You can only create a new evaluation through the Events flow — mark this rushee as met first.')
            setLoading(false)
            return
          }
          const { data: event, error: eventError } = await getEventById(eventId)
          if (eventError || !event) {
            setError('Could not load this event.')
            setLoading(false)
            return
          }
          if ((event as any).status !== 'evaluation') {
            setError('Evaluations are not currently open for this event.')
            setLoading(false)
            return
          }
          const met = await hasMetRusheeAtEvent(rusheeId, eventId)
          if (!met) {
            setError('Mark this rushee as met at this event before evaluating them.')
            setLoading(false)
            return
          }
        }

        setRushee(rusheeData)
        setPersonalNotes(notes || '')

        if (existing) {
          setIsUpdate(true)
          const rating = toProfessionalRating(
            (existing as any).professional_score,
            (existing as any).professional_na
          )
          setProfessional(
            rating.kind === 'scored' ? rating.score : rating.kind === 'na' ? 'na' : 'unrated'
          )
          setPersonal(existing.personal_score ?? null)
          setKnowsPersonally(Boolean(existing.knows_personally))
          setQualities(Array.isArray(existing.qualities) ? existing.qualities : [])
          setComments(existing.comments || '')
        }
      } catch {
        if (!cancelled) setError('Could not load this rushee.')
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    loadData()
    return () => {
      cancelled = true
    }
  }, [rusheeId, eventId])

  /** PRD §6.4.1 — unsaved-work guard. */
  useEffect(() => {
    if (!dirty) return
    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault()
      e.returnValue = ''
    }
    window.addEventListener('beforeunload', handler)
    return () => window.removeEventListener('beforeunload', handler)
  }, [dirty])

  const touch = useCallback(() => setDirty(true), [])

  const professionalRating: ProfessionalRating =
    professional === 'unrated'
      ? { kind: 'unrated' }
      : professional === 'na'
        ? { kind: 'na' }
        : { kind: 'scored', score: professional }

  const average = evaluationAverage(professionalRating, personal)

  function goBack() {
    if (returnTo === 'events' && eventId) {
      router.push(`/brother/events?evaluating=${eventId}&refresh=${Date.now()}`)
    } else if (returnTo === 'dashboard') {
      router.push('/brother/dashboard')
    } else {
      router.push('/brother/rushees')
    }
  }

  function cancel() {
    if (dirty && !confirm('Discard your unsaved changes to this evaluation?')) return
    setDirty(false)
    router.back()
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')

    // R23 — personal score is required.
    if (personal === null) {
      setError('Select a Personal score before submitting.')
      return
    }

    if (comments.length > commentLimit) {
      setError(`Comments are limited to ${commentLimit} characters.`)
      return
    }

    setSaving(true)

    try {
      // R31 — re-verify the window immediately before writing. Only
      // applies to first-time creation; updating an existing evaluation
      // is allowed anytime regardless of event phase.
      if (!isUpdate) {
        if (!eventId) {
          setError('You can only create a new evaluation through the Events flow — mark this rushee as met first.')
          setSaving(false)
          return
        }
        const { data: event, error: eventError } = await getEventById(eventId)
        if (eventError || !event || (event as any).status !== 'evaluation') {
          setError('Evaluations are no longer open for this event.')
          setSaving(false)
          return
        }
        const met = await hasMetRusheeAtEvent(rusheeId, eventId)
        if (!met) {
          setError('Mark this rushee as met at this event before evaluating them.')
          setSaving(false)
          return
        }
      }

      await createOrUpdateEvaluation(
        rusheeId,
        {
          professional_score: professionalRating.kind === 'scored' ? professionalRating.score : null,
          professional_na: professionalRating.kind === 'na',
          personal_score: personal,
          knows_personally: knowsPersonally,
          qualities,
          comments,
        },
        eventId || undefined
      )

      setDirty(false)
      goBack()
    } catch {
      setError('Could not save the evaluation. Please try again.')
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="app-shell">
        <BrotherNav />
        <main className="app-container max-w-3xl py-8">
          <div className="card">
            <div className="state-block">
              <div className="h-8 w-8 rounded-full border-2 border-line-strong border-t-ink animate-spin" />
            </div>
          </div>
        </main>
      </div>
    )
  }

  if (error && !rushee) {
    return (
      <div className="app-shell">
        <BrotherNav />
        <main className="app-container max-w-3xl py-8">
          <div className="card">
            <div className="state-block">
              <p className="state-title">Not available</p>
              <p className="state-body">{error}</p>
              <button onClick={() => router.push('/brother/events')} className="btn btn-secondary btn-sm mt-5">
                Back to events
              </button>
            </div>
          </div>
        </main>
      </div>
    )
  }

  return (
    <div className="app-shell">
      <BrotherNav />

      <main className="app-container max-w-3xl py-8">
        <button onClick={cancel} className="btn btn-ghost btn-sm -ml-3 mb-4">
          ← Back
        </button>

        <header className="mb-6">
          <p className="page-eyebrow">Evaluation</p>
          <h1 className="page-title mt-1">{isUpdate ? 'Update Evaluation' : 'Evaluate Rushee'}</h1>
        </header>

        <div className="card card-pad flex items-center gap-4 mb-5">
          <div className="w-14 h-14 rounded-full overflow-hidden bg-surface-sunken flex items-center justify-center shrink-0">
            <RusheePhoto
              photo={rushee?.photo}
              alt=""
              className="w-full h-full object-cover rushee-photo"
              fallback={<span className="text-ink-faint text-lg">{(rushee?.name || '?').slice(0, 1)}</span>}
            />
          </div>
          <div className="min-w-0">
            <p className="section-title truncate">{rushee?.name}</p>
            <p className="text-sm text-ink-subtle truncate">
              {[rushee?.major, rushee?.year].filter(Boolean).join(' • ') || 'Details not provided'}
            </p>
          </div>
        </div>

        {personalNotes && (
          <div className="card card-pad mb-5">
            <p className="page-eyebrow">Your notes about this rushee</p>
            <p className="mt-2 text-sm text-ink-muted whitespace-pre-wrap leading-relaxed">
              {personalNotes}
            </p>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-5" onChange={touch}>
          {/* A · Rate the following categories */}
          <section className="card card-pad">
            <h2 className="section-title mb-5">Rate the following categories</h2>

            {/* Professional — 0–5, where 0 is an explicit N/A (R23, R24) */}
            <div className="mb-7">
              <div className="flex items-baseline justify-between gap-3">
                <label className="field-label mb-0">Professional</label>
                {professional === 'unrated' && (
                  <span className="text-xs text-ink-subtle">Not yet rated</span>
                )}
              </div>
              <p className="field-help mb-3">{CATEGORY_DESCRIPTIONS.professional}</p>

              <div className="grid grid-cols-6 gap-1.5">
                <button
                  type="button"
                  onClick={() => {
                    setProfessional('na')
                    touch()
                  }}
                  aria-pressed={professional === 'na'}
                  className={`py-2.5 rounded-lg text-sm font-semibold border transition-colors ${
                    professional === 'na'
                      ? 'bg-inverse text-on-inverse border-inverse'
                      : 'bg-surface text-ink-muted border-line-strong hover:border-ink-faint'
                  }`}
                >
                  0
                </button>
                {[1, 2, 3, 4, 5].map((num) => (
                  <button
                    key={num}
                    type="button"
                    onClick={() => {
                      setProfessional(num)
                      touch()
                    }}
                    aria-pressed={professional === num}
                    className={`py-2.5 rounded-lg text-sm font-semibold border transition-colors ${
                      professional === num
                        ? 'bg-inverse text-on-inverse border-inverse'
                        : 'bg-surface text-ink-muted border-line-strong hover:border-ink-faint'
                    }`}
                  >
                    {num}
                  </button>
                ))}
              </div>

              <div className="mt-2.5 rounded-lg border border-line bg-surface-alt px-3 py-2.5 text-center">
                <span className="text-sm text-ink-muted">
                  {professional === 'unrated'
                    ? 'Optional — leave this blank if you have not rated it yet'
                    : professional === 'na'
                      ? PROFESSIONAL_LABELS[0]
                      : PROFESSIONAL_LABELS[professional]}
                </span>
              </div>
            </div>

            {/* Personal — 1–5, required (R23, R25) */}
            <div>
              <div className="flex items-baseline justify-between gap-3">
                <label className="field-label mb-0">
                  Personal <span className="text-negative">*</span>
                </label>
                {personal === null && <span className="text-xs text-negative">Required</span>}
              </div>
              <p className="field-help mb-3">{CATEGORY_DESCRIPTIONS.personal}</p>

              <div className="grid grid-cols-5 gap-1.5">
                {[1, 2, 3, 4, 5].map((num) => (
                  <button
                    key={num}
                    type="button"
                    onClick={() => {
                      setPersonal(num)
                      touch()
                    }}
                    aria-pressed={personal === num}
                    className={`py-2.5 rounded-lg text-sm font-semibold border transition-colors ${
                      personal === num
                        ? 'bg-inverse text-on-inverse border-inverse'
                        : 'bg-surface text-ink-muted border-line-strong hover:border-ink-faint'
                    }`}
                  >
                    {num}
                  </button>
                ))}
              </div>

              <div
                className={`mt-2.5 rounded-lg border px-3 py-2.5 text-center ${
                  personal === null
                    ? 'border-negative/25 bg-negative-soft'
                    : 'border-line bg-surface-alt'
                }`}
              >
                <span className={`text-sm ${personal === null ? 'text-negative' : 'text-ink-muted'}`}>
                  {personal === null ? 'Please select a rating' : PERSONAL_LABELS[personal]}
                </span>
              </div>
            </div>
          </section>

          {/* B · Overall average (R30) — display only */}
          <section className="card card-pad bg-surface-alt">
            <p className="page-eyebrow text-center">Overall average</p>
            <p className="mt-2 text-center text-4xl font-semibold tracking-tight tabular-nums">
              {average.value === null ? '—' : average.value.toFixed(1)}
            </p>
            <p className="mt-1 text-center text-xs text-ink-subtle">
              {average.value === null
                ? 'Select a Personal score'
                : average.personalOnly
                  ? professional === 'na'
                    ? 'Personal only (Professional: N/A)'
                    : 'Personal only (Professional not rated)'
                  : 'out of 5'}
            </p>
          </section>

          {/* C · Personal acquaintance (R28) */}
          <section className="card card-pad">
            <label className="flex items-center justify-between gap-4 cursor-pointer">
              <div>
                <h2 className="section-title">Do you personally know this rushee?</h2>
                <p className="field-help">
                  Toggle if you have a personal relationship outside of recruitment events.
                </p>
              </div>
              <span className="relative shrink-0">
                <input
                  type="checkbox"
                  checked={knowsPersonally}
                  onChange={(e) => {
                    setKnowsPersonally(e.target.checked)
                    touch()
                  }}
                  className="sr-only"
                />
                <span
                  className={`flex w-13 h-7 items-center rounded-full px-1 transition-colors ${
                    knowsPersonally ? 'bg-inverse' : 'bg-line-strong'
                  }`}
                  style={{ width: '3.25rem' }}
                >
                  <span
                    className={`h-5 w-5 rounded-full bg-surface shadow-sm transition-transform ${
                      knowsPersonally ? 'translate-x-6' : 'translate-x-0'
                    }`}
                  />
                </span>
              </span>
            </label>
          </section>

          {/* D · Qualities (R27) */}
          <section className="card card-pad">
            <h2 className="section-title">What qualities do you see in this rushee?</h2>
            <p className="field-help mb-4">Select all that apply</p>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {policy.evaluation.qualities.map((quality) => {
                const selected = qualities.includes(quality)
                return (
                  <label
                    key={quality}
                    className={`flex items-center justify-center px-3 py-2.5 rounded-lg border text-sm font-medium cursor-pointer transition-colors text-center ${
                      selected
                        ? 'bg-inverse text-on-inverse border-inverse'
                        : 'bg-surface text-ink-muted border-line-strong hover:border-ink-faint'
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={selected}
                      onChange={(e) => {
                        setQualities((prev) =>
                          e.target.checked ? [...prev, quality] : prev.filter((q) => q !== quality)
                        )
                        touch()
                      }}
                      className="sr-only"
                    />
                    {quality}
                  </label>
                )
              })}
            </div>
          </section>

          {/* E · Comments (R29) */}
          <section className="card card-pad">
            <div className="flex items-center justify-between gap-3 mb-3">
              <h2 className="section-title">Additional comments</h2>
              {personalNotes && (
                <button
                  type="button"
                  onClick={() => {
                    // PRD §6.4.5 — appends rather than replacing, so the
                    // brother's existing text is never destroyed.
                    setComments((prev) => (prev.trim() ? `${prev.trim()}\n\n${personalNotes}` : personalNotes))
                    touch()
                  }}
                  className="btn btn-ghost btn-sm"
                >
                  Copy notes into comment
                </button>
              )}
            </div>

            <textarea
              className="textarea"
              value={comments}
              maxLength={commentLimit}
              onChange={(e) => {
                setComments(e.target.value)
                touch()
              }}
              placeholder="Share any additional thoughts, observations, or specific examples..."
              rows={6}
            />

            <div className="flex justify-end mt-1.5">
              <span
                className={`char-counter ${comments.length >= commentLimit ? 'char-counter-over' : ''}`}
              >
                {comments.length} / {commentLimit}
              </span>
            </div>
          </section>

          {error && (
            <div className="alert alert-negative" role="alert">
              {error}
            </div>
          )}

          <div className="flex gap-3">
            <button type="button" onClick={cancel} className="btn btn-secondary flex-1">
              Cancel
            </button>
            <button type="submit" disabled={saving} className="btn btn-primary flex-1">
              {saving ? 'Saving…' : isUpdate ? 'Update evaluation' : 'Save evaluation'}
            </button>
          </div>
        </form>

        <p className="mt-5 text-sm text-ink-subtle text-center">
          Your evaluation helps us make informed decisions. Be honest and thoughtful in your ratings
          and comments.
        </p>
      </main>
    </div>
  )
}

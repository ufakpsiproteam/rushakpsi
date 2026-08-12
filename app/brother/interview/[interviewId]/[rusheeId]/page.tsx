'use client'

import BrotherNav from '@/components/brother/BrotherNav'
import { useParams, useRouter } from 'next/navigation'
import { useState, useEffect, useCallback, useTransition, useRef } from 'react'
import { supabase } from '@/lib/supabase'
import { submitAssignment, flagCasualConflict, flagProfessionalConflict } from './actions'

// ── Types ──────────────────────────────────────────────────────────────────

interface InterviewQuestion {
  id: string
  order_index: number
  prompt: string
  help_text: string | null
  is_scored: boolean
  field_type: 'score_notes' | 'yes_no'
  score_options: Array<{ value: number; label: string; descriptors: string[] }> | null
  timer_seconds: number | null
  notes_required: boolean
}

interface InterviewScript {
  id: string
  kind: 'opening' | 'closing' | 'interviewer_notes' | 'conflict_script'
  position: number
  content: string
}

interface Assignment {
  status: 'pending' | 'submitted' | 'removed'
  conflict_flagged_at: string | null
  knows_personally: boolean
}

interface AnswerState {
  score: number | null
  yes_no: boolean | null
  notes: string
}

type Step = 'loading' | 'opening' | 'question' | 'closing' | 'review' | 'recommendation' | 'confirm' | 'done' | 'error' | 'already_done'

const RECOMMENDATION_OPTIONS = [
  { value: 5, label: 'Exceptional', description: 'Must for the frat. Valuable skills, enthusiasm, detailed responses.' },
  { value: 4, label: 'Above Average', description: 'Solid contender. Valuable skills and enthusiasm; responses could use more detail.' },
  { value: 3, label: 'Average', description: 'Maybe. Valuable skills/experiences but lacks enthusiasm or thoughtful responses.' },
  { value: 2, label: 'Below Average', description: 'Not the best fit. Might have skills but lacked enthusiasm and thoughtful responses.' },
  { value: 1, label: 'Inadequate', description: 'Would not recommend.' },
]

// ── Small UI helpers ───────────────────────────────────────────────────────

function ScriptBlock({ lines }: { lines: string[] }) {
  return (
    <div className="space-y-3">
      {lines.map((line, i) => (
        <p key={i} className="text-gray-700 leading-relaxed">{line}</p>
      ))}
    </div>
  )
}

function TimerDisplay({ seconds }: { seconds: number }) {
  const [remaining, setRemaining] = useState(seconds)
  const [running, setRunning] = useState(true)

  useEffect(() => {
    if (!running || remaining <= 0) return
    const id = setInterval(() => setRemaining(r => r <= 1 ? (setRunning(false), 0) : r - 1), 1000)
    return () => clearInterval(id)
  }, [running, remaining])

  function restart() { setRemaining(seconds); setRunning(true) }

  const pct = (remaining / seconds) * 100
  const color = remaining <= 10 ? 'text-red-500' : remaining <= 30 ? 'text-amber-500' : 'text-gray-600'

  return (
    <div className="flex items-center gap-2 mb-4">
      <span className={`text-sm font-mono font-medium ${color}`}>
        {Math.floor(remaining / 60)}:{String(remaining % 60).padStart(2, '0')}
      </span>
      <div className="flex-1 h-1.5 bg-gray-100 rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full transition-all ${remaining <= 10 ? 'bg-red-400' : 'bg-blue-400'}`}
          style={{ width: `${pct}%` }}
        />
      </div>
      <button
        onClick={restart}
        className="text-xs text-gray-400 hover:text-gray-600 shrink-0"
        title="Restart timer"
      >
        ↺
      </button>
    </div>
  )
}

// ── Main page ──────────────────────────────────────────────────────────────

export default function InterviewModePage() {
  const params = useParams()
  const router = useRouter()
  const interviewId = params.interviewId as string
  const rusheeId = params.rusheeId as string

  const [step, setStep] = useState<Step>('loading')
  const [errorMsg, setErrorMsg] = useState('')
  const [interviewType, setInterviewType] = useState<'casual' | 'professional'>('casual')
  const [rushee, setRushee] = useState<{ name: string; major: string | null }>({ name: '', major: null })
  const [questions, setQuestions] = useState<InterviewQuestion[]>([])
  const [openingScripts, setOpeningScripts] = useState<string[]>([])
  const [closingScripts, setClosingScripts] = useState<string[]>([])
  const [conflictScript, setConflictScript] = useState<string | null>(null)
  const [assignment, setAssignment] = useState<Assignment | null>(null)
  const [answers, setAnswers] = useState<Record<string, AnswerState>>({})
  const [currentQIdx, setCurrentQIdx] = useState(0)
  const [recommendation, setRecommendation] = useState<number | null>(null)
  const [recNotes, setRecNotes] = useState('')
  const [validationErrors, setValidationErrors] = useState<string[]>([])
  const [submitPending, startSubmitTransition] = useTransition()
  const [conflictPending, startConflictTransition] = useTransition()
  const [showConflictScript, setShowConflictScript] = useState(false)
  const [dirty, setDirty] = useState(false)

  const dirtyRef = useRef(dirty)
  useEffect(() => { dirtyRef.current = dirty }, [dirty])

  // beforeunload guard (soft — Next App Router has no cancellable nav event)
  useEffect(() => {
    const handler = (e: BeforeUnloadEvent) => {
      if (dirtyRef.current) {
        e.preventDefault()
        e.returnValue = ''
      }
    }
    window.addEventListener('beforeunload', handler)
    return () => window.removeEventListener('beforeunload', handler)
  }, [])

  // ── Data loading ─────────────────────────────────────────────────────────

  useEffect(() => {
    load()
  }, [interviewId, rusheeId])

  async function load() {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { setErrorMsg('Not authenticated.'); setStep('error'); return }

    const db = supabase as any
    const [ivRes, iaRes, rRes, qRes, existRes] = await Promise.all([
      db.from('interviews').select('type, status').eq('id', interviewId).single(),
      db.from('interview_assignments')
        .select('status, conflict_flagged_at, knows_personally')
        .eq('interview_id', interviewId).eq('brother_id', user.id).eq('rushee_id', rusheeId)
        .maybeSingle(),
      (supabase as any).from('rushees').select('name, major').eq('id', rusheeId).single(),
      db.from('interview_questions').select('id, type, is_active, order_index, prompt, help_text, is_scored, field_type, score_options, timer_seconds, notes_required').order('order_index'),
      db.from('interview_answers')
        .select('question_id, score, yes_no, notes')
        .eq('interview_id', interviewId)
        .eq('brother_id', user.id)
        .eq('rushee_id', rusheeId),
    ])

    // interview_scripts has no interview_id column — re-fetch correctly
    if (ivRes.error || !ivRes.data) { setErrorMsg('Interview not found.'); setStep('error'); return }
    const iv = ivRes.data
    const ivType = iv.type as 'casual' | 'professional'

    setInterviewType(ivType)

    // Re-fetch scripts for this type
    const scriptRes = await db.from('interview_scripts')
      .select('kind, position, content')
      .eq('type', ivType)
      .order('position')

    if (iaRes.error || !iaRes.data) { setErrorMsg('No assignment found for this interview.'); setStep('error'); return }
    const ia = iaRes.data as Assignment

    if (ia.status === 'submitted') { setStep('already_done'); return }
    if (ia.status === 'removed') { setErrorMsg('This assignment has been removed.'); setStep('already_done'); return }
    if (iv.status !== 'in_progress') { setErrorMsg(`Interview is ${iv.status}.`); setStep('already_done'); return }

    setAssignment(ia)
    setRushee(rRes.data ? { name: rRes.data.name, major: rRes.data.major } : { name: 'Unknown', major: null })

    const qs = (qRes.data ?? []).filter((q: any) => q.type === ivType && q.is_active) as InterviewQuestion[]
    setQuestions(qs)

    const scripts = (scriptRes.data ?? []) as InterviewScript[]
    setOpeningScripts(
      scripts.filter(s => s.kind === 'opening').sort((a, b) => a.position - b.position).map(s => s.content)
    )
    setClosingScripts(
      scripts.filter(s => s.kind === 'closing').sort((a, b) => a.position - b.position).map(s => s.content)
    )
    const cs = scripts.find(s => s.kind === 'conflict_script')
    setConflictScript(cs?.content ?? null)

    // Build answers map from existing answers
    const answerMap: Record<string, AnswerState> = {}
    for (const a of existRes.data ?? []) {
      answerMap[a.question_id] = { score: a.score, yes_no: a.yes_no, notes: a.notes ?? '' }
    }
    setAnswers(answerMap)

    // If casual conflict already flagged → skip to locked state
    if (ia.conflict_flagged_at && ivType === 'casual') {
      setStep('opening') // will show locked banner
    } else {
      // Resume: find furthest answered question + 1
      const answeredIndices = qs
        .map((q, i) => {
          const ans = answerMap[q.id]
          if (!ans) return -1
          if (q.field_type === 'yes_no') return ans.yes_no !== null ? i : -1
          if (q.is_scored) return ans.score !== null ? i : -1
          return ans.notes ? i : -1
        })
        .filter(i => i >= 0)

      if (answeredIndices.length > 0) {
        const furthest = Math.max(...answeredIndices)
        const resumeAt = Math.min(furthest + 1, qs.length)
        if (resumeAt >= qs.length) {
          setStep('review')
        } else {
          setCurrentQIdx(resumeAt)
          setStep('question')
        }
      } else {
        setStep('opening')
      }
    }
  }

  // ── Answer upsert ─────────────────────────────────────────────────────────

  async function upsertAnswer(questionId: string, ans: AnswerState) {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    await (supabase as any).from('interview_answers').upsert({
      interview_id: interviewId,
      brother_id: user.id,
      rushee_id: rusheeId,
      question_id: questionId,
      score: ans.score,
      yes_no: ans.yes_no,
      notes: ans.notes || null,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'interview_id,brother_id,rushee_id,question_id' })
  }

  function updateAnswer(questionId: string, updates: Partial<AnswerState>) {
    setAnswers(prev => {
      const base: AnswerState = prev[questionId] ?? { score: null, yes_no: null, notes: '' }
      const merged: AnswerState = { ...base, ...updates }
      const next = { ...prev, [questionId]: merged }
      upsertAnswer(questionId, next[questionId])
      setDirty(true)
      return next
    })
  }

  // ── Question navigation ────────────────────────────────────────────────────

  function goToNextQuestion() {
    if (currentQIdx < questions.length - 1) {
      setCurrentQIdx(i => i + 1)
    } else {
      setStep('closing')
    }
  }

  function goToPrevQuestion() {
    if (currentQIdx > 0) {
      setCurrentQIdx(i => i - 1)
    } else {
      setStep('opening')
    }
  }

  // ── Validation ─────────────────────────────────────────────────────────────

  function validate(): string[] {
    const errors: string[] = []
    for (const q of questions) {
      const ans = answers[q.id]
      if (q.field_type === 'yes_no') {
        if (!ans || ans.yes_no === null) errors.push(`Q${q.order_index}: Yes/No answer required.`)
      } else if (q.is_scored) {
        if (!ans || ans.score === null) errors.push(`Q${q.order_index}: Score required.`)
      }
      if (q.notes_required && (!ans || !ans.notes.trim())) {
        errors.push(`Q${q.order_index}: Notes required.`)
      }
    }
    if (!recommendation) errors.push('Recommendation score required.')
    if (!recNotes.trim()) errors.push('Recommendation notes required.')
    return errors
  }

  function handleProceedToConfirm() {
    const errs = validate()
    setValidationErrors(errs)
    if (errs.length === 0) setStep('confirm')
  }

  function handleSubmit() {
    startSubmitTransition(async () => {
      if (!recommendation) return
      const { error } = await submitAssignment(interviewId, rusheeId, recommendation, recNotes)
      if (error) {
        setValidationErrors([error])
        setStep('recommendation')
        return
      }
      setDirty(false)

      // Check for another pending assignment in this interview
      const { data: { user } } = await supabase.auth.getUser()
      if (user) {
        const { data: nextAssignment } = await (supabase as any)
          .from('interview_assignments')
          .select('rushee_id')
          .eq('interview_id', interviewId)
          .eq('brother_id', user.id)
          .eq('status', 'pending')
          .neq('rushee_id', rusheeId)
          .limit(1)
          .maybeSingle()

        if (nextAssignment?.rushee_id) {
          router.push(`/brother/interview/${interviewId}/${nextAssignment.rushee_id}`)
          return
        }
      }

      setStep('done')
    })
  }

  function handleFlagCasualConflict() {
    startConflictTransition(async () => {
      const { error } = await flagCasualConflict(interviewId, rusheeId)
      if (error) { setErrorMsg(error); return }
      setAssignment(a => a ? { ...a, conflict_flagged_at: new Date().toISOString() } : a)
    })
  }

  function handleFlagProfessionalConflict() {
    startConflictTransition(async () => {
      const { error } = await flagProfessionalConflict(interviewId, rusheeId)
      if (error) { setErrorMsg(error); return }
      setAssignment(a => a ? { ...a, knows_personally: true } : a)
      setShowConflictScript(false)
    })
  }

  // ── Render helpers ─────────────────────────────────────────────────────────

  const currentQuestion = questions[currentQIdx]
  const currentAnswer = currentQuestion ? (answers[currentQuestion.id] ?? { score: null, yes_no: null, notes: '' }) : null

  const casualConflictFlagged = assignment?.conflict_flagged_at !== null && interviewType === 'casual'

  // ── Render ─────────────────────────────────────────────────────────────────

  if (step === 'loading') {
    return (
      <div className="min-h-screen bg-gray-50">
        <BrotherNav />
        <div className="flex items-center justify-center h-64">
          <p className="text-gray-400">Loading…</p>
        </div>
      </div>
    )
  }

  if (step === 'error') {
    return (
      <div className="min-h-screen bg-gray-50">
        <BrotherNav />
        <div className="max-w-xl mx-auto px-4 py-12 text-center">
          <p className="text-red-600 mb-4">{errorMsg || 'Something went wrong.'}</p>
          <button onClick={() => router.push('/brother/interviews')} className="text-sm text-blue-600 underline">
            Back to Interviews
          </button>
        </div>
      </div>
    )
  }

  if (step === 'already_done') {
    return (
      <div className="min-h-screen bg-gray-50">
        <BrotherNav />
        <div className="max-w-xl mx-auto px-4 py-12 text-center">
          <p className="text-green-600 font-medium mb-2">{errorMsg || 'Assignment already submitted.'}</p>
          <button onClick={() => router.push('/brother/interviews')} className="text-sm text-blue-600 underline">
            Back to Interviews
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 pb-24 lg:pb-8">
      <BrotherNav />

      <div className="max-w-xl mx-auto px-4 py-6">
        {/* Header */}
        <div className="mb-6">
          <p className="text-xs uppercase tracking-wide text-gray-400 font-medium">
            {interviewType} interview
          </p>
          <h1 className="text-xl font-bold text-gray-900">{rushee.name}</h1>
          {rushee.major && <p className="text-sm text-gray-500">{rushee.major}</p>}
        </div>

        {/* ── OPENING ──────────────────────────────────────────────────────── */}
        {step === 'opening' && (
          <div className="space-y-6">
            {openingScripts.length > 0 && (
              <div className="bg-white rounded-lg shadow p-5">
                <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">Opening Script</h2>
                <ScriptBlock lines={openingScripts} />
              </div>
            )}

            {/* Professional: knows_personally */}
            {interviewType === 'professional' && !assignment?.knows_personally && conflictScript && (
              <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
                <p className="text-sm text-amber-800 font-medium mb-2">Do you know this person personally?</p>
                <p className="text-sm text-amber-700 mb-3">
                  If you have a personal relationship with the rushee, please disclose it.
                </p>
                <button
                  onClick={() => setShowConflictScript(true)}
                  className="text-sm bg-amber-100 hover:bg-amber-200 text-amber-800 px-3 py-1.5 rounded"
                >
                  Yes, I know them personally
                </button>
              </div>
            )}

            {assignment?.knows_personally && (
              <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
                <p className="text-xs text-amber-700">Noted: personal relationship disclosed.</p>
              </div>
            )}

            {/* Casual: conflict */}
            {interviewType === 'casual' && (
              <div className={`rounded-lg p-4 border ${casualConflictFlagged ? 'bg-red-50 border-red-200' : 'bg-amber-50 border-amber-200'}`}>
                {casualConflictFlagged ? (
                  <>
                    <p className="text-sm text-red-700 font-medium">Conflict of interest flagged</p>
                    <p className="text-sm text-red-600 mt-1">
                      You cannot score this rushee. Contact the recruitment director to be reassigned.
                    </p>
                  </>
                ) : (
                  <>
                    <p className="text-sm text-amber-800 font-medium mb-2">Conflict of interest?</p>
                    <p className="text-sm text-amber-700 mb-3">
                      Do you have a conflict of interest that would prevent you from objectively evaluating this rushee?
                    </p>
                    <button
                      onClick={handleFlagCasualConflict}
                      disabled={conflictPending}
                      className="text-sm bg-red-100 hover:bg-red-200 text-red-700 px-3 py-1.5 rounded disabled:opacity-50"
                    >
                      {conflictPending ? 'Flagging…' : 'Flag conflict'}
                    </button>
                  </>
                )}
              </div>
            )}

            {!casualConflictFlagged && (
              <button
                onClick={() => { setCurrentQIdx(0); setStep('question') }}
                className="w-full bg-black hover:bg-gray-800 text-white py-3 rounded-lg font-medium"
              >
                Begin Interview
              </button>
            )}
          </div>
        )}

        {/* ── QUESTION ─────────────────────────────────────────────────────── */}
        {step === 'question' && currentQuestion && currentAnswer && (
          <div className="space-y-5">
            <div className="flex items-center justify-between text-sm text-gray-400">
              <span>Q{currentQuestion.order_index} of {questions.length}</span>
              <div className="flex gap-1">
                {questions.map((_, i) => (
                  <div key={i} className={`w-2 h-2 rounded-full ${i === currentQIdx ? 'bg-black' : i < currentQIdx ? 'bg-green-400' : 'bg-gray-200'}`} />
                ))}
              </div>
            </div>

            {currentQuestion.timer_seconds && (
              <TimerDisplay
                key={currentQuestion.id}
                seconds={currentQuestion.timer_seconds}
              />
            )}

            <div className="bg-white rounded-lg shadow p-5">
              <p className="text-gray-900 font-medium leading-relaxed mb-2">{currentQuestion.prompt}</p>
              {currentQuestion.help_text && (
                <p className="text-sm text-gray-500 italic mb-4">{currentQuestion.help_text}</p>
              )}

              {currentQuestion.field_type === 'yes_no' && (
                <div className="flex gap-3 mb-4">
                  {[true, false].map(val => (
                    <button
                      key={String(val)}
                      onClick={() => updateAnswer(currentQuestion.id, { yes_no: val })}
                      className={`flex-1 py-2.5 rounded-lg border font-medium text-sm transition-colors ${
                        currentAnswer.yes_no === val
                          ? val ? 'bg-green-600 text-white border-green-600' : 'bg-red-600 text-white border-red-600'
                          : 'bg-white text-gray-700 border-gray-200 hover:border-gray-400'
                      }`}
                    >
                      {val ? 'Yes' : 'No'}
                    </button>
                  ))}
                </div>
              )}

              {currentQuestion.field_type === 'score_notes' && currentQuestion.is_scored && currentQuestion.score_options && (
                <div className="grid grid-cols-1 gap-2 mb-4">
                  {currentQuestion.score_options.map(opt => (
                    <button
                      key={opt.value}
                      onClick={() => updateAnswer(currentQuestion.id, { score: opt.value })}
                      className={`text-left px-3 py-2 rounded-lg border text-sm transition-colors ${
                        currentAnswer.score === opt.value
                          ? 'bg-blue-600 text-white border-blue-600'
                          : 'bg-white text-gray-700 border-gray-200 hover:border-gray-400'
                      }`}
                    >
                      <span className="font-medium">{opt.value} — {opt.label}</span>
                      {opt.descriptors?.length > 0 && (
                        <p className={`text-xs mt-0.5 ${currentAnswer.score === opt.value ? 'text-blue-100' : 'text-gray-400'}`}>
                          {opt.descriptors.join(' · ')}
                        </p>
                      )}
                    </button>
                  ))}
                </div>
              )}

              <textarea
                placeholder={currentQuestion.notes_required ? 'Notes (required)…' : 'Notes (optional)…'}
                value={currentAnswer.notes}
                onChange={e => updateAnswer(currentQuestion.id, { notes: e.target.value })}
                rows={3}
                className="w-full border border-gray-200 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-black resize-none"
              />
            </div>

            <div className="flex gap-3">
              <button
                onClick={goToPrevQuestion}
                className="flex-1 border border-gray-200 text-gray-700 py-2.5 rounded-lg text-sm font-medium hover:bg-gray-50"
              >
                {currentQIdx === 0 ? 'Back to Script' : 'Previous'}
              </button>
              <button
                onClick={goToNextQuestion}
                className="flex-1 bg-black hover:bg-gray-800 text-white py-2.5 rounded-lg text-sm font-medium"
              >
                {currentQIdx === questions.length - 1 ? 'Review Answers' : 'Next'}
              </button>
            </div>
          </div>
        )}

        {/* ── REVIEW ───────────────────────────────────────────────────────── */}
        {step === 'review' && (
          <div className="space-y-4">
            <h2 className="text-lg font-semibold text-gray-900">Review your answers</h2>
            {questions.map((q) => {
              const ans = answers[q.id] ?? { score: null, yes_no: null, notes: '' }
              return (
                <div key={q.id} className="bg-white rounded-lg shadow p-4">
                  <p className="text-sm font-medium text-gray-800 mb-2">Q{q.order_index}: {q.prompt}</p>
                  {q.field_type === 'yes_no' && (
                    <div className="flex gap-2 mb-2">
                      {[true, false].map(val => (
                        <button
                          key={String(val)}
                          onClick={() => updateAnswer(q.id, { yes_no: val })}
                          className={`px-3 py-1 rounded text-xs font-medium transition-colors ${
                            ans.yes_no === val
                              ? val ? 'bg-green-600 text-white' : 'bg-red-600 text-white'
                              : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                          }`}
                        >
                          {val ? 'Yes' : 'No'}
                        </button>
                      ))}
                    </div>
                  )}
                  {q.field_type === 'score_notes' && q.is_scored && (
                    <div className="flex flex-wrap gap-1.5 mb-2">
                      {(q.score_options ?? []).map(opt => (
                        <button
                          key={opt.value}
                          onClick={() => updateAnswer(q.id, { score: opt.value })}
                          className={`px-2 py-1 rounded text-xs font-medium transition-colors ${
                            ans.score === opt.value
                              ? 'bg-blue-600 text-white'
                              : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                          }`}
                        >
                          {opt.value} – {opt.label}
                        </button>
                      ))}
                    </div>
                  )}
                  <textarea
                    placeholder={q.notes_required ? 'Notes (required)…' : 'Notes…'}
                    value={ans.notes}
                    onChange={e => updateAnswer(q.id, { notes: e.target.value })}
                    rows={2}
                    className="w-full border border-gray-200 rounded px-2 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-black resize-none"
                  />
                </div>
              )
            })}

            <button
              onClick={() => setStep('recommendation')}
              className="w-full bg-black hover:bg-gray-800 text-white py-3 rounded-lg font-medium"
            >
              Continue to Recommendation
            </button>
          </div>
        )}

        {/* ── RECOMMENDATION ───────────────────────────────────────────────── */}
        {step === 'recommendation' && (
          <div className="space-y-5">
            <h2 className="text-lg font-semibold text-gray-900">Recommendation</h2>

            <div className="space-y-2">
              {RECOMMENDATION_OPTIONS.map(opt => (
                <button
                  key={opt.value}
                  onClick={() => setRecommendation(opt.value)}
                  className={`w-full text-left px-4 py-3 rounded-lg border transition-colors ${
                    recommendation === opt.value
                      ? 'bg-blue-600 text-white border-blue-600'
                      : 'bg-white text-gray-800 border-gray-200 hover:border-gray-400'
                  }`}
                >
                  <span className="font-medium">{opt.value} — {opt.label}</span>
                  <p className={`text-xs mt-0.5 ${recommendation === opt.value ? 'text-blue-100' : 'text-gray-400'}`}>
                    {opt.description}
                  </p>
                </button>
              ))}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Recommendation notes <span className="text-red-500">*</span>
              </label>
              <textarea
                placeholder="Explain your recommendation…"
                value={recNotes}
                onChange={e => setRecNotes(e.target.value)}
                rows={4}
                className="w-full border border-gray-200 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-black resize-none"
              />
            </div>

            {validationErrors.length > 0 && (
              <ul className="text-red-600 text-sm space-y-1">
                {validationErrors.map((e, i) => <li key={i}>• {e}</li>)}
              </ul>
            )}

            <div className="flex gap-3">
              <button
                onClick={() => setStep('review')}
                className="flex-1 border border-gray-200 text-gray-700 py-2.5 rounded-lg text-sm font-medium hover:bg-gray-50"
              >
                Back to Review
              </button>
              <button
                onClick={handleProceedToConfirm}
                className="flex-1 bg-black hover:bg-gray-800 text-white py-2.5 rounded-lg text-sm font-medium"
              >
                Review &amp; Submit
              </button>
            </div>
          </div>
        )}

        {/* ── CONFIRM ──────────────────────────────────────────────────────── */}
        {step === 'confirm' && (
          <div className="space-y-5">
            <h2 className="text-lg font-semibold text-gray-900">Confirm submission</h2>

            <div className="bg-white rounded-lg shadow divide-y divide-gray-100">
              <div className="px-4 py-3">
                <p className="text-xs text-gray-500 uppercase tracking-wide">Rushee</p>
                <p className="font-medium text-gray-900">{rushee.name}</p>
              </div>
              <div className="px-4 py-3">
                <p className="text-xs text-gray-500 uppercase tracking-wide">Recommendation</p>
                <p className="font-medium text-gray-900">
                  {recommendation} — {RECOMMENDATION_OPTIONS.find(o => o.value === recommendation)?.label}
                </p>
              </div>
              <div className="px-4 py-3">
                <p className="text-xs text-gray-500 uppercase tracking-wide">Notes</p>
                <p className="text-sm text-gray-700">{recNotes}</p>
              </div>
              <div className="px-4 py-3">
                <p className="text-xs text-gray-500 uppercase tracking-wide">Questions answered</p>
                <p className="text-sm text-gray-700">{questions.length}</p>
              </div>
            </div>

            <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded p-3">
              This cannot be undone. Once submitted, only a leadership member can remove this assignment.
            </p>

            {validationErrors.length > 0 && (
              <ul className="text-red-600 text-sm space-y-1">
                {validationErrors.map((e, i) => <li key={i}>• {e}</li>)}
              </ul>
            )}

            <div className="flex gap-3">
              <button
                onClick={() => setStep('recommendation')}
                disabled={submitPending}
                className="flex-1 border border-gray-200 text-gray-700 py-2.5 rounded-lg text-sm font-medium hover:bg-gray-50 disabled:opacity-50"
              >
                Back
              </button>
              <button
                onClick={handleSubmit}
                disabled={submitPending}
                className="flex-1 bg-green-600 hover:bg-green-700 text-white py-2.5 rounded-lg text-sm font-medium disabled:opacity-50"
              >
                {submitPending ? 'Submitting…' : 'Submit'}
              </button>
            </div>
          </div>
        )}

        {/* ── CLOSING (rushee still present — read script, then score) ──────── */}
        {step === 'closing' && (
          <div className="space-y-6">
            {closingScripts.length > 0 && (
              <div className="bg-white rounded-lg shadow p-5">
                <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">Closing Script</h2>
                <ScriptBlock lines={closingScripts} />
              </div>
            )}

            <div className="flex gap-3">
              <button
                onClick={() => { setCurrentQIdx(questions.length - 1); setStep('question') }}
                className="flex-1 border border-gray-200 text-gray-700 py-2.5 rounded-lg text-sm font-medium hover:bg-gray-50"
              >
                Back
              </button>
              <button
                onClick={() => setStep('review')}
                className="flex-1 bg-black hover:bg-gray-800 text-white py-2.5 rounded-lg font-medium text-sm"
              >
                Rushee left — begin scoring
              </button>
            </div>
          </div>
        )}

        {/* ── DONE (post-submit success) ────────────────────────────────────── */}
        {step === 'done' && (
          <div className="space-y-6">
            <div className="text-center py-4">
              <div className="text-4xl mb-2">✓</div>
              <p className="text-lg font-semibold text-green-700">Submitted successfully</p>
              <p className="text-sm text-gray-500 mt-1">{rushee.name}</p>
            </div>

            <button
              onClick={() => router.push('/brother/interviews')}
              className="w-full bg-black hover:bg-gray-800 text-white py-3 rounded-lg font-medium"
            >
              Back to Interviews
            </button>
          </div>
        )}
      </div>

      {/* Professional conflict script overlay */}
      {showConflictScript && conflictScript && (
        <>
          <div className="fixed inset-0 bg-black/40 z-40" onClick={() => setShowConflictScript(false)} />
          <div className="fixed inset-x-4 top-1/4 bg-white rounded-xl shadow-2xl z-50 p-6 max-w-md mx-auto">
            <h3 className="font-semibold text-gray-900 mb-3">Personal Relationship Disclosure</h3>
            <p className="text-sm text-gray-700 leading-relaxed mb-4">{conflictScript}</p>
            <div className="flex gap-3">
              <button
                onClick={() => setShowConflictScript(false)}
                className="flex-1 border border-gray-200 text-gray-700 py-2 rounded text-sm"
              >
                Cancel
              </button>
              <button
                onClick={handleFlagProfessionalConflict}
                disabled={conflictPending}
                className="flex-1 bg-amber-600 hover:bg-amber-700 text-white py-2 rounded text-sm font-medium disabled:opacity-50"
              >
                {conflictPending ? 'Noting…' : 'Confirm disclosure'}
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  )
}

'use client'

import AdminNav from '@/components/admin/AdminNav'
import { useState, useEffect, useTransition } from 'react'
import {
  getInterviewQuestions,
  getInterviewScripts,
  updateQuestion,
  markQuestionReviewed,
  updateScript,
  type InterviewQuestionRecord,
  type InterviewScriptRecord,
  type QuestionEditableFields,
} from './actions'

type Tab = 'casual' | 'professional'
type EditTarget = { kind: 'question'; record: InterviewQuestionRecord } | { kind: 'script'; record: InterviewScriptRecord }

function hasPlaceholder(content: string): boolean {
  return /\{[^}]+\}/.test(content)
}

function ScoreOptionsEditor({
  value,
  onChange,
}: {
  value: InterviewQuestionRecord['score_options']
  onChange: (v: InterviewQuestionRecord['score_options']) => void
}) {
  const [raw, setRaw] = useState(() => JSON.stringify(value, null, 2))
  const [parseError, setParseError] = useState<string | null>(null)

  function handleChange(text: string) {
    setRaw(text)
    try {
      const parsed = JSON.parse(text)
      setParseError(null)
      onChange(parsed)
    } catch {
      setParseError('Invalid JSON')
    }
  }

  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-1">Score options (JSON)</label>
      <textarea
        rows={8}
        value={raw}
        onChange={e => handleChange(e.target.value)}
        className="w-full font-mono text-xs border border-gray-300 rounded px-2 py-1 focus:outline-none focus:ring-2 focus:ring-blue-500"
      />
      {parseError && <p className="text-red-600 text-xs mt-1">{parseError}</p>}
    </div>
  )
}

function QuestionEditForm({
  question,
  onSaved,
}: {
  question: InterviewQuestionRecord
  onSaved: (updated: InterviewQuestionRecord) => void
}) {
  const [pending, startTransition] = useTransition()
  const [reviewPending, startReviewTransition] = useTransition()
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  const [fields, setFields] = useState<QuestionEditableFields>({
    prompt: question.prompt,
    help_text: question.help_text,
    notes_required: question.notes_required,
    timer_seconds: question.timer_seconds,
    score_options: question.score_options,
    is_active: question.is_active,
  })

  useEffect(() => {
    setFields({
      prompt: question.prompt,
      help_text: question.help_text,
      notes_required: question.notes_required,
      timer_seconds: question.timer_seconds,
      score_options: question.score_options,
      is_active: question.is_active,
    })
    setMessage(null)
  }, [question.id])

  function handleSave() {
    startTransition(async () => {
      const { error } = await updateQuestion(question.id, fields)
      if (error) {
        setMessage({ type: 'error', text: error })
      } else {
        setMessage({ type: 'success', text: 'Saved.' })
        onSaved({ ...question, ...fields })
      }
    })
  }

  function handleMarkReviewed() {
    startReviewTransition(async () => {
      const { error } = await markQuestionReviewed(question.id)
      if (error) {
        setMessage({ type: 'error', text: error })
      } else {
        setMessage({ type: 'success', text: 'Marked as reviewed.' })
        onSaved({ ...question, needs_human_review: false, review_reason: null })
      }
    })
  }

  return (
    <div className="space-y-4">
      {question.needs_human_review && (
        <div className="bg-amber-50 border border-amber-300 rounded p-3">
          <p className="text-amber-800 text-sm font-medium">Needs human review</p>
          {question.review_reason && (
            <p className="text-amber-700 text-xs mt-1">{question.review_reason}</p>
          )}
          <button
            onClick={handleMarkReviewed}
            disabled={reviewPending}
            className="mt-2 text-xs bg-amber-100 hover:bg-amber-200 text-amber-800 px-3 py-1 rounded disabled:opacity-50"
          >
            {reviewPending ? 'Saving…' : 'Mark as reviewed'}
          </button>
        </div>
      )}

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Prompt</label>
        <textarea
          rows={4}
          value={fields.prompt}
          onChange={e => setFields(f => ({ ...f, prompt: e.target.value }))}
          className="w-full border border-gray-300 rounded px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Help text (optional)</label>
        <textarea
          rows={2}
          value={fields.help_text ?? ''}
          onChange={e => setFields(f => ({ ...f, help_text: e.target.value || null }))}
          className="w-full border border-gray-300 rounded px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>

      <div className="flex gap-6 flex-wrap">
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={fields.notes_required}
            onChange={e => setFields(f => ({ ...f, notes_required: e.target.checked }))}
            className="rounded"
          />
          Notes required
        </label>

        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={fields.is_active}
            onChange={e => setFields(f => ({ ...f, is_active: e.target.checked }))}
            className="rounded"
          />
          Active
        </label>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Timer (seconds, optional)</label>
        <input
          type="number"
          min={0}
          value={fields.timer_seconds ?? ''}
          onChange={e => setFields(f => ({ ...f, timer_seconds: e.target.value ? Number(e.target.value) : null }))}
          className="w-32 border border-gray-300 rounded px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>

      {question.is_scored && question.field_type === 'score_notes' && (
        <ScoreOptionsEditor
          value={fields.score_options}
          onChange={v => setFields(f => ({ ...f, score_options: v }))}
        />
      )}

      <div className="text-xs text-gray-500">
        <span className="font-medium">Type:</span> {question.type} &nbsp;|&nbsp;
        <span className="font-medium">Field:</span> {question.field_type} &nbsp;|&nbsp;
        <span className="font-medium">Order:</span> {question.order_index} &nbsp;|&nbsp;
        <span className="font-medium">Scored:</span> {question.is_scored ? 'yes' : 'no'}
      </div>

      {message && (
        <p className={`text-sm ${message.type === 'error' ? 'text-red-600' : 'text-green-700'}`}>
          {message.text}
        </p>
      )}

      <button
        onClick={handleSave}
        disabled={pending}
        className="bg-blue-600 hover:bg-blue-700 text-white text-sm px-4 py-2 rounded disabled:opacity-50"
      >
        {pending ? 'Saving…' : 'Save changes'}
      </button>
    </div>
  )
}

function ScriptEditForm({
  script,
  onSaved,
}: {
  script: InterviewScriptRecord
  onSaved: (updated: InterviewScriptRecord) => void
}) {
  const [pending, startTransition] = useTransition()
  const [content, setContent] = useState(script.content)
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  useEffect(() => {
    setContent(script.content)
    setMessage(null)
  }, [script.id])

  function handleSave() {
    startTransition(async () => {
      const { error } = await updateScript(script.id, content)
      if (error) {
        setMessage({ type: 'error', text: error })
      } else {
        setMessage({ type: 'success', text: 'Saved.' })
        onSaved({ ...script, content })
      }
    })
  }

  const warn = hasPlaceholder(content)

  return (
    <div className="space-y-4">
      {warn && (
        <div className="bg-amber-50 border border-amber-300 rounded p-3">
          <p className="text-amber-800 text-sm font-medium">Unfilled placeholder detected</p>
          <p className="text-amber-700 text-xs mt-1">
            Replace <code className="font-mono">{'{placeholder}'}</code> tokens with real dates/text before use.
          </p>
        </div>
      )}

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Content</label>
        <textarea
          rows={10}
          value={content}
          onChange={e => setContent(e.target.value)}
          className="w-full border border-gray-300 rounded px-2 py-1 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>

      <div className="text-xs text-gray-500">
        <span className="font-medium">Type:</span> {script.type} &nbsp;|&nbsp;
        <span className="font-medium">Kind:</span> {script.kind} &nbsp;|&nbsp;
        <span className="font-medium">Position:</span> {script.position}
      </div>

      {message && (
        <p className={`text-sm ${message.type === 'error' ? 'text-red-600' : 'text-green-700'}`}>
          {message.text}
        </p>
      )}

      <button
        onClick={handleSave}
        disabled={pending}
        className="bg-blue-600 hover:bg-blue-700 text-white text-sm px-4 py-2 rounded disabled:opacity-50"
      >
        {pending ? 'Saving…' : 'Save changes'}
      </button>
    </div>
  )
}

export default function AdminInterviewQuestionsPage() {
  const [questions, setQuestions] = useState<InterviewQuestionRecord[]>([])
  const [scripts, setScripts] = useState<InterviewScriptRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [tab, setTab] = useState<Tab>('casual')
  const [selected, setSelected] = useState<EditTarget | null>(null)

  useEffect(() => {
    async function load() {
      const [qResult, sResult] = await Promise.all([getInterviewQuestions(), getInterviewScripts()])
      if (qResult.error || sResult.error) {
        setLoadError(qResult.error ?? sResult.error ?? 'Load failed')
      } else {
        setQuestions(qResult.data ?? [])
        setScripts(sResult.data ?? [])
      }
      setLoading(false)
    }
    load()
  }, [])

  function updateQuestionInList(updated: InterviewQuestionRecord) {
    setQuestions(qs => qs.map(q => (q.id === updated.id ? updated : q)))
    setSelected({ kind: 'question', record: updated })
  }

  function updateScriptInList(updated: InterviewScriptRecord) {
    setScripts(ss => ss.map(s => (s.id === updated.id ? updated : s)))
    setSelected({ kind: 'script', record: updated })
  }

  const tabQuestions = questions.filter(q => q.type === tab)
  const tabScripts = scripts.filter(s => s.type === tab)

  return (
    <div className="min-h-screen bg-gray-50">
      <AdminNav />
      <div className="max-w-7xl mx-auto px-4 py-6">
        <h1 className="text-2xl font-bold text-gray-900 mb-6">Interview Questions &amp; Scripts</h1>

        {loading && <p className="text-gray-500">Loading…</p>}
        {loadError && <p className="text-red-600">{loadError}</p>}

        {!loading && !loadError && (
          <div className="flex gap-6 h-[calc(100vh-160px)]">
            {/* Left panel — list */}
            <div className="w-72 flex-shrink-0 flex flex-col bg-white rounded-lg shadow overflow-hidden">
              {/* Tab switcher */}
              <div className="flex border-b">
                {(['casual', 'professional'] as Tab[]).map(t => (
                  <button
                    key={t}
                    onClick={() => { setTab(t); setSelected(null) }}
                    className={`flex-1 py-2 text-sm font-medium capitalize ${
                      tab === t
                        ? 'border-b-2 border-blue-600 text-blue-600'
                        : 'text-gray-500 hover:text-gray-700'
                    }`}
                  >
                    {t}
                  </button>
                ))}
              </div>

              <div className="overflow-y-auto flex-1">
                {/* Questions section */}
                <div className="px-3 pt-3 pb-1">
                  <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Questions</p>
                </div>
                {tabQuestions.map(q => {
                  const isSelected = selected?.kind === 'question' && selected.record.id === q.id
                  return (
                    <button
                      key={q.id}
                      onClick={() => setSelected({ kind: 'question', record: q })}
                      className={`w-full text-left px-3 py-2 text-sm hover:bg-gray-50 flex items-start gap-2 ${
                        isSelected ? 'bg-blue-50' : ''
                      } ${!q.is_active ? 'opacity-50' : ''}`}
                    >
                      <span className="text-gray-400 text-xs mt-0.5 shrink-0">Q{q.order_index}</span>
                      <span className="flex-1 line-clamp-2">{q.prompt}</span>
                      {q.needs_human_review && (
                        <span className="shrink-0 w-2 h-2 rounded-full bg-amber-400 mt-1.5" title="Needs review" />
                      )}
                    </button>
                  )
                })}

                {/* Scripts section */}
                <div className="px-3 pt-4 pb-1">
                  <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Scripts</p>
                </div>
                {tabScripts.map(s => {
                  const isSelected = selected?.kind === 'script' && selected.record.id === s.id
                  const warn = hasPlaceholder(s.content)
                  return (
                    <button
                      key={s.id}
                      onClick={() => setSelected({ kind: 'script', record: s })}
                      className={`w-full text-left px-3 py-2 text-sm hover:bg-gray-50 flex items-start gap-2 ${
                        isSelected ? 'bg-blue-50' : ''
                      }`}
                    >
                      <span className="flex-1 capitalize">{s.kind.replace('_', ' ')} {s.position > 0 ? `(${s.position})` : ''}</span>
                      {warn && (
                        <span className="shrink-0 w-2 h-2 rounded-full bg-amber-400 mt-1.5" title="Unfilled placeholder" />
                      )}
                    </button>
                  )
                })}
              </div>
            </div>

            {/* Right panel — editor */}
            <div className="flex-1 bg-white rounded-lg shadow overflow-y-auto p-6">
              {!selected && (
                <p className="text-gray-400 text-sm">Select a question or script to edit.</p>
              )}
              {selected?.kind === 'question' && (
                <div>
                  <h2 className="text-lg font-semibold text-gray-800 mb-4">
                    Q{selected.record.order_index} — {selected.record.type}
                  </h2>
                  <QuestionEditForm
                    key={selected.record.id}
                    question={selected.record}
                    onSaved={updateQuestionInList}
                  />
                </div>
              )}
              {selected?.kind === 'script' && (
                <div>
                  <h2 className="text-lg font-semibold text-gray-800 mb-4 capitalize">
                    {selected.record.kind.replace('_', ' ')} script — {selected.record.type}
                  </h2>
                  <ScriptEditForm
                    key={selected.record.id}
                    script={selected.record}
                    onSaved={updateScriptInList}
                  />
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

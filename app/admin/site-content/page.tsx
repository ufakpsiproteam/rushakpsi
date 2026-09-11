'use client'

import AdminNav from '@/components/admin/AdminNav'
import { useState, useEffect, useTransition } from 'react'
import { SITE_CONTENT_DEFAULTS, type SiteContent } from '@/lib/siteContent'
import { getSiteContent, updateSiteContentSection, resetSiteContentSection } from './actions'

type SectionKey = keyof SiteContent

const SECTIONS: { key: SectionKey; label: string }[] = [
  { key: 'cycle', label: 'Cycle & Landing Hero' },
  { key: 'links', label: 'Links' },
  { key: 'dates', label: 'Key Dates' },
  { key: 'contacts', label: 'Contacts' },
  { key: 'execBoard', label: 'Executive Board' },
  { key: 'recruitmentTeam', label: 'Recruitment Team' },
  { key: 'professionalAdvisors', label: 'Professional Team' },
  { key: 'pillarsLanding', label: 'Five Pillars (Landing)' },
  { key: 'pillarsInfo', label: 'Five Pillars (Info Page)' },
  { key: 'faq', label: 'FAQ' },
  { key: 'aboutChapter', label: 'About Chapter' },
  { key: 'processSteps', label: 'Process Steps' },
  { key: 'landingClosing', label: 'Landing Closing CTA' },
  { key: 'applicationQuestions', label: 'Application Essay Questions' },
  { key: 'decisionLetters', label: 'Decision Letters' },
]

function SaveBar({
  pending,
  message,
  onSave,
  onReset,
}: {
  pending: boolean
  message: { type: 'success' | 'error'; text: string } | null
  onSave: () => void
  onReset: () => void
}) {
  return (
    <div className="flex items-center gap-3 pt-2">
      <button
        type="button"
        onClick={onSave}
        disabled={pending}
        className="px-5 py-2.5 bg-ink text-white rounded-lg font-semibold hover:bg-inverse-soft transition-colors disabled:opacity-50"
      >
        {pending ? 'Saving...' : 'Save section'}
      </button>
      <button
        type="button"
        onClick={onReset}
        disabled={pending}
        className="px-5 py-2.5 bg-white text-ink border border-line-strong rounded-lg font-semibold hover:bg-surface-alt transition-colors disabled:opacity-50"
      >
        Reset to default
      </button>
      {message && (
        <span className={`text-sm font-medium ${message.type === 'success' ? 'text-emerald-600' : 'text-red-600'}`}>
          {message.text}
        </span>
      )}
    </div>
  )
}

function TextField({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <div>
      <label className="block text-sm font-medium text-ink-muted mb-1">{label}</label>
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full px-3 py-2 bg-white border border-line rounded-lg text-ink text-sm focus:ring-2 focus:ring-ink"
      />
    </div>
  )
}

function TextAreaField({
  label,
  value,
  onChange,
  rows = 3,
  hint,
}: {
  label: string
  value: string
  onChange: (v: string) => void
  rows?: number
  hint?: string
}) {
  return (
    <div>
      <label className="block text-sm font-medium text-ink-muted mb-1">{label}</label>
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        rows={rows}
        className="w-full px-3 py-2 bg-white border border-line rounded-lg text-ink text-sm focus:ring-2 focus:ring-ink resize-y"
      />
      {hint && <p className="text-xs text-ink-subtle mt-1">{hint}</p>}
    </div>
  )
}

/** One paragraph / list item per line. Blank lines are dropped on read-out. */
function StringListField({
  label,
  value,
  onChange,
  rows = 5,
  hint,
}: {
  label: string
  value: string[]
  onChange: (v: string[]) => void
  rows?: number
  hint?: string
}) {
  return (
    <div>
      <label className="block text-sm font-medium text-ink-muted mb-1">{label}</label>
      <textarea
        value={value.join('\n')}
        onChange={(e) => onChange(e.target.value.split('\n'))}
        onBlur={(e) => onChange(e.target.value.split('\n').map((s) => s.trim()).filter((s) => s.length > 0))}
        rows={rows}
        className="w-full px-3 py-2 bg-white border border-line rounded-lg text-ink text-sm font-mono focus:ring-2 focus:ring-ink resize-y"
        placeholder="One item per line"
      />
      {hint && <p className="text-xs text-ink-subtle mt-1">{hint}</p>}
    </div>
  )
}

/** Raw-JSON editor for array-of-object sections (exec board, FAQ, pillars, process steps). */
function JsonArrayField<T>({
  label,
  value,
  onChange,
  hint,
}: {
  label: string
  value: T[]
  onChange: (v: T[]) => void
  hint?: string
}) {
  const [raw, setRaw] = useState(() => JSON.stringify(value, null, 2))
  const [parseError, setParseError] = useState<string | null>(null)

  useEffect(() => {
    setRaw(JSON.stringify(value, null, 2))
    setParseError(null)
  }, [value])

  function handleChange(text: string) {
    setRaw(text)
    try {
      const parsed = JSON.parse(text)
      if (!Array.isArray(parsed)) throw new Error('Must be a JSON array')
      setParseError(null)
      onChange(parsed)
    } catch {
      setParseError('Invalid JSON — changes not applied until this is fixed.')
    }
  }

  return (
    <div>
      <label className="block text-sm font-medium text-ink-muted mb-1">{label}</label>
      <textarea
        value={raw}
        onChange={(e) => handleChange(e.target.value)}
        rows={Math.min(24, Math.max(8, raw.split('\n').length))}
        className="w-full px-3 py-2 bg-white border border-line rounded-lg text-ink text-xs font-mono focus:ring-2 focus:ring-ink resize-y"
      />
      {parseError && <p className="text-xs text-red-600 mt-1">{parseError}</p>}
      {hint && <p className="text-xs text-ink-subtle mt-1">{hint}</p>}
    </div>
  )
}

const TOKEN_HINT =
  'Formatting: **bold**, *italic*, [link text](https://url). Insert a live value with {tokenName} — available: {inviteOnlyDateTime}, {smokerDateTime}, {smokerVenue}, {inductionDateTime}, {inductionVenue}, {bidResponseDeadline}, {professionalInterviewSheetUrl} — these always match the Key Dates / Links sections above.'

export default function SiteContentAdminPage() {
  const [activeSection, setActiveSection] = useState<SectionKey>('cycle')
  const [content, setContent] = useState<SiteContent>(SITE_CONTENT_DEFAULTS)
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  useEffect(() => {
    getSiteContent().then(({ data, error }) => {
      if (data) setContent(data)
      if (error) setLoadError(error)
      setLoading(false)
    })
  }, [])

  useEffect(() => {
    setMessage(null)
  }, [activeSection])

  function updateSection<K extends SectionKey>(key: K, value: SiteContent[K]) {
    setContent((prev) => ({ ...prev, [key]: value }))
  }

  function handleSave() {
    startTransition(async () => {
      const { error } = await updateSiteContentSection(activeSection, content[activeSection])
      setMessage(error ? { type: 'error', text: error } : { type: 'success', text: 'Saved.' })
    })
  }

  function handleReset() {
    startTransition(async () => {
      const { error } = await resetSiteContentSection(activeSection)
      if (error) {
        setMessage({ type: 'error', text: error })
        return
      }
      setContent((prev) => ({ ...prev, [activeSection]: SITE_CONTENT_DEFAULTS[activeSection] }))
      setMessage({ type: 'success', text: 'Reset to default and saved.' })
    })
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-canvas">
        <AdminNav />
        <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="text-center text-ink-muted">Loading rushing content...</div>
        </main>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-canvas">
      <AdminNav />
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-6">
          <p className="text-xs uppercase tracking-[0.35em] text-ink-subtle">Admin</p>
          <h1 className="mt-2 text-3xl font-semibold text-ink">Rushing Content</h1>
          <p className="mt-2 text-sm text-ink-muted max-w-2xl">
            Edit the people, links, dates, and copy that change each semester — the landing page, rushee Info page,
            application essay questions, and decision letters all read from here. Nothing here affects any other
            part of the site.
          </p>
          {loadError && <p className="mt-2 text-sm text-red-600">{loadError}</p>}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-[220px_1fr] gap-6">
          {/* Section list */}
          <nav className="flex lg:flex-col gap-1 overflow-x-auto lg:overflow-visible pb-2 lg:pb-0">
            {SECTIONS.map((section) => (
              <button
                key={section.key}
                onClick={() => setActiveSection(section.key)}
                className={`shrink-0 text-left px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                  activeSection === section.key
                    ? 'bg-ink text-white'
                    : 'text-ink-muted hover:bg-surface-alt'
                }`}
              >
                {section.label}
              </button>
            ))}
          </nav>

          {/* Editor */}
          <div className="bg-white border border-line rounded-2xl p-6 shadow-sm space-y-5">
            {activeSection === 'cycle' && (
              <>
                <TextField label={'Hero name (e.g. "AKΨ Fall Rush")'} value={content.cycle.name} onChange={(v) => updateSection('cycle', { ...content.cycle, name: v })} />
                <TextField label="Hero subheading" value={content.cycle.subheading} onChange={(v) => updateSection('cycle', { ...content.cycle, subheading: v })} />
                <TextField label="Process section heading" value={content.cycle.processHeading} onChange={(v) => updateSection('cycle', { ...content.cycle, processHeading: v })} />
              </>
            )}

            {activeSection === 'links' && (
              <>
                <TextField label="GroupMe URL" value={content.links.groupMeUrl} onChange={(v) => updateSection('links', { ...content.links, groupMeUrl: v })} />
                <TextField label="Instagram URL" value={content.links.instagramUrl} onChange={(v) => updateSection('links', { ...content.links, instagramUrl: v })} />
                <TextField label="Instagram handle" value={content.links.instagramHandle} onChange={(v) => updateSection('links', { ...content.links, instagramHandle: v })} />
                <TextField label="LinkedIn URL" value={content.links.linkedinUrl} onChange={(v) => updateSection('links', { ...content.links, linkedinUrl: v })} />
                <TextField label="National website URL" value={content.links.nationalWebsiteUrl} onChange={(v) => updateSection('links', { ...content.links, nationalWebsiteUrl: v })} />
                <TextField label="Professional interview signup sheet URL" value={content.links.professionalInterviewSheetUrl} onChange={(v) => updateSection('links', { ...content.links, professionalInterviewSheetUrl: v })} />
                <TextField label="Casual interview signup sheet URL" value={content.links.casualInterviewSheetUrl} onChange={(v) => updateSection('links', { ...content.links, casualInterviewSheetUrl: v })} />
                <TextField label="Bid Acceptance Form URL" value={content.links.bidAcceptanceFormUrl} onChange={(v) => updateSection('links', { ...content.links, bidAcceptanceFormUrl: v })} />
              </>
            )}

            {activeSection === 'dates' && (
              <>
                <p className="text-xs text-ink-subtle -mt-1 mb-2">
                  Used on the application deadline banner, decision letters, and the interview-wizard scripts brothers see.
                  Keep the Smoker/Induction dates and the "interview summary" line below in sync with each other.
                </p>
                <TextField label="Invite-Only event date/time" value={content.dates.inviteOnlyDateTime} onChange={(v) => updateSection('dates', { ...content.dates, inviteOnlyDateTime: v })} />
                <TextField label="Smoker date/time" value={content.dates.smokerDateTime} onChange={(v) => updateSection('dates', { ...content.dates, smokerDateTime: v })} />
                <TextField label="Smoker venue" value={content.dates.smokerVenue} onChange={(v) => updateSection('dates', { ...content.dates, smokerVenue: v })} />
                <TextField label="Induction date/time" value={content.dates.inductionDateTime} onChange={(v) => updateSection('dates', { ...content.dates, inductionDateTime: v })} />
                <TextField label="Induction venue" value={content.dates.inductionVenue} onChange={(v) => updateSection('dates', { ...content.dates, inductionVenue: v })} />
                <TextField label="Bid response deadline" value={content.dates.bidResponseDeadline} onChange={(v) => updateSection('dates', { ...content.dates, bidResponseDeadline: v })} />
                <TextField label="Application deadline" value={content.dates.applicationDeadline} onChange={(v) => updateSection('dates', { ...content.dates, applicationDeadline: v })} />
                <TextField
                  label='Interview-wizard summary (e.g. "September 24th (Smoker) and September 27th (Inductions)")'
                  value={content.dates.interviewEventDatesSummary}
                  onChange={(v) => updateSection('dates', { ...content.dates, interviewEventDatesSummary: v })}
                />
              </>
            )}

            {activeSection === 'contacts' && (
              <>
                <TextField label="Point of contact — name" value={content.contacts.pointOfContactName} onChange={(v) => updateSection('contacts', { ...content.contacts, pointOfContactName: v })} />
                <TextField label="Point of contact — title" value={content.contacts.pointOfContactTitle} onChange={(v) => updateSection('contacts', { ...content.contacts, pointOfContactTitle: v })} />
                <TextField label="Point of contact — email" value={content.contacts.pointOfContactEmail} onChange={(v) => updateSection('contacts', { ...content.contacts, pointOfContactEmail: v })} />
                <TextField label="Decision letter signature name (VP)" value={content.contacts.vpName} onChange={(v) => updateSection('contacts', { ...content.contacts, vpName: v })} />
                <TextField label="Privacy policy contact email" value={content.contacts.privacyContactEmail} onChange={(v) => updateSection('contacts', { ...content.contacts, privacyContactEmail: v })} />
              </>
            )}

            {activeSection === 'execBoard' && (
              <JsonArrayField label="Executive Board" value={content.execBoard} onChange={(v) => updateSection('execBoard', v)} hint='Array of { "title": string, "name": string }' />
            )}
            {activeSection === 'recruitmentTeam' && (
              <JsonArrayField label="Recruitment Team" value={content.recruitmentTeam} onChange={(v) => updateSection('recruitmentTeam', v)} hint='Array of { "title": string, "name": string }' />
            )}
            {activeSection === 'professionalAdvisors' && (
              <JsonArrayField label="Professional Team" value={content.professionalAdvisors} onChange={(v) => updateSection('professionalAdvisors', v)} hint='Array of { "title": string, "name": string }' />
            )}
            {activeSection === 'pillarsLanding' && (
              <JsonArrayField label="Five Pillars — landing page (short taglines)" value={content.pillarsLanding} onChange={(v) => updateSection('pillarsLanding', v)} hint='Array of { "name": string, "detail": string }' />
            )}
            {activeSection === 'pillarsInfo' && (
              <JsonArrayField label="Five Pillars — rushee Info page (longer descriptions)" value={content.pillarsInfo} onChange={(v) => updateSection('pillarsInfo', v)} hint='Array of { "name": string, "description": string }' />
            )}
            {activeSection === 'faq' && (
              <JsonArrayField label="FAQ" value={content.faq} onChange={(v) => updateSection('faq', v)} hint='Array of { "question": string, "answer": string }' />
            )}

            {activeSection === 'aboutChapter' && (
              <>
                <StringListField label="Paragraphs" value={content.aboutChapter.paragraphs} onChange={(v) => updateSection('aboutChapter', { ...content.aboutChapter, paragraphs: v })} rows={6} hint="One paragraph per line." />
                <StringListField label="Member benefits" value={content.aboutChapter.benefits} onChange={(v) => updateSection('aboutChapter', { ...content.aboutChapter, benefits: v })} rows={6} hint="One bullet per line." />
              </>
            )}

            {activeSection === 'processSteps' && (
              <JsonArrayField label="Process Steps" value={content.processSteps} onChange={(v) => updateSection('processSteps', v)} hint='Array of { "step": string, "title": string, "subtitle": string, "detail": string }' />
            )}

            {activeSection === 'landingClosing' && (
              <>
                <TextField label="Heading" value={content.landingClosing.heading} onChange={(v) => updateSection('landingClosing', { ...content.landingClosing, heading: v })} />
                <TextAreaField label="Body" value={content.landingClosing.body} onChange={(v) => updateSection('landingClosing', { ...content.landingClosing, body: v })} />
              </>
            )}

            {activeSection === 'applicationQuestions' && (
              <>
                <TextAreaField label="Essay question 1" value={content.applicationQuestions.essay1} onChange={(v) => updateSection('applicationQuestions', { ...content.applicationQuestions, essay1: v })} />
                <TextAreaField label="Essay question 2" value={content.applicationQuestions.essay2} onChange={(v) => updateSection('applicationQuestions', { ...content.applicationQuestions, essay2: v })} />
                <TextAreaField label="Essay question 3" value={content.applicationQuestions.essay3} onChange={(v) => updateSection('applicationQuestions', { ...content.applicationQuestions, essay3: v })} />
              </>
            )}

            {activeSection === 'decisionLetters' && (
              <>
                <p className="text-xs text-ink-subtle -mt-1 mb-2">{TOKEN_HINT}</p>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <TextField label="Letterhead title" value={content.decisionLetters.letterheadTitle} onChange={(v) => updateSection('decisionLetters', { ...content.decisionLetters, letterheadTitle: v })} />
                  <TextField label="Letterhead subtitle" value={content.decisionLetters.letterheadSubtitle} onChange={(v) => updateSection('decisionLetters', { ...content.decisionLetters, letterheadSubtitle: v })} />
                  <TextField label="Signature title" value={content.decisionLetters.signatureTitle} onChange={(v) => updateSection('decisionLetters', { ...content.decisionLetters, signatureTitle: v })} />
                  <TextField label="Signature footer" value={content.decisionLetters.signatureFooter} onChange={(v) => updateSection('decisionLetters', { ...content.decisionLetters, signatureFooter: v })} />
                </div>

                <div className="border-t border-line pt-4">
                  <h3 className="font-semibold text-ink mb-3">Invite-Only — Accept</h3>
                  <div className="space-y-3">
                    <StringListField label="Body paragraphs" value={content.decisionLetters.inviteAccept.body} onChange={(v) => updateSection('decisionLetters', { ...content.decisionLetters, inviteAccept: { ...content.decisionLetters.inviteAccept, body: v } })} />
                    <StringListField label="Next steps" value={content.decisionLetters.inviteAccept.nextSteps} onChange={(v) => updateSection('decisionLetters', { ...content.decisionLetters, inviteAccept: { ...content.decisionLetters.inviteAccept, nextSteps: v } })} rows={3} />
                    <TextAreaField label="Closing" value={content.decisionLetters.inviteAccept.closing} onChange={(v) => updateSection('decisionLetters', { ...content.decisionLetters, inviteAccept: { ...content.decisionLetters.inviteAccept, closing: v } })} rows={2} />
                  </div>
                </div>

                <div className="border-t border-line pt-4">
                  <h3 className="font-semibold text-ink mb-3">Invite-Only — Reject</h3>
                  <div className="space-y-3">
                    <StringListField label="Body paragraphs" value={content.decisionLetters.inviteReject.body} onChange={(v) => updateSection('decisionLetters', { ...content.decisionLetters, inviteReject: { ...content.decisionLetters.inviteReject, body: v } })} />
                    <TextAreaField label="Closing" value={content.decisionLetters.inviteReject.closing} onChange={(v) => updateSection('decisionLetters', { ...content.decisionLetters, inviteReject: { ...content.decisionLetters.inviteReject, closing: v } })} rows={2} />
                  </div>
                </div>

                <div className="border-t border-line pt-4">
                  <h3 className="font-semibold text-ink mb-3">Bid — Accept</h3>
                  <div className="space-y-3">
                    <StringListField label="Body paragraphs" value={content.decisionLetters.bidAccept.body} onChange={(v) => updateSection('decisionLetters', { ...content.decisionLetters, bidAccept: { ...content.decisionLetters.bidAccept, body: v } })} />
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      <TextField label="Bid-form step — prefix" value={content.decisionLetters.bidAccept.bidFormPrefix} onChange={(v) => updateSection('decisionLetters', { ...content.decisionLetters, bidAccept: { ...content.decisionLetters.bidAccept, bidFormPrefix: v } })} />
                      <TextField label="Bid-form step — button label" value={content.decisionLetters.bidAccept.bidFormButtonLabel} onChange={(v) => updateSection('decisionLetters', { ...content.decisionLetters, bidAccept: { ...content.decisionLetters.bidAccept, bidFormButtonLabel: v } })} />
                      <TextField label="Bid-form step — suffix" value={content.decisionLetters.bidAccept.bidFormSuffix} onChange={(v) => updateSection('decisionLetters', { ...content.decisionLetters, bidAccept: { ...content.decisionLetters.bidAccept, bidFormSuffix: v } })} />
                    </div>
                    <StringListField label="Next steps (after the bid-form step)" value={content.decisionLetters.bidAccept.nextSteps} onChange={(v) => updateSection('decisionLetters', { ...content.decisionLetters, bidAccept: { ...content.decisionLetters.bidAccept, nextSteps: v } })} rows={4} hint="Multi-line item: put the label line first, then indented detail lines below it." />
                    <TextAreaField label="Important note" value={content.decisionLetters.bidAccept.importantNote} onChange={(v) => updateSection('decisionLetters', { ...content.decisionLetters, bidAccept: { ...content.decisionLetters.bidAccept, importantNote: v } })} rows={2} />
                    <TextAreaField label="Closing" value={content.decisionLetters.bidAccept.closing} onChange={(v) => updateSection('decisionLetters', { ...content.decisionLetters, bidAccept: { ...content.decisionLetters.bidAccept, closing: v } })} rows={2} />
                  </div>
                </div>

                <div className="border-t border-line pt-4">
                  <h3 className="font-semibold text-ink mb-3">Bid — Reject</h3>
                  <div className="space-y-3">
                    <StringListField label="Body paragraphs" value={content.decisionLetters.bidReject.body} onChange={(v) => updateSection('decisionLetters', { ...content.decisionLetters, bidReject: { ...content.decisionLetters.bidReject, body: v } })} />
                    <TextAreaField label="Closing" value={content.decisionLetters.bidReject.closing} onChange={(v) => updateSection('decisionLetters', { ...content.decisionLetters, bidReject: { ...content.decisionLetters.bidReject, closing: v } })} rows={2} />
                  </div>
                </div>
              </>
            )}

            <SaveBar pending={pending} message={message} onSave={handleSave} onReset={handleReset} />
          </div>
        </div>
      </main>
    </div>
  )
}

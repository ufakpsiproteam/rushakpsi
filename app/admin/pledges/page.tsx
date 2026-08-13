'use client'

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import AdminNav from '@/components/admin/AdminNav'
import RusheePhoto from '@/components/RusheePhoto'
import { getPledges, getPledgeResumeUrl, type PledgeRecord } from './actions'

/**
 * Pledge directory — PRD §6.1.3.
 *
 * Access is enforced server-side in ./actions.ts. There is no shared
 * password and no sessionStorage gate; if the caller is not Admin /
 * Professional Chair / Director of Recruitment the action returns an
 * error and this page renders the denied state.
 */
export default function PledgesPage() {
  const [pledges, setPledges] = useState<PledgeRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [selected, setSelected] = useState<PledgeRecord | null>(null)
  const [resumeLoading, setResumeLoading] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    const { data, error: loadError } = await getPledges()
    if (loadError) {
      setError(loadError)
      setPledges([])
    } else {
      setError(null)
      setPledges(data || [])
    }
    setLoading(false)
  }, [])

  useEffect(() => {
    load()
  }, [load])

  useEffect(() => {
    if (!selected) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setSelected(null)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [selected])

  async function openResume(rusheeId: string) {
    setResumeLoading(true)
    const { url, error: resumeError } = await getPledgeResumeUrl(rusheeId)
    setResumeLoading(false)
    if (url) {
      window.open(url, '_blank', 'noopener,noreferrer')
    } else {
      alert(resumeError || 'Could not open the resume.')
    }
  }

  function exportCsv() {
    const headers = ['Name', 'Email', 'Phone', 'Major', 'Minor', 'Address']
    const rows = pledges.map((p) => [p.name, p.email, p.phoneNumber, p.major, p.minor, p.address])
    const escape = (value: string) => '"' + String(value ?? '').replace(/"/g, '""') + '"'
    const csv = [headers, ...rows].map((row) => row.map(escape).join(',')).join('\n')
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = 'pledge-directory.csv'
    link.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="app-shell">
      <AdminNav />

      <main className="app-container py-8 print:py-0">
        <header className="flex flex-wrap items-end justify-between gap-4 mb-6">
          <div>
            <p className="page-eyebrow">Admin</p>
            <h1 className="page-title mt-1">Pledge Directory</h1>
            <p className="page-subtitle">
              Everyone who received a bid, for onboarding and big/little matching.
            </p>
          </div>

          {!error && pledges.length > 0 && (
            <div className="flex gap-2 print:hidden">
              <button onClick={exportCsv} className="btn btn-secondary btn-sm">
                Export CSV
              </button>
              <button onClick={() => window.print()} className="btn btn-secondary btn-sm">
                Print roster
              </button>
            </div>
          )}
        </header>

        {loading ? (
          <div className="card">
            <div className="state-block">
              <div className="h-8 w-8 rounded-full border-2 border-line-strong border-t-ink animate-spin" />
              <p className="state-body mt-4">Loading the directory…</p>
            </div>
          </div>
        ) : error ? (
          <div className="card">
            <div className="state-block">
              <p className="state-title">Not available</p>
              <p className="state-body">{error}</p>
              <Link href="/admin/dashboard" className="btn btn-secondary btn-sm mt-5">
                Back to dashboard
              </Link>
            </div>
          </div>
        ) : pledges.length === 0 ? (
          <div className="card">
            <div className="state-block">
              <p className="state-title">No pledges yet</p>
              <p className="state-body">
                Rushees appear here once their Bid (Y) decision has been published.
              </p>
            </div>
          </div>
        ) : (
          <div className="card overflow-hidden">
            <div className="overflow-x-auto">
              <table className="data-table">
                <thead>
                  <tr>
                    <th className="w-16">Photo</th>
                    <th>Name</th>
                    <th>Email</th>
                    <th>Phone</th>
                    <th>Major</th>
                    <th>Minor</th>
                    <th>Address</th>
                  </tr>
                </thead>
                <tbody>
                  {pledges.map((pledge) => (
                    <tr key={pledge.id}>
                      <td>
                        <div className="w-10 h-10 rounded-full overflow-hidden bg-surface-sunken flex items-center justify-center">
                          <RusheePhoto
                            photo={pledge.photo}
                            alt=""
                            className="w-full h-full object-cover rushee-photo"
                            fallback={
                              <span className="text-xs text-ink-faint">
                                {pledge.name.slice(0, 1)}
                              </span>
                            }
                          />
                        </div>
                      </td>
                      <td>
                        <button
                          onClick={() => setSelected(pledge)}
                          className="font-medium underline underline-offset-2 decoration-line-strong hover:decoration-ink text-left"
                        >
                          {pledge.name}
                        </button>
                      </td>
                      <td>
                        {pledge.email ? (
                          <a href={`mailto:${pledge.email}`} className="hover:underline">
                            {pledge.email}
                          </a>
                        ) : (
                          <span className="text-ink-faint">—</span>
                        )}
                      </td>
                      <td>
                        {pledge.phoneNumber ? (
                          <a href={`tel:${pledge.phoneNumber}`} className="hover:underline">
                            {pledge.phoneNumber}
                          </a>
                        ) : (
                          <span className="text-ink-faint">—</span>
                        )}
                      </td>
                      <td>{pledge.major || <span className="text-ink-faint">—</span>}</td>
                      <td>{pledge.minor || <span className="text-ink-faint">—</span>}</td>
                      <td className="max-w-[16rem] truncate">
                        {pledge.address || <span className="text-ink-faint">—</span>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="px-4 py-3 border-t border-line bg-surface-alt">
              <p className="text-sm text-ink-muted">
                <span className="font-semibold text-ink">{pledges.length}</span>{' '}
                {pledges.length === 1 ? 'pledge' : 'pledges'}
              </p>
            </div>
          </div>
        )}
      </main>

      {selected && (
        <div
          className="modal-backdrop print:hidden"
          role="dialog"
          aria-modal="true"
          aria-label={`${selected.name} details`}
          onClick={() => setSelected(null)}
        >
          <div className="modal-panel max-w-3xl" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-12 h-12 rounded-full overflow-hidden bg-surface-sunken flex items-center justify-center shrink-0">
                  <RusheePhoto
                    photo={selected.photo}
                    alt=""
                    className="w-full h-full object-cover rushee-photo"
                    fallback={<span className="text-ink-faint">{selected.name.slice(0, 1)}</span>}
                  />
                </div>
                <div className="min-w-0">
                  <h2 className="section-title truncate">{selected.name}</h2>
                  <p className="text-sm text-ink-subtle truncate">
                    {selected.major || 'Major not specified'}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setSelected(null)}
                className="btn btn-ghost btn-sm"
                aria-label="Close"
              >
                Close
              </button>
            </div>

            <div className="p-5 space-y-6">
              <PledgeSection title="Contact information">
                <PledgeField label="Email" value={selected.email} href={`mailto:${selected.email}`} />
                <PledgeField label="Phone" value={selected.phoneNumber} href={`tel:${selected.phoneNumber}`} />
                <PledgeField label="UF address" value={selected.address} wide />
              </PledgeSection>

              <PledgeSection title="Academic information">
                <PledgeField label="Major" value={selected.major} />
                <PledgeField label="Minor" value={selected.minor} />
                <PledgeField label="GPA" value={selected.application?.gpa as string} />
                <PledgeField
                  label="Expected graduation"
                  value={selected.application?.expected_graduation_date as string}
                />
              </PledgeSection>

              {selected.application && (
                <div className="space-y-5">
                  <h3 className="section-title">Application</h3>
                  {APPLICATION_FIELDS.map(({ key, label }) => {
                    const value = selected.application?.[key] as string | undefined
                    if (!value) return null
                    return (
                      <div key={key}>
                        <p className="page-eyebrow">{label}</p>
                        <p className="mt-1.5 text-sm text-ink-muted whitespace-pre-wrap leading-relaxed">
                          {value}
                        </p>
                      </div>
                    )
                  })}

                  {(selected.application.resume_url as string) && (
                    <div>
                      <p className="page-eyebrow">Resume</p>
                      <button
                        onClick={() => openResume(selected.id)}
                        disabled={resumeLoading}
                        className="btn btn-secondary btn-sm mt-2"
                      >
                        {resumeLoading ? 'Preparing link…' : 'Open resume'}
                      </button>
                      <p className="field-help">Opens a private link that expires in 5 minutes.</p>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

const APPLICATION_FIELDS: { key: string; label: string }[] = [
  { key: 'outside_involvements', label: 'Outside involvements' },
  { key: 'how_heard_about_akpsi', label: 'How they heard about AKΨ' },
  { key: 'why_interested', label: 'Why they are interested' },
  { key: 'pillar_relation', label: 'Pillar that resonates' },
  { key: 'brother_connection_reason', label: 'Brother they connected with' },
  { key: 'monopoly_piece', label: 'Theme question 1' },
  { key: 'monopoly_theme_lesson', label: 'Theme question 2' },
]

function PledgeSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <h3 className="section-title mb-3">{title}</h3>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-4">{children}</div>
    </div>
  )
}

function PledgeField({
  label,
  value,
  href,
  wide,
}: {
  label: string
  value?: string | null
  href?: string
  wide?: boolean
}) {
  return (
    <div className={wide ? 'sm:col-span-2' : undefined}>
      <p className="page-eyebrow">{label}</p>
      {value ? (
        href ? (
          <a href={href} className="mt-1 block text-sm text-ink hover:underline break-words">
            {value}
          </a>
        ) : (
          <p className="mt-1 text-sm text-ink break-words">{value}</p>
        )
      ) : (
        <p className="mt-1 text-sm text-ink-faint">Not specified</p>
      )}
    </div>
  )
}

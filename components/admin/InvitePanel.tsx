'use client'

import { useState, useEffect, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { formatInstantInEST } from '@/lib/dateUtils'

/**
 * Brother invitations — PRD §6.2.2, §6.7.6.
 *
 * Replaces the shared access code that used to ship in the client bundle.
 * The raw token is returned exactly once, at issue time, so the link is
 * shown here for the admin to send and can never be retrieved again.
 */

interface Invite {
  id: string
  email: string
  full_name: string
  expires_at: string
  accepted_at: string | null
  revoked_at: string | null
  created_at: string
}

function inviteState(invite: Invite): { label: string; className: string } {
  if (invite.accepted_at) return { label: 'Accepted', className: 'badge badge-positive' }
  if (invite.revoked_at) return { label: 'Revoked', className: 'badge' }
  if (new Date(invite.expires_at).getTime() < Date.now()) {
    return { label: 'Expired', className: 'badge' }
  }
  return { label: 'Pending', className: 'badge badge-warning' }
}

export default function InvitePanel({ enabled = true }: { enabled?: boolean }) {
  const [invites, setInvites] = useState<Invite[]>([])
  const [loading, setLoading] = useState(true)
  const [fullName, setFullName] = useState('')
  const [email, setEmail] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [issuedLink, setIssuedLink] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)

  const authHeader = useCallback(async () => {
    const {
      data: { session },
    } = await supabase.auth.getSession()
    if (!session?.access_token) throw new Error('No active session')
    return {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${session.access_token}`,
    }
  }, [])

  const load = useCallback(async () => {
    try {
      const headers = await authHeader()
      const response = await fetch('/api/invites', { headers })
      const result = await response.json()
      if (response.ok) setInvites(result.data || [])
    } catch {
      // Non-fatal: the roles table below still works.
    } finally {
      setLoading(false)
    }
  }, [authHeader])

  useEffect(() => {
    load()
  }, [load])

  async function issue(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setIssuedLink(null)
    setCopied(false)
    setSubmitting(true)

    try {
      const headers = await authHeader()
      const response = await fetch('/api/invites', {
        method: 'POST',
        headers,
        body: JSON.stringify({ email, fullName }),
      })
      const result = await response.json()

      if (!response.ok) {
        setError(result.error || 'Could not create the invitation.')
        return
      }

      setIssuedLink(result.inviteUrl)
      setFullName('')
      setEmail('')
      await load()
    } catch {
      setError('Could not reach the server.')
    } finally {
      setSubmitting(false)
    }
  }

  async function revoke(inviteId: string) {
    if (!confirm('Revoke this invitation? The link will stop working immediately.')) return

    try {
      const headers = await authHeader()
      await fetch('/api/invites', {
        method: 'DELETE',
        headers,
        body: JSON.stringify({ inviteId }),
      })
      await load()
    } catch {
      alert('Could not revoke the invitation.')
    }
  }

  return (
    <section className="card card-pad mb-8">
      <h2 className="section-title">Invite a brother</h2>
      <p className="field-help">
        Brother accounts are provisioned, not self-served. Each invitation is for one
        person, works once, and expires in 14 days.
      </p>

      {!enabled && (
        <div className="alert alert-negative mt-4" role="alert">
          New brother account creation is turned off. Turn it back on above to invite someone.
        </div>
      )}

      <form onSubmit={issue} className="mt-4 grid gap-3 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
        <div>
          <label className="field-label" htmlFor="invite-full-name">
            Full name
          </label>
          <input
            id="invite-full-name"
            className="input"
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            placeholder="Jordan Reyes"
            disabled={!enabled}
            required
          />
        </div>

        <div>
          <label className="field-label" htmlFor="invite-email-field">
            Email
          </label>
          <input
            id="invite-email-field"
            className="input"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="jordan@ufl.edu"
            disabled={!enabled}
            required
          />
        </div>

        <button type="submit" disabled={submitting || !enabled} className="btn btn-primary">
          {submitting ? 'Creating…' : 'Create invite'}
        </button>
      </form>

      {error && (
        <div className="alert alert-negative mt-4" role="alert">
          {error}
        </div>
      )}

      {issuedLink && (
        <div className="alert alert-positive mt-4 flex-col items-start">
          <p className="font-semibold">Invitation created — send this link now.</p>
          <p className="text-xs mt-1 opacity-90">
            This is the only time it will be shown. It isn&rsquo;t stored anywhere.
          </p>
          <div className="mt-3 flex w-full gap-2">
            <input readOnly value={issuedLink} className="input text-xs" onFocus={(e) => e.target.select()} />
            <button
              type="button"
              onClick={() => {
                navigator.clipboard?.writeText(issuedLink)
                setCopied(true)
              }}
              className="btn btn-secondary btn-sm shrink-0"
            >
              {copied ? 'Copied' : 'Copy'}
            </button>
          </div>
        </div>
      )}

      <div className="mt-6">
        <h3 className="page-eyebrow">Invitations</h3>

        {loading ? (
          <p className="text-sm text-ink-subtle mt-3">Loading…</p>
        ) : invites.length === 0 ? (
          <p className="text-sm text-ink-subtle mt-3">No invitations yet.</p>
        ) : (
          <div className="mt-3 overflow-x-auto">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Email</th>
                  <th>Status</th>
                  <th>Expires</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {invites.map((invite) => {
                  const state = inviteState(invite)
                  const canRevoke = !invite.accepted_at && !invite.revoked_at
                  return (
                    <tr key={invite.id}>
                      <td>{invite.full_name}</td>
                      <td>{invite.email}</td>
                      <td>
                        <span className={state.className}>{state.label}</span>
                      </td>
                      <td className="whitespace-nowrap">
                        {formatInstantInEST(invite.expires_at, 'MMM d, yyyy')}
                      </td>
                      <td className="text-right">
                        {canRevoke && (
                          <button onClick={() => revoke(invite.id)} className="btn btn-ghost btn-sm">
                            Revoke
                          </button>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </section>
  )
}

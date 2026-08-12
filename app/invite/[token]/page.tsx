'use client'

import { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { POLICY_DEFAULTS, validatePassword, passwordHint } from '@/lib/policy'

type Screen = 'validating' | 'invalid' | 'form' | 'done'

/**
 * Brother invitation acceptance — PRD §6.2.2.
 *
 * The invitee lands here with their name and email pre-filled and
 * read-only; they set a password and accept. The account is created with
 * no roles.
 */
export default function AcceptInvitePage() {
  const params = useParams<{ token: string }>()
  const router = useRouter()
  const token = typeof params?.token === 'string' ? params.token : ''

  const [screen, setScreen] = useState<Screen>('validating')
  const [invite, setInvite] = useState<{ email: string; fullName: string } | null>(null)
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    let cancelled = false

    async function validate() {
      try {
        const response = await fetch('/api/invites/validate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ token }),
        })
        const result = await response.json()
        if (cancelled) return

        if (result.valid) {
          setInvite({ email: result.email, fullName: result.fullName })
          setScreen('form')
        } else {
          setScreen('invalid')
        }
      } catch {
        if (!cancelled) setScreen('invalid')
      }
    }

    if (token) validate()
    else setScreen('invalid')

    return () => {
      cancelled = true
    }
  }, [token])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')

    const passwordError = validatePassword(password, POLICY_DEFAULTS)
    if (passwordError) {
      setError(passwordError)
      return
    }

    if (password !== confirm) {
      setError('Passwords do not match')
      return
    }

    setSubmitting(true)

    try {
      const response = await fetch('/api/invites/accept', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, password }),
      })
      const result = await response.json()

      if (!response.ok) {
        setError(result.error || 'Could not create your account.')
        setSubmitting(false)
        return
      }

      setScreen('done')
      setTimeout(() => router.push('/auth/signin'), 2500)
    } catch {
      setError('Could not reach the server. Please try again.')
      setSubmitting(false)
    }
  }

  return (
    <div className="min-h-screen bg-canvas flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <p className="lettermark text-2xl">ΑΚΨ</p>
          <p className="page-eyebrow mt-2">Alpha Phi Chapter · University of Florida</p>
        </div>

        <div className="card card-pad">
          {screen === 'validating' && (
            <div className="state-block">
              <div className="h-8 w-8 rounded-full border-2 border-line-strong border-t-ink animate-spin" />
              <p className="state-body mt-4">Checking your invitation…</p>
            </div>
          )}

          {screen === 'invalid' && (
            <div className="state-block">
              <p className="state-title">Invitation not valid</p>
              <p className="state-body">
                This invitation link is invalid, has expired, or has already been used. Ask an
                admin to send you a new one.
              </p>
              <Link href="/" className="btn btn-secondary btn-sm mt-5">
                Back to home
              </Link>
            </div>
          )}

          {screen === 'done' && (
            <div className="state-block">
              <p className="state-title">Account Created!</p>
              <p className="state-body">
                Your brother account is ready. You&rsquo;ll use this to check in at events and
                evaluate rushees during rush.
              </p>
              <p className="text-xs text-ink-faint mt-4">Taking you to sign in…</p>
            </div>
          )}

          {screen === 'form' && invite && (
            <form onSubmit={handleSubmit} className="space-y-5">
              <div>
                <h1 className="page-title text-xl">Accept your invitation</h1>
                <p className="page-subtitle">
                  Set a password to finish creating your brother account.
                </p>
              </div>

              <div>
                <label className="field-label" htmlFor="invite-name">
                  Full name
                </label>
                <input
                  id="invite-name"
                  className="input"
                  value={invite.fullName}
                  readOnly
                  disabled
                />
              </div>

              <div>
                <label className="field-label" htmlFor="invite-email">
                  Email
                </label>
                <input id="invite-email" className="input" value={invite.email} readOnly disabled />
                <p className="field-help">
                  Both fields come from your invitation and can&rsquo;t be changed here.
                </p>
              </div>

              <div>
                <label className="field-label" htmlFor="invite-password">
                  Create password
                </label>
                <div className="relative">
                  <input
                    id="invite-password"
                    className="input pr-16"
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    autoComplete="new-password"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((v) => !v)}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-xs font-medium text-ink-muted px-2 py-1 rounded hover:bg-surface-sunken allow-compact-target"
                  >
                    {showPassword ? 'Hide' : 'Show'}
                  </button>
                </div>
                <p className="field-help">{passwordHint(POLICY_DEFAULTS)}</p>
              </div>

              <div>
                <label className="field-label" htmlFor="invite-confirm">
                  Confirm password
                </label>
                <input
                  id="invite-confirm"
                  className="input"
                  type={showPassword ? 'text' : 'password'}
                  value={confirm}
                  onChange={(e) => setConfirm(e.target.value)}
                  autoComplete="new-password"
                  required
                />
              </div>

              {error && (
                <div className="alert alert-negative" role="alert">
                  {error}
                </div>
              )}

              <button type="submit" disabled={submitting} className="btn btn-primary btn-block">
                {submitting ? 'Creating your account…' : 'Accept invitation'}
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  )
}

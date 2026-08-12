'use client'

import { useState } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'

/**
 * Password recovery — PRD §6.2.4, R53.
 *
 * Two paths, both supported. The self-service email path was missing
 * entirely: this page had no email field and no send action, so every
 * rushee who forgot their password had to find a brother in person, even
 * though /auth/reset-password (the page the emailed link lands on) was
 * fully built.
 */
export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('')
  const [sending, setSending] = useState(false)
  const [sent, setSent] = useState(false)
  const [error, setError] = useState('')

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')

    const trimmed = email.trim()
    if (!trimmed) {
      setError('Enter the email address on your account.')
      return
    }

    setSending(true)

    try {
      const redirectTo =
        typeof window !== 'undefined' ? `${window.location.origin}/auth/reset-password` : undefined

      const { error: resetError } = await supabase.auth.resetPasswordForEmail(trimmed, {
        redirectTo,
      })

      // Always report success. Confirming whether an address exists would
      // turn this form into an account-enumeration oracle.
      if (resetError) {
        console.error('[forgot-password] reset request failed')
      }
      setSent(true)
    } catch {
      setSent(true)
    } finally {
      setSending(false)
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
          <h1 className="page-title text-xl">Need help signing in?</h1>

          {sent ? (
            <div className="mt-4">
              <div className="alert alert-positive">
                <p>
                  If an account exists for <span className="font-semibold">{email.trim()}</span>,
                  a reset link is on its way. Check your inbox and your spam folder.
                </p>
              </div>
              <p className="field-help mt-3">The link expires after a short time.</p>
              <Link href="/auth/signin" className="btn btn-primary btn-block mt-5">
                Back to sign in
              </Link>
            </div>
          ) : (
            <>
              <p className="page-subtitle">Enter your email and we&rsquo;ll send you a reset link.</p>

              <form onSubmit={handleSubmit} className="mt-5 space-y-4">
                <div>
                  <label className="field-label" htmlFor="forgot-email">
                    Email
                  </label>
                  <input
                    id="forgot-email"
                    className="input"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="you@ufl.edu"
                    autoComplete="email"
                    autoFocus
                  />
                </div>

                {error && (
                  <div className="alert alert-negative" role="alert">
                    {error}
                  </div>
                )}

                <button type="submit" disabled={sending} className="btn btn-primary btn-block">
                  {sending ? 'Sending…' : 'Send reset link'}
                </button>
              </form>
            </>
          )}

          <div className="mt-7 pt-6 border-t border-line">
            <h2 className="section-title">Prefer to do it in person?</h2>
            <ul className="mt-3 space-y-2 text-sm text-ink-muted">
              <li className="flex gap-2">
                <span aria-hidden="true">·</span>
                <span>Come to the check-in table and we&rsquo;ll reset it for you.</span>
              </li>
              <li className="flex gap-2">
                <span aria-hidden="true">·</span>
                <span>Reach out in GroupMe with your full name and email.</span>
              </li>
              <li className="flex gap-2">
                <span aria-hidden="true">·</span>
                <span>Ask any brother to assist you with a reset.</span>
              </li>
            </ul>
          </div>

          {!sent && (
            <Link href="/auth/signin" className="btn btn-ghost btn-block mt-5">
              Back to sign in
            </Link>
          )}
        </div>
      </div>
    </div>
  )
}

'use client'

import Link from 'next/link'
import { useState, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { useAuth } from '@/contexts/AuthContext'
import PrivacyPolicyNote from '@/components/portal/PrivacyPolicyNote'

function SignInForm() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const router = useRouter()
  const searchParams = useSearchParams()
  const { signIn } = useAuth()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      await signIn(email, password)

      // Get the updated profile to determine redirect
      const { getCurrentUserProfile } = await import('@/lib/auth')
      const userProfile = await getCurrentUserProfile()

      // Check for redirect parameter (set by middleware)
      const redirectTo = searchParams.get('redirect')

      // Validate redirect matches user's allowed routes
      let targetRoute = '/'
      if (userProfile?.account_type === 'brother' && userProfile?.access_level === 'admin') {
        targetRoute = redirectTo?.startsWith('/admin') ? redirectTo : '/admin/dashboard'
      } else if (userProfile?.account_type === 'brother') {
        targetRoute = redirectTo?.startsWith('/brother') ? redirectTo : '/brother/dashboard'
      } else if (userProfile?.account_type === 'rushee') {
        targetRoute = redirectTo?.startsWith('/rushee') ? redirectTo : '/rushee/dashboard'
      }

      // Use hard redirect to ensure middleware runs
      window.location.href = targetRoute
    } catch (err: any) {
      console.error('Sign in error:', err)
      // Auth's own 5xx errors (e.g. "database error querying schema") are
      // Supabase's internal wording for a transient capacity issue, not
      // anything the person did wrong — show something actionable instead.
      const isCapacityError = err?.status >= 500 || /database error|querying schema/i.test(err?.message || '')
      setError(
        isCapacityError
          ? 'Site is at capacity right now. Please wait a few seconds and try again.'
          : err.message || 'Failed to sign in. Please check your credentials.'
      )
      setLoading(false)
    }
  }

  return (
    <div className="card card-pad">
      {error && (
        <div className="alert alert-negative mb-4">
          <p className="text-sm">{error}</p>
        </div>
      )}
      <form onSubmit={handleSubmit} className="space-y-6">
        <div>
          <label htmlFor="email" className="field-label">
            Email Address
          </label>
          <input
            id="email"
            name="email"
            type="email"
            autoComplete="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="input"
            placeholder="your.email@ufl.edu"
          />
        </div>

        <div>
          <div className="flex items-center justify-between mb-2">
            <label htmlFor="password" className="field-label mb-0">
              Password
            </label>
            <Link href="/auth/forgot-password" className="text-sm text-ink-muted hover:text-ink">
              Forgot password?
            </Link>
          </div>
          <div className="relative">
            <input
              id="password"
              name="password"
              type={showPassword ? 'text' : 'password'}
              autoComplete="current-password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="input pr-12"
              placeholder="••••••••"
            />
            <button
              type="button"
              onClick={() => setShowPassword((prev) => !prev)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-ink-subtle hover:text-ink transition-colors"
              aria-label={showPassword ? 'Hide password' : 'Show password'}
            >
              {showPassword ? (
                <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 3l18 18" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.477 10.477a3 3 0 014.242 4.242" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.88 5.09A9.96 9.96 0 0112 5c4.477 0 8.268 2.943 9.542 7a9.956 9.956 0 01-4.103 5.277M6.228 6.228A9.956 9.956 0 002.458 12c1.274 4.057 5.065 7 9.542 7 1.128 0 2.214-.185 3.232-.525" />
                </svg>
              ) : (
                <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.477 0 8.268 2.943 9.542 7-1.274 4.057-5.065 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
              )}
            </button>
          </div>
        </div>

        <button type="submit" disabled={loading} className="btn btn-primary btn-lg btn-block">
          {loading ? 'Signing In...' : 'Sign In'}
        </button>
      </form>
    </div>
  )
}

export default function SignIn() {
  return (
    <div className="app-shell relative overflow-hidden">
      <div className="relative flex min-h-screen items-center justify-center px-4 sm:px-6 lg:px-8 py-6 sm:py-10">
        <div className="w-full max-w-5xl card">
          <div className="grid grid-cols-1 lg:grid-cols-[1fr_1.1fr]">
            <div className="px-6 sm:px-10 py-6 sm:py-8 border-b border-line lg:border-b-0 lg:border-r">
              <Link href="/" className="inline-flex items-baseline gap-3">
                <span className="lettermark text-4xl">ΑΚΨ</span>
                <span className="page-eyebrow">Alpha Phi Chapter</span>
              </Link>
              <h2 className="page-title mt-6 text-3xl sm:text-4xl">Welcome back</h2>
              <p className="mt-3 text-ink-muted max-w-sm">
                Sign in to manage your rush journey, check in to events, and track your progress.
              </p>
            </div>

            <div className="px-6 sm:px-10 py-6 sm:py-8">
              {/* Sign In Form - wrapped in Suspense for useSearchParams */}
              <Suspense fallback={
                <div className="card card-pad">
                  <div className="animate-pulse space-y-6">
                    <div className="h-12 bg-line rounded"></div>
                    <div className="h-12 bg-line rounded"></div>
                    <div className="h-12 bg-line rounded"></div>
                  </div>
                </div>
              }>
                <SignInForm />
              </Suspense>

              {/* Privacy notice */}
              <div className="mt-3">
                <PrivacyPolicyNote variant="signin" />
              </div>

              {/* Sign Up Link */}
              <div className="mt-4">
                <p className="text-ink-muted">
                  Don't have an account?{' '}
                  <Link href="/auth/signup" className="text-ink font-semibold hover:text-ink-muted">
                    Sign up for Rush
                  </Link>
                </p>
              </div>

              {/* Back to Home */}
              <div className="mt-3">
                <Link href="/" className="text-sm text-ink-subtle hover:text-ink-muted">
                  ← Back to home
                </Link>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

'use client'

import Link from 'next/link'
import { useState, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { useAuth } from '@/contexts/AuthContext'

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
      setError(err.message || 'Failed to sign in. Please check your credentials.')
      setLoading(false)
    }
  }

  return (
    <div className="bg-white border-2 border-black rounded-lg p-8">
      {error && (
        <div className="mb-4 p-3 bg-red-50 border-2 border-red-500 rounded-lg">
          <p className="text-red-700 text-sm">{error}</p>
        </div>
      )}
      <form onSubmit={handleSubmit} className="space-y-6">
        <div>
          <label htmlFor="email" className="block text-sm font-medium text-black mb-2">
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
            className="w-full px-4 py-3 bg-white border-2 border-line-strong rounded-lg text-black placeholder-ink-faint focus:outline-none focus:ring-2 focus:ring-black focus:border-transparent"
            placeholder="your.email@ufl.edu"
          />
        </div>

        <div>
          <div className="flex items-center justify-between mb-2">
            <label htmlFor="password" className="block text-sm font-medium text-black">
              Password
            </label>
            <Link href="/auth/forgot-password" className="text-sm text-ink-muted hover:text-black">
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
              className="w-full px-4 py-3 pr-12 bg-white border-2 border-line-strong rounded-lg text-black placeholder-ink-faint focus:outline-none focus:ring-2 focus:ring-black focus:border-transparent"
              placeholder="••••••••"
            />
            <button
              type="button"
              onClick={() => setShowPassword((prev) => !prev)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-ink-subtle hover:text-black transition-colors"
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

        <button
          type="submit"
          disabled={loading}
          className="w-full py-3 px-4 bg-black text-white rounded-lg font-semibold hover:bg-inverse-soft transition-colors focus:outline-none focus:ring-2 focus:ring-black focus:ring-offset-2 disabled:bg-ink-faint disabled:cursor-not-allowed"
        >
          {loading ? 'Signing In...' : 'Sign In'}
        </button>
      </form>
    </div>
  )
}

export default function SignIn() {
  return (
    <div className="min-h-screen bg-canvas relative overflow-hidden">
      <div className="absolute inset-0">
        <div className="absolute -top-24 -left-24 h-72 w-72 rounded-full bg-black/5 blur-3xl" />
        <div className="absolute bottom-0 right-0 h-96 w-96 rounded-full bg-black/5 blur-3xl" />
      </div>
      <div className="relative flex min-h-screen items-center justify-center px-4 sm:px-6 lg:px-8 py-6 sm:py-10">
        <div className="w-full max-w-5xl rounded-3xl border border-black/10 bg-white/80 backdrop-blur shadow-[0_30px_80px_rgba(0,0,0,0.12)]">
          <div className="grid grid-cols-1 lg:grid-cols-[1fr_1.1fr]">
            <div className="px-6 sm:px-10 py-6 sm:py-8 border-b border-black/10 lg:border-b-0 lg:border-r">
              <Link href="/" className="inline-flex items-center gap-3">
                <span className="text-4xl font-bold text-black">ΑΚΨ</span>
                <span className="text-xs uppercase tracking-[0.35em] text-ink-subtle">Alpha Phi Chapter</span>
              </Link>
              <h2 className="mt-6 text-3xl sm:text-4xl font-semibold text-black">Welcome back</h2>
              <p className="mt-3 text-ink-muted max-w-sm">
                Sign in to manage your rush journey, check in to events, and track your progress.
              </p>
            </div>

            <div className="px-6 sm:px-10 py-6 sm:py-8">
              {/* Sign In Form - wrapped in Suspense for useSearchParams */}
              <Suspense fallback={
                <div className="bg-white border border-black/10 rounded-2xl p-8">
                  <div className="animate-pulse space-y-6">
                    <div className="h-12 bg-line rounded"></div>
                    <div className="h-12 bg-line rounded"></div>
                    <div className="h-12 bg-line rounded"></div>
                  </div>
                </div>
              }>
                <SignInForm />
              </Suspense>

              {/* Sign Up Link */}
              <div className="mt-4">
                <p className="text-ink-muted">
                  Don't have an account?{' '}
                  <Link href="/auth/signup" className="text-black font-semibold hover:text-ink-muted">
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

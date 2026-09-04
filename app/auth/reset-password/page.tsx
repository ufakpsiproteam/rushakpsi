'use client'

import Link from 'next/link'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { updatePassword } from '@/lib/auth'
import { supabase } from '@/lib/supabase'
import { POLICY, validatePassword } from '@/lib/policy'

export default function ResetPassword() {
  const router = useRouter()
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)
  const [loading, setLoading] = useState(false)
  const [validating, setValidating] = useState(true)
  const [isValidToken, setIsValidToken] = useState(false)

  useEffect(() => {
    // Handle the password reset token from URL
    const handlePasswordResetToken = async () => {
      try {
        // PKCE flow (default for @supabase/ssr's createBrowserClient): the
        // recovery link redirects back here with ?code=... in the query
        // string, not the hash fragment. Must be exchanged for a session.
        const queryParams = new URLSearchParams(window.location.search)
        const code = queryParams.get('code')

        if (code) {
          const { data, error } = await supabase.auth.exchangeCodeForSession(code)

          if (error) throw error

          if (data.session) {
            setIsValidToken(true)
            // Clean up the URL query string
            window.history.replaceState(null, '', window.location.pathname)
          } else {
            throw new Error('No session created from recovery code')
          }
          setValidating(false)
          return
        }

        // Fallback: implicit flow, where Supabase sends the token as a hash
        // fragment instead of a query param.
        const hashParams = new URLSearchParams(window.location.hash.substring(1))
        const accessToken = hashParams.get('access_token')
        const refreshToken = hashParams.get('refresh_token')
        const type = hashParams.get('type')


        if (type === 'recovery') {
          // Check if this is a PKCE token (starts with "pkce_")
          if (accessToken?.startsWith('pkce_')) {
            // For PKCE tokens, verify the OTP
            const { data, error } = await supabase.auth.verifyOtp({
              token_hash: accessToken,
              type: 'recovery',
            })


            if (error) throw error

            if (data.session) {
              setIsValidToken(true)
              // Clean up the URL hash
              window.history.replaceState(null, '', window.location.pathname)
            } else {
              throw new Error('No session created from PKCE token')
            }
          } else if (accessToken) {
            // Regular access token - set session directly
            const { data, error } = await supabase.auth.setSession({
              access_token: accessToken,
              refresh_token: refreshToken || '',
            })

            if (error) throw error

            if (data.session) {
              setIsValidToken(true)
              // Clean up the URL hash
              window.history.replaceState(null, '', window.location.pathname)
            } else {
              throw new Error('No session created')
            }
          } else {
            throw new Error('No access token provided')
          }
        } else {
          // Check if we already have a valid session
          const { data: { session } } = await supabase.auth.getSession()
          if (session) {
            setIsValidToken(true)
          } else {
            setError('Invalid or expired reset link. Please request a new password reset.')
          }
        }
      } catch (err: any) {
        console.error('Session validation error:', err)
        setError(err.message || 'Invalid or expired reset link. Please request a new password reset.')
      } finally {
        setValidating(false)
      }
    }

    handlePasswordResetToken()
  }, [])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')

    // Validation
    const passwordError = validatePassword(password, POLICY)
    if (passwordError) {
      setError(passwordError)
      return
    }

    if (password !== confirmPassword) {
      setError('Passwords do not match')
      return
    }

    setLoading(true)

    try {
      await updatePassword(password)
      setSuccess(true)

      // Redirect to sign in after 3 seconds
      setTimeout(() => {
        router.push('/auth/signin')
      }, 3000)
    } catch (err: any) {
      console.error('Password update error:', err)
      setError(err.message || 'Failed to update password. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  if (validating) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-ink"></div>
          <p className="mt-4 text-ink-muted">Validating reset link...</p>
        </div>
      </div>
    )
  }

  if (!isValidToken) {
    return (
      <div className="relative flex min-h-screen items-center justify-center px-4 sm:px-6 lg:px-8 py-6 sm:py-10">
        <div className="w-full max-w-md">
          <div className="card card-pad">
            <div className="alert alert-negative">
              <p className="font-semibold mb-1">Invalid Reset Link</p>
              <p className="text-sm">{error}</p>
            </div>

            <div className="mt-6 text-center">
              <Link href="/auth/forgot-password" className="text-ink font-semibold hover:text-ink-muted">
                Request a new password reset
              </Link>
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="relative flex min-h-screen items-center justify-center px-4 sm:px-6 lg:px-8 py-6 sm:py-10">
      <div className="w-full max-w-md">
        <div className="card card-pad">
          <Link href="/" className="inline-flex items-baseline gap-3 mb-6">
            <span className="lettermark text-2xl">ΑΚΨ</span>
            <span className="page-eyebrow">Alpha Phi Chapter</span>
          </Link>

          <h2 className="page-title text-2xl mb-3">Reset Password</h2>
          <p className="text-ink-muted mb-6">
            Enter your new password below.
          </p>

          {success ? (
            <div className="alert alert-positive">
              <p className="font-semibold mb-1">Password Updated!</p>
              <p className="text-sm">
                Your password has been successfully updated. Redirecting you to sign in...
              </p>
            </div>
          ) : (
            <>
              {error && (
                <div className="alert alert-negative mb-4">
                  <p className="text-sm">{error}</p>
                </div>
              )}

              <form onSubmit={handleSubmit} className="space-y-6">
                <div>
                  <label htmlFor="password" className="field-label">
                    New Password
                  </label>
                  <div className="relative">
                    <input
                      id="password"
                      name="password"
                      type={showPassword ? 'text' : 'password'}
                      autoComplete="new-password"
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
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
                        </svg>
                      ) : (
                        <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.065 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                        </svg>
                      )}
                    </button>
                  </div>
                  <p className="field-help">{`Must be ${POLICY.security.minPasswordLength} characters or more`}</p>
                </div>

                <div>
                  <label htmlFor="confirmPassword" className="field-label">
                    Confirm New Password
                  </label>
                  <div className="relative">
                    <input
                      id="confirmPassword"
                      name="confirmPassword"
                      type={showConfirmPassword ? 'text' : 'password'}
                      autoComplete="new-password"
                      required
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      className="input pr-12"
                      placeholder="••••••••"
                    />
                    <button
                      type="button"
                      onClick={() => setShowConfirmPassword((prev) => !prev)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-ink-subtle hover:text-ink transition-colors"
                      aria-label={showConfirmPassword ? 'Hide password' : 'Show password'}
                    >
                      {showConfirmPassword ? (
                        <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
                        </svg>
                      ) : (
                        <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.065 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                        </svg>
                      )}
                    </button>
                  </div>
                </div>

                <button type="submit" disabled={loading} className="btn btn-primary btn-lg btn-block">
                  {loading ? 'Updating Password...' : 'Update Password'}
                </button>
              </form>
            </>
          )}

          <div className="mt-6 text-center">
            <Link href="/auth/signin" className="text-sm text-ink-muted hover:text-ink">
              ← Back to sign in
            </Link>
          </div>
        </div>
      </div>
    </div>
  )
}

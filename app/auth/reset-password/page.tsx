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
        // Check if there's a hash in the URL (Supabase sends token as hash fragment)
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
      <div className="min-h-screen bg-canvas flex items-center justify-center">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-black"></div>
          <p className="mt-4 text-ink-muted">Validating reset link...</p>
        </div>
      </div>
    )
  }

  if (!isValidToken) {
    return (
      <div className="min-h-screen bg-canvas relative overflow-hidden">
        <div className="absolute inset-0">
          <div className="absolute -top-24 -left-24 h-72 w-72 rounded-full bg-black/5 blur-3xl" />
          <div className="absolute bottom-0 right-0 h-96 w-96 rounded-full bg-black/5 blur-3xl" />
        </div>
        <div className="relative flex min-h-screen items-center justify-center px-4 sm:px-6 lg:px-8 py-6 sm:py-10">
          <div className="w-full max-w-md">
            <div className="rounded-3xl border border-black/10 bg-white/80 backdrop-blur shadow-[0_30px_80px_rgba(0,0,0,0.12)] p-8">
              <div className="bg-red-50 border-2 border-red-500 rounded-lg p-6">
                <div className="flex items-start gap-3">
                  <svg className="w-6 h-6 text-red-600 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <div>
                    <h3 className="text-red-800 font-semibold mb-1">Invalid Reset Link</h3>
                    <p className="text-red-700 text-sm">{error}</p>
                  </div>
                </div>
              </div>

              <div className="mt-6 text-center">
                <Link href="/auth/forgot-password" className="text-black font-semibold hover:text-ink-muted">
                  Request a new password reset
                </Link>
              </div>
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-canvas relative overflow-hidden">
      <div className="absolute inset-0">
        <div className="absolute -top-24 -left-24 h-72 w-72 rounded-full bg-black/5 blur-3xl" />
        <div className="absolute bottom-0 right-0 h-96 w-96 rounded-full bg-black/5 blur-3xl" />
      </div>
      <div className="relative flex min-h-screen items-center justify-center px-4 sm:px-6 lg:px-8 py-6 sm:py-10">
        <div className="w-full max-w-md">
          <div className="rounded-3xl border border-black/10 bg-white/80 backdrop-blur shadow-[0_30px_80px_rgba(0,0,0,0.12)] p-8">
            <Link href="/" className="inline-flex items-center gap-3 mb-6">
              <span className="text-4xl font-bold text-black">ΑΚΨ</span>
              <span className="text-xs uppercase tracking-[0.35em] text-ink-subtle">Alpha Phi Chapter</span>
            </Link>

            <h2 className="text-3xl font-semibold text-black mb-3">Reset Password</h2>
            <p className="text-ink-muted mb-6">
              Enter your new password below.
            </p>

            {success ? (
              <div className="bg-green-50 border-2 border-green-500 rounded-lg p-6">
                <div className="flex items-start gap-3">
                  <svg className="w-6 h-6 text-green-600 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <div>
                    <h3 className="text-green-800 font-semibold mb-1">Password Updated!</h3>
                    <p className="text-green-700 text-sm">
                      Your password has been successfully updated. Redirecting you to sign in...
                    </p>
                  </div>
                </div>
              </div>
            ) : (
              <div className="bg-white border-2 border-black rounded-lg p-8">
                {error && (
                  <div className="mb-4 p-3 bg-red-50 border-2 border-red-500 rounded-lg">
                    <p className="text-red-700 text-sm">{error}</p>
                  </div>
                )}

                <form onSubmit={handleSubmit} className="space-y-6">
                  <div>
                    <label htmlFor="password" className="block text-sm font-medium text-black mb-2">
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
                    <p className="mt-1 text-xs text-ink-subtle">{`Must be ${POLICY.security.minPasswordLength} characters or more`}</p>
                  </div>

                  <div>
                    <label htmlFor="confirmPassword" className="block text-sm font-medium text-black mb-2">
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
                        className="w-full px-4 py-3 pr-12 bg-white border-2 border-line-strong rounded-lg text-black placeholder-ink-faint focus:outline-none focus:ring-2 focus:ring-black focus:border-transparent"
                        placeholder="••••••••"
                      />
                      <button
                        type="button"
                        onClick={() => setShowConfirmPassword((prev) => !prev)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-ink-subtle hover:text-black transition-colors"
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

                  <button
                    type="submit"
                    disabled={loading}
                    className="w-full py-3 px-4 bg-black text-white rounded-lg font-semibold hover:bg-inverse-soft transition-colors focus:outline-none focus:ring-2 focus:ring-black focus:ring-offset-2 disabled:bg-ink-faint disabled:cursor-not-allowed"
                  >
                    {loading ? 'Updating Password...' : 'Update Password'}
                  </button>
                </form>
              </div>
            )}

            <div className="mt-6 text-center">
              <Link href="/auth/signin" className="text-sm text-ink-muted hover:text-black">
                ← Back to sign in
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

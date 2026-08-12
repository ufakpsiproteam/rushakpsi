'use client'

import Link from 'next/link'
import { useState } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { POLICY, loadPolicy, validatePassword, passwordHint } from '@/lib/policy'

export default function SignUp() {
  const steps = ['Basics', 'Academics', 'Security']
  const [step, setStep] = useState(0)
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    password: '',
    confirmPassword: '',
    major: '',
    year: '',
  })
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const { signUp } = useAuth()

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value
    })
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')

    // Validation
    if (!formData.name || !formData.email) {
      setError('Please provide your name and email')
      return
    }

    if (!formData.major || !formData.year) {
      setError('Please provide your major and year')
      return
    }

    if (formData.password !== formData.confirmPassword) {
      setError('Passwords do not match')
      return
    }

    const passwordError = validatePassword(formData.password, POLICY)
    if (passwordError) {
      setError(passwordError)
      return
    }

    setLoading(true)

    try {
      await signUp(
        formData.email,
        formData.password,
        formData.name,
        'rushee',
        'basic',
        {
          major: formData.major,
          year: formData.year
        }
      )

      // Redirect (hard redirect for middleware)
      window.location.href = '/rushee/dashboard'
    } catch (err: any) {
      console.error('Sign up error:', err)
      setError(err.message || 'Failed to create account. Please try again.')
      setLoading(false)
    }
  }

  const handleNext = () => {
    setError('')
    if (step === 0 && (!formData.name || !formData.email)) {
      setError('Please provide your name and email')
      return
    }
    if (step === 1 && (!formData.major || !formData.year)) {
      setError('Please provide your major and year')
      return
    }
    setStep((prev) => Math.min(prev + 1, steps.length - 1))
  }

  const handleBack = () => {
    setError('')
    setStep((prev) => Math.max(prev - 1, 0))
  }

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
              <h2 className="mt-6 text-3xl sm:text-4xl font-semibold text-black">
                Start Your Rush Journey
              </h2>
              <p className="mt-3 text-ink-muted max-w-sm">
                A few quick steps and you&apos;re in.
              </p>
              <div className="mt-6 rounded-2xl border border-black/10 bg-white px-5 py-4">
                <p className="text-xs uppercase tracking-[0.35em] text-ink-subtle">Progress</p>
                <div className="mt-3 flex items-center justify-between text-sm font-semibold text-ink-muted">
                  <span>Step {step + 1} of {steps.length}</span>
                  <span>{steps[step]}</span>
                </div>
                <div className="mt-3 h-2 bg-line rounded-full overflow-hidden">
                  <div
                    className="h-full bg-black transition-all"
                    style={{ width: `${((step + 1) / steps.length) * 100}%` }}
                  />
                </div>
              </div>
            </div>

            <div className="px-6 sm:px-10 py-6 sm:py-8">
              {/* Sign Up Form */}
              <div className="bg-white border border-black/10 rounded-2xl p-6 sm:p-8">
          <div className="mb-6">
            <p className="text-sm text-ink-muted">Create your account to get started.</p>
          </div>
          {error && (
            <div className="mb-4 p-3 bg-red-50 border-2 border-red-500 rounded-lg">
              <p className="text-red-700 text-sm">{error}</p>
            </div>
          )}
          <form onSubmit={handleSubmit} className="space-y-5">
            {step === 0 && (
              <>
                <div>
                  <label htmlFor="name" className="block text-sm font-medium text-black mb-2">
                    Full Name
                  </label>
                  <input
                    id="name"
                    name="name"
                    type="text"
                    required
                    value={formData.name}
                    onChange={handleChange}
                    className="w-full px-4 py-3 bg-white border-2 border-line-strong rounded-lg text-black placeholder-ink-faint focus:outline-none focus:ring-2 focus:ring-black focus:border-transparent"
                    placeholder="John Doe"
                  />
                </div>

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
                    value={formData.email}
                    onChange={handleChange}
                    className="w-full px-4 py-3 bg-white border-2 border-line-strong rounded-lg text-black placeholder-ink-faint focus:outline-none focus:ring-2 focus:ring-black focus:border-transparent"
                    placeholder="your.email@ufl.edu"
                  />
                </div>
              </>
            )}

            {step === 1 && (
              <>
                <div>
                  <label htmlFor="major" className="block text-sm font-medium text-black mb-2">
                    Major
                  </label>
                  <input
                    id="major"
                    name="major"
                    type="text"
                    required
                    value={formData.major}
                    onChange={handleChange}
                    className="w-full px-4 py-3 bg-white border-2 border-line-strong rounded-lg text-black placeholder-ink-faint focus:outline-none focus:ring-2 focus:ring-black focus:border-transparent"
                    placeholder="Business Administration"
                  />
                </div>

                <div>
                  <label htmlFor="year" className="block text-sm font-medium text-black mb-2">
                    Year
                  </label>
                  <select
                    id="year"
                    name="year"
                    required
                    value={formData.year}
                    onChange={handleChange}
                    className="w-full px-4 py-3 bg-white border-2 border-line-strong rounded-lg text-black focus:outline-none focus:ring-2 focus:ring-black focus:border-transparent"
                  >
                    <option value="">Select Year</option>
                    <option value="Freshman">Freshman</option>
                    <option value="Sophomore">Sophomore</option>
                    <option value="Junior">Junior</option>
                    <option value="Senior">Senior</option>
                  </select>
                </div>
              </>
            )}

            {step === 2 && (
              <>
                <div>
                  <label htmlFor="password" className="block text-sm font-medium text-black mb-2">
                    Create Password
                  </label>
                  <input
                    id="password"
                    name="password"
                    type="password"
                    autoComplete="new-password"
                    required
                    value={formData.password}
                    onChange={handleChange}
                    className="w-full px-4 py-3 bg-white border-2 border-line-strong rounded-lg text-black placeholder-ink-faint focus:outline-none focus:ring-2 focus:ring-black focus:border-transparent"
                    placeholder={passwordHint(POLICY)}
                  />
                </div>

                <div>
                  <label htmlFor="confirmPassword" className="block text-sm font-medium text-black mb-2">
                    Confirm Password
                  </label>
                  <input
                    id="confirmPassword"
                    name="confirmPassword"
                    type="password"
                    autoComplete="new-password"
                    required
                    value={formData.confirmPassword}
                    onChange={handleChange}
                    className="w-full px-4 py-3 bg-white border-2 border-line-strong rounded-lg text-black placeholder-ink-faint focus:outline-none focus:ring-2 focus:ring-black focus:border-transparent"
                    placeholder="Re-enter password"
                  />
                </div>
              </>
            )}

            <div className="flex items-center justify-between gap-3">
              <button
                type="button"
                onClick={handleBack}
                disabled={step === 0}
                className="flex-1 py-3 px-4 border-2 border-black rounded-lg font-semibold text-black hover:bg-surface-alt transition-colors disabled:border-line-strong disabled:text-ink-faint disabled:cursor-not-allowed"
              >
                Back
              </button>
              {step < steps.length - 1 ? (
                <button
                  type="button"
                  onClick={handleNext}
                  className="flex-1 py-3 px-4 bg-black text-white rounded-lg font-semibold hover:bg-inverse-soft transition-colors focus:outline-none focus:ring-2 focus:ring-black focus:ring-offset-2"
                >
                  Continue
                </button>
              ) : (
                <button
                  type="submit"
                  disabled={loading}
                  className="flex-1 py-3 px-4 bg-black text-white rounded-lg font-semibold hover:bg-inverse-soft transition-colors focus:outline-none focus:ring-2 focus:ring-black focus:ring-offset-2 disabled:bg-ink-faint disabled:cursor-not-allowed"
                >
                  {loading ? 'Creating Account...' : 'Finish and Create Account'}
                </button>
              )}
            </div>
          </form>
              </div>

              {/* Sign In Link */}
              <div className="mt-4">
                <p className="text-ink-muted">
                  Already have an account?{' '}
                  <Link href="/auth/signin" className="text-black font-semibold hover:text-ink-muted">
                    Sign in
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

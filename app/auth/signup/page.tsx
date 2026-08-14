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
    <div className="app-shell relative overflow-hidden">
      <div className="relative flex min-h-screen items-center justify-center px-4 sm:px-6 lg:px-8 py-6 sm:py-10">
        <div className="w-full max-w-5xl card">
          <div className="grid grid-cols-1 lg:grid-cols-[1fr_1.1fr]">
            <div className="px-6 sm:px-10 py-6 sm:py-8 border-b border-line lg:border-b-0 lg:border-r">
              <Link href="/" className="inline-flex items-baseline gap-3">
                <span className="lettermark text-4xl">ΑΚΨ</span>
                <span className="page-eyebrow">Alpha Phi Chapter</span>
              </Link>
              <h2 className="page-title mt-6 text-3xl sm:text-4xl">
                Start Your Rush Journey
              </h2>
              <p className="mt-3 text-ink-muted max-w-sm">
                A few quick steps and you&apos;re in.
              </p>
              <div className="mt-6 rounded-2xl border border-line bg-surface px-5 py-4">
                <p className="page-eyebrow">Progress</p>
                <div className="mt-3 flex items-center justify-between text-sm font-semibold text-ink-muted">
                  <span>Step {step + 1} of {steps.length}</span>
                  <span>{steps[step]}</span>
                </div>
                <div className="mt-3 h-2 bg-line rounded-full overflow-hidden">
                  <div
                    className="h-full bg-inverse transition-all"
                    style={{ width: `${((step + 1) / steps.length) * 100}%` }}
                  />
                </div>
              </div>
            </div>

            <div className="px-6 sm:px-10 py-6 sm:py-8">
              {/* Sign Up Form */}
              <div className="card card-pad">
                <div className="mb-6">
                  <p className="text-sm text-ink-muted">Create your account to get started.</p>
                </div>
                {error && (
                  <div className="alert alert-negative mb-4">
                    <p className="text-sm">{error}</p>
                  </div>
                )}
                <form onSubmit={handleSubmit} className="space-y-5">
                  {step === 0 && (
                    <>
                      <div>
                        <label htmlFor="name" className="field-label">
                          Full Name
                        </label>
                        <input
                          id="name"
                          name="name"
                          type="text"
                          required
                          value={formData.name}
                          onChange={handleChange}
                          className="input"
                          placeholder="John Doe"
                        />
                      </div>

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
                          value={formData.email}
                          onChange={handleChange}
                          className="input"
                          placeholder="your.email@ufl.edu"
                        />
                      </div>
                    </>
                  )}

                  {step === 1 && (
                    <>
                      <div>
                        <label htmlFor="major" className="field-label">
                          Major
                        </label>
                        <input
                          id="major"
                          name="major"
                          type="text"
                          required
                          value={formData.major}
                          onChange={handleChange}
                          className="input"
                          placeholder="Business Administration"
                        />
                      </div>

                      <div>
                        <label htmlFor="year" className="field-label">
                          Year
                        </label>
                        <select
                          id="year"
                          name="year"
                          required
                          value={formData.year}
                          onChange={handleChange}
                          className="input"
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
                        <label htmlFor="password" className="field-label">
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
                          className="input"
                          placeholder={passwordHint(POLICY)}
                        />
                      </div>

                      <div>
                        <label htmlFor="confirmPassword" className="field-label">
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
                          className="input"
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
                      className="btn btn-secondary flex-1"
                    >
                      Back
                    </button>
                    {step < steps.length - 1 ? (
                      <button
                        type="button"
                        onClick={handleNext}
                        className="btn btn-primary flex-1"
                      >
                        Continue
                      </button>
                    ) : (
                      <button
                        type="submit"
                        disabled={loading}
                        className="btn btn-primary flex-1"
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
                  <Link href="/auth/signin" className="text-ink font-semibold hover:text-ink-muted">
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

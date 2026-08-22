'use client'

import RusheeNav from '@/components/rushee/RusheeNav'
import PullToRefresh from '@/components/PullToRefresh'
import { useState, useEffect, useCallback, useRef } from 'react'
import { supabase } from '@/lib/supabase'
import Link from 'next/link'
import { POLICY, evaluateEligibility, isDecisionMade, applicationUnlocked } from '@/lib/policy'

export default function RusheeApplication() {
  const [formData, setFormData] = useState({
    legalName: '',
    preferredName: '',
    pronouns: '',
    phoneNumber: '',
    email: '',
    ufAddress: '',
    major: '',
    minor: '',
    gpa: '',
    expectedGraduationDate: '',
    resumeUrl: '',
    outsideInvolvements: '',
    howHeardAboutAkpsi: '',
    whyInterested: '',
    pillarRelation: '',
    brotherConnectionReason: '',
    monopolyPiece: '',
    monopolyThemeLesson: ''
  })

  const [rusheeData, setRusheeData] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [resumeFileName, setResumeFileName] = useState('')
  const [lastSaved, setLastSaved] = useState<Date | null>(null)
  const [applicationId, setApplicationId] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const submittedRef = useRef(false)

  async function handleRefresh() {
    await loadData()
  }

  // Load rushee data and existing application
  useEffect(() => {
    loadData()
  }, [])

  async function loadData() {
      try {
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) return

        // Load rushee profile
        const { data: rushee } = await supabase
          .from('rushees')
          .select('*')
          .eq('id', user.id)
          .single()

        if (!rushee) return

        const rusheeProfile: any = rushee

        // Count event attendance
        const { data: attendance } = await supabase
          .from('event_attendance')
          .select('event_id, events(type)')
          .eq('rushee_id', user.id)
          .eq('status', 'approved')

        const casualEvents = (attendance || []).filter((a: any) => a.events?.type === 'Casual').length
        const professionalEvents = (attendance || []).filter((a: any) => a.events?.type === 'Professional').length

        // Load existing application
        const { data: application } = await supabase
          .from('applications')
          .select('*')
          .eq('rushee_id', user.id)
          .single()

        if (application) {
          const app: any = application
          setApplicationId(app.id)
          submittedRef.current = !!app.is_submitted
          setFormData({
            legalName: app.legal_name || '',
            preferredName: app.preferred_name || '',
            pronouns: app.pronouns || '',
            phoneNumber: app.phone_number || '',
            email: app.email || rusheeProfile.email || '',
            ufAddress: app.uf_address || '',
            major: app.major || '',
            minor: app.minor || '',
            gpa: app.gpa || '',
            expectedGraduationDate: app.expected_graduation_date || '',
            resumeUrl: app.resume_url || '',
            outsideInvolvements: app.outside_involvements || '',
            howHeardAboutAkpsi: app.how_heard_about_akpsi || '',
            whyInterested: app.why_interested || '',
            pillarRelation: app.pillar_relation || '',
            brotherConnectionReason: app.brother_connection_reason || '',
            monopolyPiece: app.monopoly_piece || '',
            monopolyThemeLesson: app.monopoly_theme_lesson || ''
          })
        } else {
          // Pre-fill email for new applications
          setFormData(prev => ({
            ...prev,
            email: rusheeProfile.email || ''
          }))
        }

        const app: any = application
        setRusheeData({
          ...rusheeProfile,
          casualEvents,
          professionalEvents,
          applicationComplete: app?.is_submitted || false
        })
        submittedRef.current = !!app?.is_submitted
      } catch (error) {
        console.error('Error loading data:', error)
      } finally {
        setLoading(false)
      }
    }

  // Auto-save function (debounced)
  const autoSave = useCallback(async (data: typeof formData) => {
    if (!rusheeData) return
    // Don't auto-save if application is already submitted (ref avoids stale state)
    if (submittedRef.current || rusheeData.applicationComplete) return

    try {
      setSaving(true)
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      const applicationData = {
        rushee_id: user.id,
        legal_name: data.legalName,
        preferred_name: data.preferredName,
        pronouns: data.pronouns,
        phone_number: data.phoneNumber,
        email: data.email,
        uf_address: data.ufAddress,
        major: data.major,
        minor: data.minor,
        gpa: data.gpa,
        expected_graduation_date: data.expectedGraduationDate || null,
        resume_url: data.resumeUrl,
        outside_involvements: data.outsideInvolvements,
        how_heard_about_akpsi: data.howHeardAboutAkpsi,
        why_interested: data.whyInterested,
        pillar_relation: data.pillarRelation,
        brother_connection_reason: data.brotherConnectionReason,
        monopoly_piece: data.monopolyPiece,
        monopoly_theme_lesson: data.monopolyThemeLesson
      }

      if (applicationId) {
        // Update existing
        await (supabase as any)
          .from('applications')
          .update(applicationData)
          .eq('id', applicationId)
      } else {
        // Create new
        const { data: newApp } = await (supabase as any)
          .from('applications')
          .insert({ ...applicationData, is_submitted: false })
          .select()
          .single()

        if (newApp) {
          setApplicationId(newApp.id)
        }
      }

      setLastSaved(new Date())
    } catch (error) {
      console.error('Error auto-saving:', error)
    } finally {
      setSaving(false)
    }
  }, [applicationId, rusheeData])

  // Debounce auto-save
  useEffect(() => {
    const timer = setTimeout(() => {
      autoSave(formData)
    }, POLICY.application.autosaveDebounceMs)

    return () => clearTimeout(timer)
  }, [formData, autoSave])

  // R2/R5 — the gate reads the same rulebook as the progress rings and
  // the landing-page requirements badge.
  const totalEvents = (rusheeData?.casualEvents || 0) + (rusheeData?.professionalEvents || 0)
  const eligibility = evaluateEligibility({
    casual: rusheeData?.casualEvents || 0,
    professional: rusheeData?.professionalEvents || 0,
    total: totalEvents,
  })
  const standardsMet = eligibility.minimumsMet
  const inviteOnly: boolean | null = rusheeData?.invite_only ?? null
  const decision = { inviteOnly, bidStatus: (rusheeData?.bid_status ?? null) as boolean | null }
  const hasStatusUpdate = isDecisionMade(decision)
  const isLockedByStanding = inviteOnly === null && !standardsMet
  const canApply = applicationUnlocked(decision, standardsMet) && standardsMet

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target
    setFormData({
      ...formData,
      [name]: value
    })
  }

  const handleResumeUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    // Validate file type
    if (file.type !== 'application/pdf') {
      alert('Please upload a PDF file')
      return
    }

    // Validate file size (max 10MB)
    if (file.size > 10 * 1024 * 1024) {
      alert('File must be less than 10MB')
      return
    }

    setUploading(true)

    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('Not authenticated')

      // Upload file to storage
      const fileName = `${user.id}/resume_${Date.now()}.pdf`
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('resumes')
        .upload(fileName, file)

      if (uploadError) throw uploadError

      // Store the storage path — the `resumes` bucket is private, so it's
      // exchanged for a signed URL at view time rather than linked directly.
      setFormData(prev => ({ ...prev, resumeUrl: fileName }))
      setResumeFileName(file.name)
      alert('Resume uploaded successfully!')
    } catch (error) {
      console.error('Error uploading resume:', error)
      alert('Failed to upload resume. Please try again.')
    } finally {
      setUploading(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    // R19 — submission is final, so it is always deliberate.
    const confirmed = window.confirm(
      'Submit your application?\n\nOnce submitted, your application locks and you will not be able to edit it. Make sure every answer is how you want it.'
    )
    if (!confirmed) return

    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      submittedRef.current = true

      // Final save with submitted flag
      const { error } = await (supabase as any)
        .from('applications')
        .update({
          is_submitted: true,
          submitted_at: new Date().toISOString()
        })
        .eq('rushee_id', user.id)

      if (error) throw error

      // Update local state
      setRusheeData({
        ...rusheeData,
        applicationComplete: true
      })

    } catch (error) {
      submittedRef.current = false
      console.error('Error submitting application:', error)
      alert('Failed to submit application. Please try again.')
    }
  }

  const characterLimit = POLICY.application.essayCharLimit

  // Banner component - only show when event minimums are met
  const CasualInterviewBanner = () => {
    if (inviteOnly !== null || !standardsMet) return null

    return (
      <div className="bg-ink text-white py-3 px-4 text-center">
        <p className="text-sm sm:text-base font-medium">
          📅 Sign up for casual interviews!{' '}
          <a
            href="https://docs.google.com/spreadsheets/d/134aYIdwIsEfEYGKluLa2U9JTtkRU3ESFQg_LFVHoI7E/edit?gid=0#gid=0"
            target="_blank"
            rel="noopener noreferrer"
            className="underline font-semibold hover:text-surface-sunken transition-colors"
          >
            Click here to schedule
          </a>
        </p>
      </div>
    )
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-canvas">
        <RusheeNav />
        <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-24 lg:py-8" style={{ paddingTop: 'max(1rem, env(safe-area-inset-top))' }}>
          <div className="text-center text-ink-muted">Loading application...</div>
        </main>
      </div>
    )
  }

  if (!rusheeData) {
    return (
      <div className="min-h-screen bg-canvas">
        <RusheeNav />
        <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-24 lg:py-8" style={{ paddingTop: 'max(1rem, env(safe-area-inset-top))' }}>
          <div className="text-center text-ink-muted">Failed to load rushee data</div>
        </main>
      </div>
    )
  }

  if (hasStatusUpdate) {
    return (
      <div className="min-h-screen bg-canvas">
        <RusheeNav />
        <CasualInterviewBanner />
        <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-24 lg:py-8" style={{ paddingTop: 'max(1rem, env(safe-area-inset-top))' }}>
          <div className="bg-white border border-emerald-200 rounded-2xl p-10 text-center shadow-sm">
            <h2 className="text-2xl font-semibold text-ink mb-3">Application Submitted</h2>
            <p className="text-ink-muted mb-6">
              Your status has been updated. View your decision letter on the Status page.
            </p>
            <Link href="/rushee/status" className="inline-block px-6 py-3 bg-ink text-white rounded-lg font-semibold hover:bg-inverse-soft transition-colors">
              View Status
            </Link>
          </div>
        </main>
      </div>
    )
  }

  if (isLockedByStanding || !standardsMet) {
    return (
      <div className="min-h-screen bg-canvas">
        <RusheeNav />
        <CasualInterviewBanner />
        <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-24 lg:py-8" style={{ paddingTop: 'max(1rem, env(safe-area-inset-top))' }}>
          <div className="mt-8 bg-white border border-line rounded-2xl p-10 text-center shadow-sm">
            <h2 className="text-2xl font-semibold text-ink mb-3">Application Locked</h2>
            <p className="text-ink-muted mb-4">
              To unlock the application, you must attend at least:
            </p>
            <ul className="text-left max-w-md mx-auto mb-6 space-y-2">
              <li className="flex items-center">
                <span className={`mr-2 ${rusheeData?.casualEvents >= 1 ? 'text-emerald-600' : 'text-ink-faint'}`}>
                  {rusheeData?.casualEvents >= 1 ? '✓' : '○'}
                </span>
                <span className="text-ink-muted">1 Casual Event ({rusheeData?.casualEvents || 0}/1)</span>
              </li>
              <li className="flex items-center">
                <span className={`mr-2 ${rusheeData?.professionalEvents >= 1 ? 'text-emerald-600' : 'text-ink-faint'}`}>
                  {rusheeData?.professionalEvents >= 1 ? '✓' : '○'}
                </span>
                <span className="text-ink-muted">1 Professional Event ({rusheeData?.professionalEvents || 0}/1)</span>
              </li>
              <li className="flex items-center">
                <span className={`mr-2 ${totalEvents >= 3 ? 'text-emerald-600' : 'text-ink-faint'}`}>
                  {totalEvents >= 3 ? '✓' : '○'}
                </span>
                <span className="text-ink-muted">3 Total Events ({totalEvents}/3)</span>
              </li>
            </ul>
            <p className="text-sm text-ink-subtle mb-6">
              Your 3rd event can be either casual or professional - your choice!
            </p>
            <a href="/rushee/events" className="inline-block px-6 py-3 bg-ink text-white rounded-lg font-semibold hover:bg-inverse-soft transition-colors">
              View Events
            </a>
          </div>
        </main>
      </div>
    )
  }

  if (rusheeData.applicationComplete) {
    return (
      <div className="min-h-screen bg-canvas">
        <RusheeNav />
        <CasualInterviewBanner />
        <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-24 lg:py-8" style={{ paddingTop: 'max(1rem, env(safe-area-inset-top))' }}>
          <div className="bg-white border border-emerald-200 rounded-2xl p-10 text-center shadow-sm">
            <h2 className="text-2xl font-semibold text-ink mb-3">Application Submitted</h2>
            <p className="text-ink-muted mb-6">
              Thank you for completing your application! We'll review it and update your status soon.
            </p>
            <a href="/rushee/status" className="inline-block px-6 py-3 bg-ink text-white rounded-lg font-semibold hover:bg-inverse-soft transition-colors">
              Check Status
            </a>
          </div>
        </main>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-canvas">
      <RusheeNav />
      <CasualInterviewBanner />

      <PullToRefresh onRefresh={handleRefresh} className="min-h-screen lg:min-h-0">
        <main className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 pb-24 lg:py-8" style={{ paddingTop: 'max(1rem, env(safe-area-inset-top))' }}>
        <div className="flex flex-col gap-4 mb-6 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="text-xs uppercase tracking-[0.35em] text-ink-subtle">Membership Application</p>
            <h1 className="mt-2 text-3xl font-semibold text-ink">Tell us your story</h1>
            <p className="text-sm text-ink-muted mt-2">
              Take your time and be thoughtful with your responses. Character limit: {characterLimit} characters per essay question.
            </p>
          </div>
          <div className="text-sm">
            {saving ? (
              <span className="text-ink-muted">Saving...</span>
            ) : lastSaved ? (
              <span className="text-emerald-600">Saved {lastSaved.toLocaleTimeString()}</span>
            ) : null}
          </div>
        </div>

        {!canApply && (
          <div className="bg-white border border-line rounded-2xl p-8 shadow-sm text-center">
            <h2 className="text-xl font-semibold text-ink mb-2">Application Locked</h2>
            <p className="text-ink-muted">
              Complete the event minimums to unlock your application.
            </p>
          </div>
        )}

        {canApply && (
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Personal Information */}
          <div className="bg-white border border-line rounded-2xl p-6 shadow-sm">
            <h2 className="text-lg font-semibold text-ink mb-4">Personal Information</h2>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-ink-muted mb-2">
                  Legal Name (First and Last) *
                </label>
                <input
                  type="text"
                  name="legalName"
                  value={formData.legalName}
                  onChange={handleChange}
                  required
                  className="w-full px-4 py-2 bg-white border border-line rounded-lg text-ink focus:ring-2 focus:ring-ink"
                  placeholder="John Doe"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-ink-muted mb-2">
                  Preferred Name *
                </label>
                <input
                  type="text"
                  name="preferredName"
                  value={formData.preferredName}
                  onChange={handleChange}
                  required
                  className="w-full px-4 py-2 bg-white border border-line rounded-lg text-ink focus:ring-2 focus:ring-ink"
                  placeholder="Johnny"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-ink-muted mb-2">
                  Pronouns *
                </label>
                <input
                  type="text"
                  name="pronouns"
                  value={formData.pronouns}
                  onChange={handleChange}
                  required
                  className="w-full px-4 py-2 bg-white border border-line rounded-lg text-ink focus:ring-2 focus:ring-ink"
                  placeholder="e.g., he/him, she/her, they/them"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-ink-muted mb-2">
                  Phone Number *
                </label>
                <input
                  type="tel"
                  name="phoneNumber"
                  value={formData.phoneNumber}
                  onChange={handleChange}
                  required
                  className="w-full px-4 py-2 bg-white border border-line rounded-lg text-ink focus:ring-2 focus:ring-ink"
                  placeholder="(123) 456-7890"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-ink-muted mb-2">
                  Email *
                </label>
                <input
                  type="email"
                  name="email"
                  value={formData.email}
                  onChange={handleChange}
                  required
                  disabled
                  className="w-full px-4 py-2 bg-surface-sunken border border-line rounded-lg text-ink-muted"
                />
                <p className="text-xs text-ink-subtle mt-1">Pre-filled from your account</p>
              </div>

              <div>
                <label className="block text-sm font-medium text-ink-muted mb-2">
                  UF Address *
                </label>
                <input
                  type="text"
                  name="ufAddress"
                  value={formData.ufAddress}
                  onChange={handleChange}
                  required
                  className="w-full px-4 py-2 bg-white border border-line rounded-lg text-ink focus:ring-2 focus:ring-ink"
                  placeholder="e.g., 123 SW 13th Street, Apt 4"
                />
                <p className="text-xs text-ink-subtle mt-1">Your current address in Gainesville</p>
              </div>
            </div>
          </div>

          {/* Academic Information */}
          <div className="bg-white border border-line rounded-2xl p-6 shadow-sm">
            <h2 className="text-lg font-semibold text-ink mb-4">Academic Information</h2>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-ink-muted mb-2">
                  Major *
                </label>
                <input
                  type="text"
                  name="major"
                  value={formData.major}
                  onChange={handleChange}
                  required
                  className="w-full px-4 py-2 bg-white border border-line rounded-lg text-ink focus:ring-2 focus:ring-ink"
                  placeholder="e.g., Business Administration"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-ink-muted mb-2">
                  Minor <span className="text-ink-faint">(if applicable)</span>
                </label>
                <input
                  type="text"
                  name="minor"
                  value={formData.minor}
                  onChange={handleChange}
                  className="w-full px-4 py-2 bg-white border border-line rounded-lg text-ink focus:ring-2 focus:ring-ink"
                  placeholder="e.g., Computer Science"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-ink-muted mb-2">
                  GPA *
                </label>
                <input
                  type="text"
                  name="gpa"
                  value={formData.gpa}
                  onChange={handleChange}
                  required
                  className="w-full px-4 py-2 bg-white border border-line rounded-lg text-ink focus:ring-2 focus:ring-ink"
                  placeholder="3.75"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-ink-muted mb-2">
                  Expected Graduation Date *
                </label>
                <input
                  type="date"
                  name="expectedGraduationDate"
                  value={formData.expectedGraduationDate}
                  onChange={handleChange}
                  required
                  className="w-full px-4 py-2 bg-white border border-line rounded-lg text-ink focus:ring-2 focus:ring-ink"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-ink-muted mb-2">
                  Submit a copy of your resume (PDF only) *
                </label>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".pdf"
                  onChange={handleResumeUpload}
                  className="hidden"
                />
                <div className="flex items-center gap-4">
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={uploading}
                    className="px-4 py-2 bg-ink text-white rounded-lg font-semibold hover:bg-inverse-soft transition-colors disabled:bg-ink-faint disabled:cursor-not-allowed"
                  >
                    {uploading ? 'Uploading...' : 'Upload Resume'}
                  </button>
                  {formData.resumeUrl && (
                    <span className="text-sm text-emerald-600">
                      ✓ Resume uploaded{resumeFileName && ` — ${resumeFileName}`}
                    </span>
                  )}
                </div>
                <p className="text-xs text-ink-subtle mt-2">Max file size: 10MB</p>
              </div>
            </div>
          </div>

          {/* Essay Questions */}
          <div className="bg-white border border-line rounded-2xl p-6 shadow-sm">
            <h2 className="text-lg font-semibold text-ink mb-4">Essay Questions</h2>
            <div className="space-y-6">
              <div>
                <label className="block text-sm font-medium text-ink-muted mb-2">
                  1. Please list any outside involvements? *
                </label>
                <textarea
                  name="outsideInvolvements"
                  value={formData.outsideInvolvements}
                  onChange={handleChange}
                  required
                  maxLength={characterLimit}
                  rows={4}
                  className="w-full px-4 py-2 bg-white border border-line rounded-lg text-ink focus:ring-2 focus:ring-ink resize-none"
                  placeholder="Clubs, organizations, sports, volunteer work, etc."
                />
                <p className="text-xs text-ink-subtle mt-1">{formData.outsideInvolvements.length}/{characterLimit}</p>
              </div>

              <div>
                <label className="block text-sm font-medium text-ink-muted mb-2">
                  2. How did you hear about Alpha Kappa Psi? *
                </label>
                <textarea
                  name="howHeardAboutAkpsi"
                  value={formData.howHeardAboutAkpsi}
                  onChange={handleChange}
                  required
                  maxLength={characterLimit}
                  rows={4}
                  className="w-full px-4 py-2 bg-white border border-line rounded-lg text-ink focus:ring-2 focus:ring-ink resize-none"
                />
                <p className="text-xs text-ink-subtle mt-1">{formData.howHeardAboutAkpsi.length}/{characterLimit}</p>
              </div>

              <div>
                <label className="block text-sm font-medium text-ink-muted mb-2">
                  3. Why are you interested in becoming a member of Alpha Kappa Psi? *
                </label>
                <textarea
                  name="whyInterested"
                  value={formData.whyInterested}
                  onChange={handleChange}
                  required
                  maxLength={characterLimit}
                  rows={4}
                  className="w-full px-4 py-2 bg-white border border-line rounded-lg text-ink focus:ring-2 focus:ring-ink resize-none"
                />
                <p className="text-xs text-ink-subtle mt-1">{formData.whyInterested.length}/{characterLimit}</p>
              </div>

              <div>
                <label className="block text-sm font-medium text-ink-muted mb-2">
                  4. Pick one of our pillars and describe how it relates to you (Brotherhood, Knowledge, Unity, Integrity, and Service)? *
                </label>
                <textarea
                  name="pillarRelation"
                  value={formData.pillarRelation}
                  onChange={handleChange}
                  required
                  maxLength={characterLimit}
                  rows={4}
                  className="w-full px-4 py-2 bg-white border border-line rounded-lg text-ink focus:ring-2 focus:ring-ink resize-none"
                />
                <p className="text-xs text-ink-subtle mt-1">{formData.pillarRelation.length}/{characterLimit}</p>
              </div>

              <div>
                <label className="block text-sm font-medium text-ink-muted mb-2">
                  5. Who is a brother who you connected with and why? *
                </label>
                <textarea
                  name="brotherConnectionReason"
                  value={formData.brotherConnectionReason}
                  onChange={handleChange}
                  required
                  maxLength={characterLimit}
                  rows={4}
                  className="w-full px-4 py-2 bg-white border border-line rounded-lg text-ink focus:ring-2 focus:ring-ink resize-none"
                  placeholder="Share which brother made an impact and why"
                />
                <p className="text-xs text-ink-subtle mt-1">{formData.brotherConnectionReason.length}/{characterLimit}</p>
              </div>
            </div>
          </div>

          {/* Submit Button */}
          <div className="bg-surface-alt border border-line rounded-2xl p-4 mb-6">
            <p className="text-sm text-ink-muted mb-2">
              Your application is automatically saved as you type. Click "Submit Application" when you're ready to finalize and lock your submission.
            </p>
          </div>

          <div className="flex justify-end gap-4">
            <button
              type="button"
              onClick={() => window.history.back()}
              className="px-6 py-3 bg-white text-ink border border-line-strong rounded-lg font-semibold hover:bg-surface-alt transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving || !formData.resumeUrl}
              className={`px-6 py-3 rounded-lg font-semibold transition-colors ${
                saving || !formData.resumeUrl
                  ? 'bg-line-strong text-ink-muted cursor-not-allowed'
                  : 'bg-ink text-white hover:bg-inverse-soft'
              }`}
            >
              {saving ? 'Saving...' : 'Submit Application'}
            </button>
          </div>
        </form>
        )}
        </main>
      </PullToRefresh>
    </div>
  )
}

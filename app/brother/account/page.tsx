'use client'

import BrotherNav from '@/components/brother/BrotherNav'
import PullToRefresh from '@/components/PullToRefresh'
import { useState, useEffect } from 'react'
import { getBrotherProfile, updateBrotherProfile } from '@/lib/database'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/contexts/AuthContext'

export default function BrotherAccount() {
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null)

  const [formData, setFormData] = useState({
    name: '',
    email: '',
    access_level: ''
  })
  const { signOut } = useAuth()

  useEffect(() => {
    loadProfile()
  }, [])

  async function handleRefresh() {
    await loadProfile()
  }

  async function loadProfile() {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        window.location.href = '/auth/signin'
        return
      }

      const { data, error } = await getBrotherProfile(user.id)
      if (error) throw error

      if (data) {
        const profile: any = data
        setFormData({
          name: profile.name || '',
          email: profile.email || '',
          access_level: profile.access_level || 'basic'
        })
      }
    } catch (error) {
      console.error('Error loading profile:', error)
      setMessage({ type: 'error', text: 'Failed to load profile' })
    } finally {
      setLoading(false)
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    setMessage(null)

    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('Not authenticated')

      const { error } = await updateBrotherProfile(user.id, {
        name: formData.name,
        email: formData.email
      })
      if (error) throw error

      setMessage({ type: 'success', text: 'Profile updated successfully!' })
    } catch (error) {
      console.error('Error updating profile:', error)
      setMessage({ type: 'error', text: 'Failed to update profile' })
    } finally {
      setSaving(false)
    }
  }

  function handleChange(field: string, value: string) {
    setFormData(prev => ({ ...prev, [field]: value }))
  }

  async function handleSignOut() {
    try {
      await signOut()
      window.location.href = '/auth/signin'
    } catch (error) {
      console.error('Error signing out:', error)
      setMessage({ type: 'error', text: 'Failed to sign out' })
    }
  }

  const accessLevelLabel = {
    admin: 'Administrator',
    recruitment: 'Recruitment Chair',
    pro: 'Professional Chair',
    basic: 'Brother'
  }[formData.access_level] || 'Brother'

  if (loading) {
    return (
      <div className="min-h-screen bg-canvas">
        <BrotherNav />
        <main className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="text-center py-12">
            <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-ink"></div>
            <p className="mt-4 text-ink-muted">Loading profile...</p>
          </div>
        </main>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-canvas">
      <BrotherNav />

      <PullToRefresh onRefresh={handleRefresh} className="min-h-screen lg:min-h-0">
        <main className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-6">
          <p className="text-xs uppercase tracking-[0.35em] text-ink-subtle">Brother Profile</p>
          <h1 className="mt-2 text-3xl font-semibold text-ink">Account Settings</h1>
          <p className="mt-2 text-sm text-ink-muted">
            Keep your profile details accurate for evaluations and communication.
          </p>
        </div>

        {/* Message Banner */}
        {message && (
          <div className={`mb-6 p-4 rounded-2xl border ${
            message.type === 'success'
              ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
              : 'bg-red-50 border-red-200 text-red-800'
          }`}>
            {message.text}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Personal Information */}
          <div className="bg-surface border border-line rounded-2xl p-6 shadow-sm">
            <h2 className="text-lg font-semibold text-ink mb-4">Personal Information</h2>
            <div className="space-y-4">
              <div>
                <label htmlFor="name" className="block text-sm font-medium text-ink-muted mb-2">
                  Full Name
                </label>
                <input
                  id="name"
                  type="text"
                  value={formData.name}
                  onChange={(e) => handleChange('name', e.target.value)}
                  className="w-full px-4 py-2 border border-line rounded-lg text-ink focus:outline-none focus:ring-2 focus:ring-ink"
                  required
                />
              </div>

              <div>
                <label htmlFor="email" className="block text-sm font-medium text-ink-muted mb-2">
                  Email
                </label>
                <input
                  id="email"
                  type="email"
                  value={formData.email}
                  onChange={(e) => handleChange('email', e.target.value)}
                  className="w-full px-4 py-2 border border-line rounded-lg text-ink focus:outline-none focus:ring-2 focus:ring-ink"
                  required
                />
              </div>
            </div>
          </div>

          {/* Account Information */}
          <div className="bg-surface border border-line rounded-2xl p-6 shadow-sm">
            <h2 className="text-lg font-semibold text-ink mb-4">Account Information</h2>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-ink-muted mb-2">
                  Access Level
                </label>
                <div className="px-4 py-3 bg-surface-alt border border-line rounded-lg">
                  <p className="text-ink font-medium">{accessLevelLabel}</p>
                  <p className="text-sm text-ink-muted mt-1">
                    Contact an admin to change your access level
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex gap-4">
            <button
              type="submit"
              disabled={saving}
              className="flex-1 py-3 bg-inverse text-on-inverse rounded-lg font-semibold hover:bg-inverse-soft transition-colors disabled:bg-line-strong disabled:cursor-not-allowed"
            >
              {saving ? 'Saving...' : 'Save Changes'}
            </button>
          </div>
          <button
            type="button"
            onClick={handleSignOut}
            className="w-full py-3 bg-red-600 text-white rounded-lg font-semibold hover:bg-red-700 transition-colors"
          >
            Sign Out
          </button>
        </form>
        </main>
      </PullToRefresh>
    </div>
  )
}

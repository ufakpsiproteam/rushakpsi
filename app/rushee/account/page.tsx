'use client'

import RusheeNav from '@/components/rushee/RusheeNav'
import PullToRefresh from '@/components/PullToRefresh'
import { useState, useEffect, useRef } from 'react'
import { getRusheeProfile, updateRusheeProfile, uploadProfilePhoto } from '@/lib/database'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/contexts/AuthContext'

export default function RusheeAccount() {
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const [formData, setFormData] = useState({
    name: '',
    email: '',
    major: '',
    year: '',
    photo: ''
  })
  const { signOut } = useAuth()

  const [photoPreview, setPhotoPreview] = useState<string | null>(null)

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

      const { data, error } = await getRusheeProfile(user.id)
      if (error) throw error

      if (data) {
        const profile: any = data
        setFormData({
          name: profile.name || '',
          email: profile.email || '',
          major: profile.major || '',
          year: profile.year || '',
          photo: profile.photo || ''
        })

        // Set photo preview if exists
        if (profile.photo && profile.photo.startsWith('http')) {
          setPhotoPreview(profile.photo)
        }
      }
    } catch (error) {
      console.error('Error loading profile:', error)
      setMessage({ type: 'error', text: 'Failed to load profile' })
    } finally {
      setLoading(false)
    }
  }

  async function handlePhotoSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return

    // Validate file type
    if (!file.type.startsWith('image/')) {
      setMessage({ type: 'error', text: 'Please select an image file' })
      return
    }

    // Validate file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      setMessage({ type: 'error', text: 'Image must be less than 5MB' })
      return
    }

    setUploading(true)
    setMessage(null)

    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('Not authenticated')

      // Upload photo
      const { data, error } = await uploadProfilePhoto(user.id, file)
      if (error) throw error

      // Update form data with new photo URL
      setFormData(prev => ({ ...prev, photo: data.url }))
      setPhotoPreview(data.url)
      setMessage({ type: 'success', text: 'Photo uploaded successfully!' })
    } catch (error) {
      console.error('Error uploading photo:', error)
      setMessage({ type: 'error', text: 'Failed to upload photo' })
    } finally {
      setUploading(false)
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    setMessage(null)

    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('Not authenticated')

      const { error } = await updateRusheeProfile(user.id, formData)
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

  if (loading) {
    return (
      <div className="min-h-screen bg-canvas">
        <RusheeNav />
        <main className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 pb-24 lg:py-8" style={{ paddingTop: 'max(1rem, env(safe-area-inset-top))' }}>
          <div className="text-center py-12">
            <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-black"></div>
            <p className="mt-4 text-ink-muted">Loading profile...</p>
          </div>
        </main>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-canvas">
      <RusheeNav />

      <PullToRefresh onRefresh={handleRefresh} className="min-h-screen lg:min-h-0">
        <main className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 pb-24 lg:py-8" style={{ paddingTop: 'max(1rem, env(safe-area-inset-top))' }}>

        {/* Message Banner */}
        {message && (
          <div className={`mb-6 p-4 rounded-lg border-2 ${
            message.type === 'success'
              ? 'bg-green-50 border-green-600 text-green-800'
              : 'bg-red-50 border-red-600 text-red-800'
          }`}>
            {message.text}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Profile Picture */}
          <div className="bg-white border-2 border-black rounded-lg p-6">
            <h2 className="text-xl font-bold text-black mb-4">Profile Picture</h2>
            <div className="flex items-start gap-6">
              <div className="flex-shrink-0">
                {photoPreview ? (
                  <img
                    src={photoPreview}
                    alt="Profile"
                    className="w-32 h-32 object-cover rounded-lg border-2 border-black"
                  />
                ) : (
                  <div className="w-32 h-32 flex items-center justify-center bg-surface-sunken rounded-lg border-2 border-line-strong">
                    <svg className="w-16 h-16 text-ink-faint" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                    </svg>
                  </div>
                )}
              </div>
              <div className="flex-1">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handlePhotoSelect}
                  className="hidden"
                />
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={uploading}
                  className="px-4 py-2 bg-black text-white rounded-lg font-semibold hover:bg-inverse-soft transition-colors disabled:bg-ink-faint disabled:cursor-not-allowed"
                >
                  {uploading ? 'Uploading...' : 'Upload Photo'}
                </button>
                <p className="mt-2 text-sm text-ink-muted">
                  Recommended: Square image, at least 400x400px
                </p>
                <p className="text-sm text-ink-muted">
                  Max file size: 5MB
                </p>
              </div>
            </div>
          </div>

          {/* Personal Information */}
          <div className="bg-white border-2 border-black rounded-lg p-6">
            <h2 className="text-xl font-bold text-black mb-4">Personal Information</h2>
            <div className="space-y-4">
              <div>
                <label htmlFor="name" className="block text-sm font-semibold text-black mb-2">
                  Full Name
                </label>
                <input
                  id="name"
                  type="text"
                  value={formData.name}
                  onChange={(e) => handleChange('name', e.target.value)}
                  className="w-full px-4 py-2 border-2 border-black rounded-lg focus:outline-none focus:ring-2 focus:ring-black"
                  required
                />
              </div>

              <div>
                <label htmlFor="email" className="block text-sm font-semibold text-black mb-2">
                  Email
                </label>
                <input
                  id="email"
                  type="email"
                  value={formData.email}
                  onChange={(e) => handleChange('email', e.target.value)}
                  className="w-full px-4 py-2 border-2 border-black rounded-lg focus:outline-none focus:ring-2 focus:ring-black"
                  required
                />
              </div>
            </div>
          </div>

          {/* Academic Information */}
          <div className="bg-white border-2 border-black rounded-lg p-6">
            <h2 className="text-xl font-bold text-black mb-4">Academic Information</h2>
            <div className="space-y-4">
              <div>
                <label htmlFor="major" className="block text-sm font-semibold text-black mb-2">
                  Major
                </label>
                <input
                  id="major"
                  type="text"
                  value={formData.major}
                  onChange={(e) => handleChange('major', e.target.value)}
                  className="w-full px-4 py-2 border-2 border-black rounded-lg focus:outline-none focus:ring-2 focus:ring-black"
                  placeholder="e.g., Computer Science"
                  required
                />
              </div>

              <div>
                <label htmlFor="year" className="block text-sm font-semibold text-black mb-2">
                  Year
                </label>
                <select
                  id="year"
                  value={formData.year}
                  onChange={(e) => handleChange('year', e.target.value)}
                  className="w-full px-4 py-2 border-2 border-black rounded-lg focus:outline-none focus:ring-2 focus:ring-black"
                  required
                >
                  <option value="">Select year</option>
                  <option value="Freshman">Freshman</option>
                  <option value="Sophomore">Sophomore</option>
                  <option value="Junior">Junior</option>
                  <option value="Senior">Senior</option>
                </select>
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex gap-4">
            <button
              type="submit"
              disabled={saving}
              className="flex-1 py-3 bg-black text-white rounded-lg font-semibold hover:bg-inverse-soft transition-colors disabled:bg-ink-faint disabled:cursor-not-allowed"
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

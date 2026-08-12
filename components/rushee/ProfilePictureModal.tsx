'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'

export default function ProfilePictureModal() {
  const [showModal, setShowModal] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [preview, setPreview] = useState<string | null>(null)
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [rusheeId, setRusheeId] = useState<string | null>(null)

  useEffect(() => {
    async function checkProfilePicture() {
      try {
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) return

        const { data: rushee } = await supabase
          .from('rushees')
          .select('id, photo')
          .eq('id', user.id)
          .single()

        if (rushee) {
          const profile: any = rushee
          setRusheeId(profile.id)
          // Show modal if photo is default emoji or empty/null
          if (!profile.photo || profile.photo === '👤' || profile.photo.trim() === '') {
            setShowModal(true)
          }
        }
      } catch (error) {
        console.error('Error checking profile picture:', error)
      }
    }

    checkProfilePicture()
  }, [])

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    // Validate file type
    if (!file.type.startsWith('image/')) {
      alert('Please select an image file')
      return
    }

    // Validate file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      alert('Image must be less than 5MB')
      return
    }

    setSelectedFile(file)

    // Create preview
    const reader = new FileReader()
    reader.onloadend = () => {
      setPreview(reader.result as string)
    }
    reader.readAsDataURL(file)
  }

  const handleUpload = async () => {
    if (!selectedFile || !rusheeId) return

    setUploading(true)

    try {
      // Upload to Supabase storage
      const fileName = `${rusheeId}/${Date.now()}.jpg`
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('profile-pictures')
        .upload(fileName, selectedFile)

      if (uploadError) {
        console.error('Upload error:', uploadError)
        alert('Failed to upload image. Please try again.')
        setUploading(false)
        return
      }

      // Get public URL
      const { data: { publicUrl } } = supabase.storage
        .from('profile-pictures')
        .getPublicUrl(fileName)

      // Update rushees table
      const { error: updateError } = await (supabase as any)
        .from('rushees')
        .update({ photo: publicUrl })
        .eq('id', rusheeId)

      if (updateError) {
        console.error('Update error:', updateError)
        alert('Failed to update profile. Please try again.')
        setUploading(false)
        return
      }

      // Success - close modal
      setShowModal(false)
      window.location.reload() // Refresh to show new profile picture
    } catch (error) {
      console.error('Error uploading profile picture:', error)
      alert('Failed to upload profile picture. Please try again.')
      setUploading(false)
    }
  }

  if (!showModal) return null

  return (
    <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-[9999] p-4">
      <div className="bg-white rounded-lg max-w-md w-full p-8 shadow-2xl border-4 border-black">
        <div className="text-center mb-6">
          <h2 className="text-2xl font-black text-black mb-2 uppercase tracking-wide">
            Complete Your Profile
          </h2>
          <p className="text-ink-muted">
            Please upload a profile picture to continue. This helps brothers recognize you at events.
          </p>
        </div>

        {/* Preview */}
        <div className="mb-6">
          {preview ? (
            <div className="relative w-48 h-48 mx-auto">
              <img
                src={preview}
                alt="Preview"
                className="w-full h-full object-cover rounded-lg border-4 border-black"
              />
            </div>
          ) : (
            <div className="w-48 h-48 mx-auto bg-surface-sunken border-4 border-black rounded-lg flex items-center justify-center">
              <span className="text-sm font-semibold text-ink-muted uppercase tracking-wide">No photo yet</span>
            </div>
          )}
        </div>

        {/* File Input */}
        <div className="mb-6">
          <label className="block w-full">
            <input
              type="file"
              accept="image/*"
              onChange={handleFileSelect}
              className="hidden"
              disabled={uploading}
            />
            <div className="px-6 py-3 bg-black text-white text-center font-bold rounded-lg cursor-pointer hover:bg-inverse-soft transition-colors border-2 border-black uppercase tracking-wide">
              {selectedFile ? 'Change Photo' : 'Select Photo'}
            </div>
          </label>
          <p className="text-xs text-ink-subtle text-center mt-2">
            JPG, PNG, or GIF • Max 5MB
          </p>
        </div>

        {/* Upload Button */}
        {selectedFile && (
          <button
            onClick={handleUpload}
            disabled={uploading}
            className="w-full px-6 py-4 bg-emerald-800 text-white font-black rounded-lg hover:bg-emerald-900 transition-colors disabled:bg-ink-faint disabled:cursor-not-allowed border-2 border-black uppercase tracking-wider"
          >
            {uploading ? 'Uploading...' : 'Upload & Continue'}
          </button>
        )}

        {/* Info */}
        <p className="text-xs text-ink-subtle text-center mt-4">
          This modal will close automatically once your profile picture is uploaded.
        </p>
      </div>
    </div>
  )
}

'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/contexts/AuthContext'
import { POLICY, passwordHint } from '@/lib/policy'

interface UserResult {
  id: string
  name: string | null
  email: string | null
  account_type: string | null
  access_level: string | null
}

export default function AdminPasswordReset() {
  const { profile, loading: authLoading } = useAuth()
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState<UserResult[]>([])
  const [searching, setSearching] = useState(false)
  const [selectedUser, setSelectedUser] = useState<UserResult | null>(null)
  const [hasSearched, setHasSearched] = useState(false)
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [confirmIdentity, setConfirmIdentity] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [statusMessage, setStatusMessage] = useState<string | null>(null)

  const isAdmin = profile?.account_type === 'brother' && profile?.access_level === 'admin'

  const handleSearch = async (query?: string) => {
    const currentQuery = (query ?? searchQuery).trim()
    if (currentQuery.length < 2) {
      setSearchResults([])
      setHasSearched(false)
      return
    }

    setSearching(true)
    setStatusMessage(null)
    setSelectedUser(null)
    setHasSearched(true)

    try {
      const trimmed = currentQuery

      const [{ data: brothers, error: brothersError }, { data: rushees, error: rusheesError }] = await Promise.all([
        supabase
          .from('brothers')
          .select('id, name, email, access_level')
          .or(`email.ilike.%${trimmed}%,name.ilike.%${trimmed}%`)
          .order('name', { ascending: true })
          .limit(10),
        supabase
          .from('rushees')
          .select('id, name, email')
          .or(`email.ilike.%${trimmed}%,name.ilike.%${trimmed}%`)
          .order('name', { ascending: true })
          .limit(10),
      ])

      if (brothersError || rusheesError) {
        throw brothersError || rusheesError
      }

      const combined = new Map<string, UserResult>()
      ;(brothers || []).forEach((brother: any) => {
        combined.set(brother.id, {
          id: brother.id,
          name: brother.name ?? null,
          email: brother.email ?? null,
          account_type: 'brother',
          access_level: brother.access_level ?? 'basic',
        })
      })
      ;(rushees || []).forEach((rushee: any) => {
        if (!combined.has(rushee.id)) {
          combined.set(rushee.id, {
            id: rushee.id,
            name: rushee.name ?? null,
            email: rushee.email ?? null,
            account_type: 'rushee',
            access_level: 'basic',
          })
        }
      })

      setSearchResults(Array.from(combined.values()).slice(0, 10))
    } catch (error: any) {
      console.error('Error searching users:', error)
      setStatusMessage('Failed to search users. Please try again.')
    } finally {
      setSearching(false)
    }
  }

  useEffect(() => {
    if (searchQuery.trim().length < 2) {
      setSearchResults([])
      setHasSearched(false)
      return
    }

    const timer = setTimeout(() => {
      handleSearch(searchQuery)
    }, 400)

    return () => clearTimeout(timer)
  }, [searchQuery])

  const handleResetPassword = async () => {
    setStatusMessage(null)

    if (!selectedUser) {
      setStatusMessage('Select a user first.')
      return
    }

    if (!confirmIdentity) {
      setStatusMessage('Please confirm identity verification before continuing.')
      return
    }

    if (newPassword.length < POLICY.security.minPasswordLength) {
      setStatusMessage('Password must be at least ${POLICY.security.minPasswordLength} characters.')
      return
    }

    if (newPassword !== confirmPassword) {
      setStatusMessage('Passwords do not match.')
      return
    }

    setSubmitting(true)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session?.access_token) {
        throw new Error('No active session found')
      }

      const response = await fetch('/api/admin/reset-password', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          userId: selectedUser.id,
          newPassword,
          identityConfirmed: confirmIdentity,
        }),
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData?.error || 'Failed to reset password')
      }

      setStatusMessage('Password updated successfully.')
      setNewPassword('')
      setConfirmPassword('')
      setConfirmIdentity(false)
    } catch (error: any) {
      console.error('Error resetting password:', error)
      setStatusMessage(error.message || 'Failed to reset password. Please try again.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="min-h-screen bg-canvas">
      <main className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 pb-24 lg:py-8" style={{ paddingTop: 'max(1rem, env(safe-area-inset-top))' }}>
        <div className="mb-6">
          <p className="text-xs uppercase tracking-[0.35em] text-ink-subtle">Admin Tools</p>
          <h1 className="mt-2 text-3xl font-semibold text-ink">Password Reset</h1>
          <p className="text-sm text-ink-muted mt-2">
            Verify identity by phone, then set a new password directly. This bypasses email verification.
          </p>
        </div>

        {authLoading ? (
          <div className="text-ink-muted">Loading...</div>
        ) : !isAdmin ? (
          <div className="bg-white border border-line rounded-2xl p-8 shadow-sm">
            <p className="text-ink-muted font-medium">Admin access required.</p>
            <p className="text-ink-muted text-sm mt-2">Only admin accounts can reset passwords directly.</p>
          </div>
        ) : (
          <div className="space-y-6">
            <div className="bg-white border border-line rounded-2xl p-6 shadow-sm">
              <h2 className="text-lg font-semibold text-ink mb-4">Find User</h2>
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search by name or email"
                  className="flex-1 px-4 py-2 bg-white border border-line rounded-lg text-ink focus:ring-2 focus:ring-ink"
                />
                <button
                  onClick={() => handleSearch()}
                  disabled={searching}
                  className="px-4 py-2 bg-ink text-white rounded-lg font-semibold hover:bg-inverse-soft transition-colors disabled:opacity-60"
                >
                  {searching ? 'Searching...' : 'Search'}
                </button>
              </div>

              {searchResults.length > 0 && (
                <div className="mt-4 border border-line rounded-lg divide-y">
                  {searchResults.map((user) => (
                    <button
                      key={user.id}
                      type="button"
                      onClick={() => setSelectedUser(user)}
                      className={`w-full text-left px-4 py-3 hover:bg-surface-alt transition-colors ${
                        selectedUser?.id === user.id ? 'bg-surface-sunken' : ''
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-ink font-medium">{user.name || 'Unknown'}</p>
                          <p className="text-ink-muted text-sm">{user.email || 'No email'}</p>
                        </div>
                        <div className="text-xs text-ink-subtle">
                          {user.account_type || 'unknown'}{user.access_level ? ` • ${user.access_level}` : ''}
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              )}

              {hasSearched && searchResults.length === 0 && !searching && (
                <p className="mt-3 text-sm text-ink-muted">No users found.</p>
              )}
            </div>

            <div className="bg-white border border-line rounded-2xl p-6 shadow-sm">
              <h2 className="text-lg font-semibold text-ink mb-4">Set New Password</h2>

              <div className="text-sm text-ink-muted mb-4">
                {selectedUser ? (
                  <span>Selected: <span className="font-semibold text-ink">{selectedUser.name || selectedUser.email}</span></span>
                ) : (
                  <span>Select a user from the search results.</span>
                )}
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-ink-muted mb-2">New Password</label>
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    className="w-full px-4 py-2 bg-white border border-line rounded-lg text-ink focus:ring-2 focus:ring-ink"
                    placeholder="{passwordHint(POLICY)}"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-ink-muted mb-2">Confirm Password</label>
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    className="w-full px-4 py-2 bg-white border border-line rounded-lg text-ink focus:ring-2 focus:ring-ink"
                    placeholder="Re-enter the new password"
                  />
                </div>

                <div className="flex items-center gap-2">
                  <input
                    id="show-password"
                    type="checkbox"
                    checked={showPassword}
                    onChange={(e) => setShowPassword(e.target.checked)}
                    className="h-4 w-4 border-line-strong"
                  />
                  <label htmlFor="show-password" className="text-sm text-ink-muted">
                    Show password while typing
                  </label>
                </div>

                <div className="flex items-start gap-2">
                  <input
                    id="confirm-identity"
                    type="checkbox"
                    checked={confirmIdentity}
                    onChange={(e) => setConfirmIdentity(e.target.checked)}
                    className="mt-1 h-4 w-4 border-line-strong"
                  />
                  <label htmlFor="confirm-identity" className="text-sm text-ink-muted">
                    I have verified the user’s identity by phone and they entered the password themselves.
                  </label>
                </div>
              </div>

              {statusMessage && (
                <p className="mt-4 text-sm text-ink-muted">{statusMessage}</p>
              )}

              <div className="mt-5">
                <button
                  onClick={handleResetPassword}
                  disabled={submitting || !selectedUser}
                  className="px-4 py-2 bg-emerald-600 text-white rounded-lg font-semibold hover:bg-emerald-500 transition-colors disabled:opacity-60"
                >
                  {submitting ? 'Updating...' : 'Update Password'}
                </button>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  )
}

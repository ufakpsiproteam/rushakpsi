'use client'

import AdminNav from '@/components/admin/AdminNav'
import InvitePanel from '@/components/admin/InvitePanel'
import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'

interface Brother {
  id: string
  name: string
  email: string
  access_level: string
  roles: string[]
}

export default function AdminBrothers() {
  const [brothers, setBrothers] = useState<Brother[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedBrother, setSelectedBrother] = useState<Brother | null>(null)
  const [showRoleModal, setShowRoleModal] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    loadBrothers()
  }, [])

  async function loadBrothers() {
    try {
      // Fetch all brothers
      const { data: brothersData, error: brothersError } = await supabase
        .from('brothers')
        .select('id, name, email, access_level')
        .order('name')

      if (brothersError) throw brothersError

      // Fetch all roles
      const { data: rolesData, error: rolesError } = await supabase
        .from('brother_roles')
        .select('brother_id, role')

      if (rolesError) throw rolesError

      // Combine brothers with their roles
      const baseBrothers = (brothersData || []) as Array<Omit<Brother, 'roles'>>
      const roles = (rolesData || []) as Array<{ brother_id: string; role: string }>
      const brothersWithRoles: Brother[] = baseBrothers.map((brother) => ({
        ...brother,
        roles: roles
          .filter((r) => r.brother_id === brother.id)
          .map((r) => r.role)
      }))

      setBrothers(brothersWithRoles)
    } catch (error) {
      console.error('Error loading brothers:', error)
    } finally {
      setLoading(false)
    }
  }

  async function assignRole(brotherId: string, role: string) {
    setSaving(true)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) throw new Error('Not authenticated')

      const response = await fetch('/api/admin/assign-role', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`
        },
        body: JSON.stringify({ brotherId, role })
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Failed to assign role')
      }

      // Reload brothers to refresh the list
      await loadBrothers()

      // Update selected brother if modal is open
      if (selectedBrother && selectedBrother.id === brotherId) {
        const updatedBrother = brothers.find(b => b.id === brotherId)
        if (updatedBrother) {
          setSelectedBrother({ ...updatedBrother, roles: [...(updatedBrother.roles || []), role] })
        }
      }
    } catch (error: any) {
      console.error('Error assigning role:', error)
      alert(error.message || 'Failed to assign role')
    } finally {
      setSaving(false)
    }
  }

  async function revokeRole(brotherId: string, role: string) {
    setSaving(true)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) throw new Error('Not authenticated')

      const response = await fetch('/api/admin/assign-role', {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`
        },
        body: JSON.stringify({ brotherId, role })
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Failed to revoke role')
      }

      // Reload brothers to refresh the list
      await loadBrothers()

      // Update selected brother if modal is open
      if (selectedBrother && selectedBrother.id === brotherId) {
        const updatedBrother = brothers.find(b => b.id === brotherId)
        if (updatedBrother) {
          setSelectedBrother(updatedBrother)
        }
      }
    } catch (error: any) {
      console.error('Error revoking role:', error)
      alert(error.message || 'Failed to revoke role')
    } finally {
      setSaving(false)
    }
  }

  const formatRoleName = (role: string) => {
    const roleNames: Record<string, string> = {
      'recruitment_director': 'Directors of Recruitment',
      'professional_team': 'Professional Team',
      'professional_chair': 'Professional Chair',
      'admin': 'Admin'
    }
    return roleNames[role] || role
  }

  const formatAccessLevel = (level: string) => {
    const levels: Record<string, string> = {
      'admin': 'Admin',
      'recruitment': 'Recruitment',
      'pro': 'Professional',
      'basic': 'Basic'
    }
    return levels[level] || level
  }

  const filteredBrothers = brothers.filter(b => {
    if (!searchQuery.trim()) return true

    const query = searchQuery.toLowerCase()
    const matchesName = b.name.toLowerCase().includes(query)
    const matchesEmail = b.email.toLowerCase().includes(query)
    const matchesAccessLevel = b.access_level.toLowerCase().includes(query)
    const matchesRoles = b.roles.some(r => r.toLowerCase().includes(query))

    return matchesName || matchesEmail || matchesAccessLevel || matchesRoles
  })

  const availableRoles = ['recruitment_director', 'professional_team', 'professional_chair']

  return (
    <div className="min-h-screen bg-canvas">
      <AdminNav />

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-8">
          <p className="text-xs uppercase tracking-[0.35em] text-ink-subtle">Brother Management</p>
          <h1 className="mt-2 text-3xl font-semibold text-ink">Manage Brother Roles</h1>
          <p className="mt-2 text-sm text-ink-muted">
            Assign or revoke elevated roles for brothers to grant access to specific pages.
          </p>
        </div>

        <InvitePanel />

        {/* Search Bar */}
        {!loading && brothers.length > 0 && (
          <div className="mb-6">
            <div className="relative">
              <input
                type="text"
                placeholder="Search by name, email, access level, or role..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full px-4 py-3 pl-11 bg-white border border-line rounded-lg text-ink placeholder-ink-faint focus:ring-2 focus:ring-ink focus:border-transparent"
              />
              <svg
                className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-ink-faint"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="absolute right-3 top-1/2 transform -translate-y-1/2 text-ink-faint hover:text-ink-muted"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              )}
            </div>
          </div>
        )}

        {/* Loading State */}
        {loading && (
          <div className="text-center py-12">
            <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-ink"></div>
            <p className="mt-4 text-ink-muted">Loading brothers...</p>
          </div>
        )}

        {/* Brothers List */}
        {!loading && filteredBrothers.length === 0 && brothers.length === 0 && (
          <div className="text-center py-12">
            <p className="text-ink-muted">No brothers found</p>
          </div>
        )}

        {!loading && filteredBrothers.length === 0 && brothers.length > 0 && (
          <div className="text-center py-12">
            <p className="text-ink-muted">No brothers found matching your search</p>
            <button
              onClick={() => setSearchQuery('')}
              className="mt-2 text-ink hover:underline text-sm"
            >
              Clear search
            </button>
          </div>
        )}

        {!loading && filteredBrothers.length > 0 && (
          <div className="bg-white border border-line rounded-2xl overflow-hidden shadow-sm">
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-line">
                <thead className="bg-surface-alt">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-ink-muted uppercase tracking-wider">
                      Name
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-ink-muted uppercase tracking-wider">
                      Email
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-ink-muted uppercase tracking-wider">
                      Access Level
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-ink-muted uppercase tracking-wider">
                      Roles
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-ink-muted uppercase tracking-wider">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-line">
                  {filteredBrothers.map((brother) => (
                    <tr key={brother.id} className="hover:bg-surface-alt">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm font-medium text-ink">{brother.name}</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-ink-muted">{brother.email}</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className="px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full bg-surface-sunken text-inverse-soft">
                          {formatAccessLevel(brother.access_level)}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex flex-wrap gap-2">
                          {brother.roles.length === 0 ? (
                            <span className="text-sm text-ink-faint">No roles</span>
                          ) : (
                            brother.roles.map(role => (
                              <span
                                key={role}
                                className="px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full bg-surface-sunken text-ink"
                              >
                                {formatRoleName(role)}
                              </span>
                            ))
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                        <button
                          onClick={() => {
                            setSelectedBrother(brother)
                            setShowRoleModal(true)
                          }}
                          className="text-ink hover:text-ink"
                        >
                          Manage Roles
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Role Management Modal */}
        {showRoleModal && selectedBrother && (
          <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <div className="bg-white border border-line rounded-2xl max-w-lg w-full shadow-xl">
              <div className="p-6 border-b border-line">
                <div className="flex justify-between items-center">
                  <div>
                    <h2 className="text-xl font-semibold text-ink">Manage Roles</h2>
                    <p className="text-sm text-ink-muted mt-1">{selectedBrother.name}</p>
                  </div>
                  <button
                    onClick={() => {
                      setShowRoleModal(false)
                      setSelectedBrother(null)
                    }}
                    className="text-ink-muted hover:text-ink text-2xl"
                  >
                    x
                  </button>
                </div>
              </div>

              <div className="p-6 space-y-4">
                <div>
                  <p className="text-sm font-semibold text-ink-muted mb-2">Current Access Level</p>
                  <span className="px-3 py-1 inline-flex text-sm leading-5 font-semibold rounded-full bg-surface-sunken text-inverse-soft">
                    {formatAccessLevel(selectedBrother.access_level)}
                  </span>
                </div>

                <div>
                  <p className="text-sm font-semibold text-ink-muted mb-3">Elevated Roles</p>
                  <div className="space-y-3">
                    {availableRoles.map(role => {
                      const hasRole = selectedBrother.roles.includes(role)
                      return (
                        <div key={role} className="flex items-center justify-between p-3 bg-surface-alt rounded-lg">
                          <div>
                            <p className="font-medium text-ink">{formatRoleName(role)}</p>
                            <p className="text-xs text-ink-subtle">
                              {role === 'recruitment_director' && 'Review board, anonymous applications, and attendance operations.'}
                              {role === 'professional_team' && 'Review board and interview score entry.'}
                              {role === 'professional_chair' && 'Interview oversight, standings, and the bid-night deck.'}
                            </p>
                          </div>
                          <button
                            onClick={() => {
                              if (hasRole) {
                                revokeRole(selectedBrother.id, role)
                              } else {
                                assignRole(selectedBrother.id, role)
                              }
                            }}
                            disabled={saving}
                            className={`px-4 py-2 rounded-lg font-semibold transition-colors ${
                              hasRole
                                ? 'bg-rose-100 text-rose-700 hover:bg-rose-200'
                                : 'bg-ink text-white hover:bg-ink'
                            } disabled:opacity-50 disabled:cursor-not-allowed`}
                          >
                            {saving ? 'Saving...' : hasRole ? 'Revoke' : 'Assign'}
                          </button>
                        </div>
                      )
                    })}
                  </div>
                </div>

                <div className="pt-4">
                  <button
                    onClick={() => {
                      setShowRoleModal(false)
                      setSelectedBrother(null)
                    }}
                    className="w-full px-4 py-2 bg-ink text-white rounded-lg font-semibold hover:bg-inverse-soft transition-colors"
                  >
                    Done
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  )
}

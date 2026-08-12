'use client'

import AdminNav from '@/components/admin/AdminNav'
import Link from 'next/link'
import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'

export default function AdminDashboard() {
  const [adminName, setAdminName] = useState('')
  const [loading, setLoading] = useState(true)
  const [stats, setStats] = useState({
    totalRushees: 0,
    applicationsSubmitted: 0,
    inviteOnly: 0,
    bidsExtended: 0,
    totalEvents: 0,
    completedEvents: 0
  })

  useEffect(() => {
    async function loadAdminData() {
      try {
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) return

        // Get admin/brother name
        const { data: brother } = await supabase
          .from('brothers')
          .select('name')
          .eq('id', user.id)
          .single()

        if (brother) {
          setAdminName((brother as any).name)
        }

        // Load real stats from database
        await loadStats()
      } catch (error) {
        console.error('Error loading admin data:', error)
      } finally {
        setLoading(false)
      }
    }

    loadAdminData()
  }, [])

  async function loadStats() {
    try {
      // Count total rushees
      const { count: totalRushees } = await supabase
        .from('rushees')
        .select('*', { count: 'exact', head: true })

      // Count applications submitted
      const { count: applicationsSubmitted } = await supabase
        .from('applications')
        .select('*', { count: 'exact', head: true })
        .eq('is_submitted', true)

      // Count invite only rushees (published Yes)
      const { count: inviteOnly } = await supabase
        .from('rushees')
        .select('*', { count: 'exact', head: true })
        .eq('invite_only', true)

      // Count bids extended (published Yes)
      const { count: bidsExtended } = await supabase
        .from('rushees')
        .select('*', { count: 'exact', head: true })
        .eq('bid_status', true)

      // Count total events
      const { count: totalEvents } = await supabase
        .from('events')
        .select('*', { count: 'exact', head: true })

      // Count completed events (status = 'evaluation' or past events)
      const { count: completedEvents } = await supabase
        .from('events')
        .select('*', { count: 'exact', head: true })
        .lt('date', new Date().toISOString().split('T')[0])

      setStats({
        totalRushees: totalRushees || 0,
        applicationsSubmitted: applicationsSubmitted || 0,
        inviteOnly: inviteOnly || 0,
        bidsExtended: bidsExtended || 0,
        totalEvents: totalEvents || 0,
        completedEvents: completedEvents || 0
      })
    } catch (error) {
      console.error('Error loading stats:', error)
    }
  }

  const recentActivity = [
    { action: 'Application submitted', name: 'John Doe', time: '2 hours ago' },
    { action: 'Photo check-in approved', name: 'Jane Smith', time: '3 hours ago' },
    { action: 'Application submitted', name: 'Michael Brown', time: '5 hours ago' },
    { action: 'Evaluation completed', name: 'Sarah Johnson (Brother)', time: '1 day ago' }
  ]

  return (
    <div className="min-h-screen bg-canvas">
      <AdminNav />

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-8">
          <p className="text-xs uppercase tracking-[0.35em] text-ink-subtle">Admin Dashboard</p>
          <div className="mt-2 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <h1 className="text-3xl font-semibold text-ink">
              {loading ? 'Welcome!' : `Welcome, ${adminName}!`}
            </h1>
            <Link
              href="/admin/password-reset"
              className="inline-flex items-center text-sm font-semibold text-ink-muted hover:text-ink"
            >
              Reset Password
            </Link>
          </div>
          <p className="mt-2 text-sm text-ink-muted">
            Manage recruitment, review applications, and track progress.
          </p>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
          <div className="bg-white border border-line rounded-2xl p-6 shadow-sm">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-ink-muted text-sm font-medium mb-1">Total Rushees</p>
                <p className="text-3xl font-semibold text-ink">{stats.totalRushees}</p>
              </div>
              <div className="text-2xl text-ink-faint">
                <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 20h5v-2a4 4 0 00-4-4h-1m-4 6H2v-2a4 4 0 014-4h3m4-4a4 4 0 11-8 0 4 4 0 018 0zm6 4a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
              </div>
            </div>
          </div>

          <div className="bg-white border border-emerald-200 rounded-2xl p-6 shadow-sm">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-ink-muted text-sm font-medium mb-1">Applications</p>
                <p className="text-3xl font-semibold text-ink">{stats.applicationsSubmitted}</p>
              </div>
              <div className="text-2xl text-emerald-500">
                <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 9h6m-6 4h6M7 19h10a2 2 0 002-2V7l-4-4H7a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
              </div>
            </div>
          </div>

          <div className="bg-ink border border-ink text-white rounded-2xl p-6 shadow-sm">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-white/70 text-sm font-medium mb-1">Invite Only</p>
                <p className="text-3xl font-semibold text-white">{stats.inviteOnly}</p>
              </div>
              <div className="text-2xl text-white/70">
                <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 2v4m0 12v4m10-10h-4M6 12H2m16.95-4.95l-2.83 2.83M7.88 16.12l-2.83 2.83m11.9 0-2.83-2.83M7.88 7.88 5.05 5.05" />
                  <circle cx="12" cy="12" r="3" strokeWidth={1.5} />
                </svg>
              </div>
            </div>
          </div>

          <div className="bg-white border border-line rounded-2xl p-6 shadow-sm">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-ink-muted text-sm font-medium mb-1">Bids Extended</p>
                <p className="text-3xl font-semibold text-ink">{stats.bidsExtended}</p>
              </div>
              <div className="text-2xl text-ink-faint">
                <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 4l5 5m0-5L4 9m6 6l5 5m0-5-5 5M6 13l4-4 4 4-4 4-4-4z" />
                </svg>
              </div>
            </div>
          </div>

          <div className="bg-white border border-line rounded-2xl p-6 shadow-sm">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-ink-muted text-sm font-medium mb-1">Total Events</p>
                <p className="text-3xl font-semibold text-ink">{stats.totalEvents}</p>
              </div>
              <div className="text-2xl text-ink-faint">
                <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
              </div>
            </div>
          </div>

          <div className="bg-white border border-line rounded-2xl p-6 shadow-sm">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-ink-muted text-sm font-medium mb-1">Completed Events</p>
                <p className="text-3xl font-semibold text-ink">{stats.completedEvents}</p>
              </div>
              <div className="text-2xl text-ink-faint">
                <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M5 13l4 4L19 7" />
                </svg>
              </div>
            </div>
          </div>
        </div>

      </main>
    </div>
  )
}

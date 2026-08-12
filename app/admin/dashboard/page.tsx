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
          <div className="stat-tile">
            <div className="flex items-center justify-between">
              <div>
                <p className="stat-label">Total Rushees</p>
                <p className="stat-value">{stats.totalRushees}</p>
              </div>
              <div className="text-2xl text-ink-faint">
                <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 20h5v-2a4 4 0 00-4-4h-1m-4 6H2v-2a4 4 0 014-4h3m4-4a4 4 0 11-8 0 4 4 0 018 0zm6 4a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
              </div>
            </div>
          </div>

          <div className="stat-tile">
            <div className="flex items-center justify-between">
              <div>
                <p className="stat-label">Applications</p>
                <p className="stat-value">{stats.applicationsSubmitted}</p>
              </div>
              <div className="text-2xl text-positive">
                <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 9h6m-6 4h6M7 19h10a2 2 0 002-2V7l-4-4H7a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
              </div>
            </div>
          </div>

          <div className="stat-tile bg-[var(--color-inverse)] border-[var(--color-inverse)]">
            <div className="flex items-center justify-between">
              <div>
                <p className="stat-label text-[var(--color-on-inverse)]/70">Invite Only</p>
                <p className="stat-value text-[var(--color-on-inverse)]">{stats.inviteOnly}</p>
              </div>
              <div className="text-2xl text-[var(--color-on-inverse)]/70">
                <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 2v4m0 12v4m10-10h-4M6 12H2m16.95-4.95l-2.83 2.83M7.88 16.12l-2.83 2.83m11.9 0-2.83-2.83M7.88 7.88 5.05 5.05" />
                  <circle cx="12" cy="12" r="3" strokeWidth={1.5} />
                </svg>
              </div>
            </div>
          </div>

          <div className="stat-tile">
            <div className="flex items-center justify-between">
              <div>
                <p className="stat-label">Bids Extended</p>
                <p className="stat-value">{stats.bidsExtended}</p>
              </div>
              <div className="text-2xl text-ink-faint">
                <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 4l5 5m0-5L4 9m6 6l5 5m0-5-5 5M6 13l4-4 4 4-4 4-4-4z" />
                </svg>
              </div>
            </div>
          </div>

          <div className="stat-tile">
            <div className="flex items-center justify-between">
              <div>
                <p className="stat-label">Total Events</p>
                <p className="stat-value">{stats.totalEvents}</p>
              </div>
              <div className="text-2xl text-ink-faint">
                <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
              </div>
            </div>
          </div>

          <div className="stat-tile">
            <div className="flex items-center justify-between">
              <div>
                <p className="stat-label">Completed Events</p>
                <p className="stat-value">{stats.completedEvents}</p>
              </div>
              <div className="text-2xl text-ink-faint">
                <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M5 13l4 4L19 7" />
                </svg>
              </div>
            </div>
          </div>
        </div>

        {/* Shortcuts — moved off the top nav (it overflowed with all 11
            links) and onto the dashboard as tiles instead. */}
        <div className="mb-8">
          <p className="section-title mb-3">More tools</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            <Link href="/admin/cuts" className="card card-interactive card-pad flex items-center gap-4">
              <svg className="w-7 h-7 text-ink-faint shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
              </svg>
              <div>
                <p className="section-title">Review Board</p>
                <p className="mt-1 text-sm text-ink-muted">Cuts &amp; evaluations</p>
              </div>
            </Link>

            <Link href="/admin/slides" className="card card-interactive card-pad flex items-center gap-4">
              <svg className="w-7 h-7 text-ink-faint shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 5h16a1 1 0 011 1v10a1 1 0 01-1 1H4a1 1 0 01-1-1V6a1 1 0 011-1zM9 21h6M12 17v4" />
              </svg>
              <div>
                <p className="section-title">Bid Night Deck</p>
                <p className="mt-1 text-sm text-ink-muted">Presentation slides</p>
              </div>
            </Link>

            <Link href="/admin/interview-questions" className="card card-interactive card-pad flex items-center gap-4">
              <svg className="w-7 h-7 text-ink-faint shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <div>
                <p className="section-title">Interview Questions</p>
                <p className="mt-1 text-sm text-ink-muted">Manage the question bank</p>
              </div>
            </Link>
          </div>
        </div>

      </main>
    </div>
  )
}

'use client'

import RusheeNav, { POINT_OF_CONTACT } from '@/components/rushee/RusheeNav'
import StatusBanner from '@/components/rushee/StatusBanner'
import ProfilePictureModal from '@/components/rushee/ProfilePictureModal'
import PullToRefresh from '@/components/PullToRefresh'
import Link from 'next/link'
import { useState, useEffect, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { getRusheeAttendance } from '@/lib/database'

export default function RusheeDashboard() {
  const [rusheeData, setRusheeData] = useState<{
    name: string
    casualEvents: number
    professionalEvents: number
    applicationComplete: boolean
    inviteOnly: boolean | null
    bidStatus: boolean | null
  }>({
    name: '',
    casualEvents: 0,
    professionalEvents: 0,
    applicationComplete: false,
    inviteOnly: null,
    bidStatus: null,
  })
  const [loading, setLoading] = useState(true)

  const loadRusheeData = useCallback(async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      const { data: rushee } = await supabase
        .from('rushees')
        .select('name, invite_only, bid_status')
        .eq('id', user.id)
        .single()

      const { data: attendanceData } = await getRusheeAttendance(user.id)

      let casualCount = 0
      let professionalCount = 0

      if (attendanceData) {
        attendanceData.forEach((record: any) => {
          if (record.status === 'approved' && record.event) {
            if (record.event.type === 'Casual') {
              casualCount++
            } else if (record.event.type === 'Professional') {
              professionalCount++
            }
          }
        })
      }

      const { data: application } = await supabase
        .from('applications')
        .select('is_submitted')
        .eq('rushee_id', user.id)
        .single()

      setRusheeData({
        name: (rushee as any)?.name || '',
        casualEvents: casualCount,
        professionalEvents: professionalCount,
        applicationComplete: !!(application as any)?.is_submitted,
        inviteOnly: (rushee as any)?.invite_only ?? null,
        bidStatus: (rushee as any)?.bid_status ?? null,
      })
    } catch (error) {
      console.error('Error loading rushee data:', error)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    loadRusheeData()
  }, [loadRusheeData])

  const handleRefresh = useCallback(async () => {
    await loadRusheeData()
  }, [loadRusheeData])

  // Get first name for greeting
  const firstName = rusheeData.name.split(' ')[0]

  return (
    <div className="min-h-screen bg-canvas">
      <ProfilePictureModal />
      <RusheeNav />

      {/* Content container with rounded bottom corners */}
      <div
        className="bg-canvas"
        style={{
          minHeight: 'calc(100vh - 4rem - env(safe-area-inset-bottom))',
          paddingBottom: '1.5rem'
        }}
      >
        <PullToRefresh onRefresh={handleRefresh} className="min-h-0">
          <main
            className="max-w-3xl mx-auto px-4 pb-6"
            style={{ paddingTop: 'max(1.5rem, env(safe-area-inset-top))' }}
          >
          {/* Header */}
          <div className="mb-8">
            <p className="text-xs uppercase tracking-[0.35em] text-ink-subtle">Dashboard</p>
            <h1 className="mt-2 text-3xl font-semibold text-ink tracking-tight">
              {loading ? 'Welcome!' : firstName || 'Welcome'}
            </h1>
            <p className="mt-2 text-sm text-ink-muted">
              Good {getGreeting()}. Here’s your rush progress at a glance.
            </p>
          </div>

          {/* Progress Section */}
          <section className="mb-6">
            <div className="rounded-2xl border border-line bg-white p-6 shadow-sm">
              <StatusBanner
                casualEvents={rusheeData.casualEvents}
                professionalEvents={rusheeData.professionalEvents}
                applicationComplete={rusheeData.applicationComplete}
                inviteOnly={rusheeData.inviteOnly}
                bidStatus={rusheeData.bidStatus}
              />
            </div>
          </section>

          {/* Quick Actions */}
          <section className="mb-6">
            <h2 className="text-xs font-semibold text-ink-faint uppercase tracking-[0.35em] mb-3">
              Quick Actions
            </h2>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              <Link
                href="/rushee/events"
                className="bg-white rounded-2xl p-5 shadow-sm border border-line hover:border-line-strong transition active:scale-[0.98]"
              >
                <div className="w-10 h-10 bg-ink rounded-xl flex items-center justify-center mb-3">
                  <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                </div>
                <p className="font-semibold text-ink text-sm">Events</p>
                <p className="text-xs text-ink-subtle">Check in & view</p>
              </Link>

              <Link
                href="/rushee/application"
                className="bg-white rounded-2xl p-5 shadow-sm border border-line hover:border-line-strong transition active:scale-[0.98]"
              >
                <div className="w-10 h-10 bg-ink rounded-xl flex items-center justify-center mb-3">
                  <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                </div>
                <p className="font-semibold text-ink text-sm">Application</p>
                <p className="text-xs text-ink-subtle">Complete & submit</p>
              </Link>
              <Link
                href="/rushee/info"
                className="bg-white rounded-2xl p-5 shadow-sm border border-line hover:border-line-strong transition active:scale-[0.98]"
              >
                <div className="w-10 h-10 bg-ink rounded-xl flex items-center justify-center mb-3">
                  <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <p className="font-semibold text-ink text-sm">Info</p>
                <p className="text-xs text-ink-subtle">Chapter details</p>
              </Link>
            </div>
          </section>

          {/* Help Card */}
          <section>
            <div className="bg-white rounded-2xl p-5 shadow-sm border border-line">
              <div className="flex items-start">
                <div className="w-10 h-10 bg-surface-sunken rounded-full flex items-center justify-center mr-3 flex-shrink-0">
                  <svg className="w-5 h-5 text-ink-muted" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <div className="flex-1">
                  <p className="font-semibold text-ink text-sm">Need help?</p>
                  <p className="text-xs text-ink-subtle mt-0.5">
                    Reach out to your recruitment contact or check the Info tab for FAQs.
                  </p>
                </div>
                <Link
                  href="/rushee/info"
                  className="text-xs font-semibold text-ink ml-2"
                >
                  View
                </Link>
              </div>
            </div>
          </section>

          <p className="text-center text-xs text-ink-subtle mt-6">
            Have any questions? Email{' '}
            <a href={`mailto:${POINT_OF_CONTACT.email}`} className="font-semibold text-ink underline">
              {POINT_OF_CONTACT.name}
            </a>
          </p>
          </main>
        </PullToRefresh>
      </div>
    </div>
  )
}

function getGreeting() {
  const hour = new Date().getHours()
  if (hour < 12) return 'morning'
  if (hour < 17) return 'afternoon'
  return 'evening'
}

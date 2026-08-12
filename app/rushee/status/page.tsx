'use client'

import { useEffect, useState } from 'react'
import RusheeNav from '@/components/rushee/RusheeNav'
import PullToRefresh from '@/components/PullToRefresh'
import EnvelopeCard from '@/components/rushee/EnvelopeCard'
import { supabase } from '@/lib/supabase'

interface RusheeProfile {
  id: string
  name: string
  inviteOnly: boolean | null
  bidStatus: boolean | null
}

export default function RusheeStatus() {
  const [rusheeData, setRusheeData] = useState<RusheeProfile | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    loadRusheeData()
  }, [])

  async function handleRefresh() {
    await loadRusheeData()
  }

  async function loadRusheeData() {
      try {
        const { data: { user } } = await supabase.auth.getUser()

        if (!user) {
          setError('Not authenticated')
          setLoading(false)
          return
        }


        // First, get the profile data for the user's name
        const { data: profile } = await supabase
          .from('profiles')
          .select('full_name')
          .eq('id', user.id)
          .single()


        // Query rushees table to see what columns are available
        const { data: rushee, error: rusheeError } = await supabase
          .from('rushees')
          .select('*')
          .eq('id', user.id)
          .single()


        if (rusheeError) {
          // If rushees table query fails, the rushee might not exist yet
          console.error('Database error:', rusheeError)

          // Set default data with just the profile name
          const profileData: any = profile
          setRusheeData({
            id: user.id,
            name: profileData?.full_name || 'Unknown',
            inviteOnly: null,
            bidStatus: null,
          })
          setError(null)
          setLoading(false)
          return
        }

        if (!rushee) {
          // No rushee record, but we have a profile
          const profileData: any = profile
          setRusheeData({
            id: user.id,
            name: profileData?.full_name || 'Unknown',
            inviteOnly: null,
            bidStatus: null,
          })
          setError(null)
          setLoading(false)
          return
        }

        // Set data with defaults
        const rusheeData: any = rushee
        const profileData: any = profile
        setRusheeData({
          id: rusheeData.id,
          name: profileData?.full_name || rusheeData.name || 'Unknown',
          inviteOnly: rusheeData.invite_only ?? null,
          bidStatus: rusheeData.bid_status ?? null,
        })

        setError(null)
      } catch (err) {
        console.error('Unexpected error loading rushee data:', err)
        setError('An unexpected error occurred')
      } finally {
        setLoading(false)
      }
    }

  if (loading) {
    return (
      <div className="min-h-screen bg-canvas">
        <RusheeNav />
        <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 pb-24 lg:py-8" style={{ paddingTop: 'max(1rem, env(safe-area-inset-top))' }}>
          <div className="text-center py-12">
            <p className="text-ink-muted">Loading...</p>
          </div>
        </main>
      </div>
    )
  }

  if (error || !rusheeData) {
    return (
      <div className="min-h-screen bg-canvas">
        <RusheeNav />
        <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 pb-24 lg:py-8" style={{ paddingTop: 'max(1rem, env(safe-area-inset-top))' }}>
          <div className="text-center py-12">
            <p className="text-red-600 font-semibold mb-2">Unable to load your profile</p>
            {error && <p className="text-ink-muted text-sm">{error}</p>}
            <button
              onClick={() => window.location.reload()}
              className="mt-4 px-4 py-2 bg-ink text-white rounded-lg hover:bg-inverse-soft"
            >
              Retry
            </button>
          </div>
        </main>
      </div>
    )
  }

  const { name, inviteOnly, bidStatus } = rusheeData
  const fullName = name

  // Determine which envelope to show - only show the MOST RECENT decision
  // If bid decision exists, show only bid. Otherwise show invite if it exists.
  const hasBidDecision = bidStatus !== null
  const hasInviteDecision = inviteOnly !== null

  // Show only ONE envelope - the most recent decision
  const showInviteEnvelope = hasInviteDecision && !hasBidDecision
  const showBidEnvelope = hasBidDecision

  // Determine if envelopes are locked (decision not made yet)
  const inviteDecisionMade = hasInviteDecision || hasBidDecision
  const bidDecisionMade = hasBidDecision

  return (
    <div className="min-h-screen bg-canvas">
      <RusheeNav />

      <PullToRefresh onRefresh={handleRefresh} className="min-h-screen lg:min-h-0">
        <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 pb-24 lg:py-8" style={{ paddingTop: 'max(1rem, env(safe-area-inset-top))' }}>
        <div className="mb-8">
          <p className="text-xs uppercase tracking-[0.35em] text-ink-subtle">Decision Center</p>
          <h1 className="mt-2 text-3xl font-semibold text-ink">Status</h1>
          <p className="mt-2 text-sm text-ink-muted max-w-2xl">
            When decisions are released, your official letters will appear here.
          </p>
        </div>

        {/* Show envelope cards if decisions are available */}
        {(showInviteEnvelope || showBidEnvelope) ? (
          <div className="space-y-6">
            {/* Invite-Only Decision Envelope */}
            {showInviteEnvelope && (
              <EnvelopeCard
                phase="invite"
                inviteOnly={inviteOnly}
                bidStatus={bidStatus}
                rusheeName={fullName}
                isLocked={!inviteDecisionMade}
              />
            )}

            {/* Bid Decision Envelope - Only show if accepted at Invite-Only */}
            {showBidEnvelope && (
              <EnvelopeCard
                phase="bid"
                inviteOnly={inviteOnly}
                bidStatus={bidStatus}
                rusheeName={fullName}
                isLocked={!bidDecisionMade}
              />
            )}
          </div>
        ) : (
          /* No decisions yet - show information card */
          <div className="bg-white border border-line rounded-2xl p-8 shadow-sm">
            <div className="text-center py-4 pb-24 lg:py-8">
              <h2 className="text-2xl font-semibold text-ink mb-3">No Decision Updates Yet</h2>
              <p className="text-ink-muted mb-6 max-w-md mx-auto">
                {inviteOnly === null
                  ? 'Complete your application and meet event requirements to be considered for Invite-Only events.'
                  : 'Decision updates will appear here once they are available. Check back soon!'}
              </p>
              <div className="bg-surface-alt border border-line rounded-xl p-6 max-w-md mx-auto">
                <h3 className="font-semibold text-ink mb-3">What to Expect</h3>
                <div className="space-y-2 text-left text-ink-muted text-sm">
                  <p>• Decision updates will be posted here as formal letters</p>
                  <p>• You will receive notifications when decisions are made</p>
                  <p>• There are two decision phases: Invite-Only and Final Bid</p>
                  <p>• Check this page regularly for updates</p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Information Box */}
        <div className="mt-8 bg-white border border-line rounded-2xl p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-ink mb-3">Questions?</h2>
          <div className="space-y-2 text-ink-muted text-sm">
            <p>
              • Decision letters will appear above when they are available
            </p>
            <p>
              • You will also receive email notifications for all decisions
            </p>
            <p>
              • If you have any questions, reach out to your point of contact
            </p>
          </div>
        </div>
        </main>
      </PullToRefresh>
    </div>
  )
}

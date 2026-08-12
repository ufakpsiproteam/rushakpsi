'use client'

import Link from 'next/link'
import { evaluateEligibility, isDecisionMade } from '@/lib/policy'

interface StatusBannerProps {
  casualEvents: number
  professionalEvents: number
  applicationComplete: boolean
  inviteOnly?: boolean | null
  bidStatus?: boolean | null
}

interface ProgressRingProps {
  progress: number
  size?: number
  strokeWidth?: number
  children?: React.ReactNode
}

function ProgressRing({ progress, size = 72, strokeWidth = 6, children }: ProgressRingProps) {
  const radius = (size - strokeWidth) / 2
  const circumference = radius * 2 * Math.PI
  const offset = circumference - (Math.min(progress, 100) / 100) * circumference

  return (
    <div className="relative" style={{ width: size, height: size }}>
      <svg className="transform -rotate-90" width={size} height={size}>
        {/* Background circle */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="#f0f0f0"
          strokeWidth={strokeWidth}
        />
        {/* Progress circle */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={progress >= 100 ? '#22c55e' : '#000000'}
          strokeWidth={strokeWidth}
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          strokeLinecap="round"
          className="transition-all duration-500 ease-out"
        />
      </svg>
      <div className="absolute inset-0 flex items-center justify-center">
        {children}
      </div>
    </div>
  )
}

export default function StatusBanner({ casualEvents, professionalEvents, applicationComplete, inviteOnly, bidStatus }: StatusBannerProps) {
  const totalEvents = casualEvents + professionalEvents

  // R2 — read from the shared rulebook, never from local constants, so
  // the rings, the FAQ badge and the application gate cannot disagree.
  const eligibility = evaluateEligibility({
    casual: casualEvents,
    professional: professionalEvents,
    total: totalEvents,
  })

  const casualRequired = eligibility.minCasual
  const professionalRequired = eligibility.minProfessional
  const totalRequired = eligibility.minTotal

  const casualProgress = (casualEvents / casualRequired) * 100
  const professionalProgress = (professionalEvents / professionalRequired) * 100
  const totalProgress = (totalEvents / totalRequired) * 100

  const casualMet = eligibility.casualMet
  const professionalMet = eligibility.professionalMet
  const totalMet = eligibility.totalMet
  const standardsMet = eligibility.minimumsMet

  const decision = { inviteOnly: inviteOnly ?? null, bidStatus: bidStatus ?? null }
  const hasStatusUpdate = isDecisionMade(decision)
  // Replaces the old frozen 'Event Minimums Met' text state with a live
  // check — no decision published yet, and minimums are currently met.
  const showReadyToApply = decision.inviteOnly === null && standardsMet && !applicationComplete

  return (
    <div className="space-y-4">
      {/* Progress Rings Row */}
      <div className="bg-white rounded-2xl p-5 shadow-sm">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-ink">Your Progress</h3>
          {standardsMet && (
            <span className="text-xs font-medium text-green-600 bg-green-50 px-2.5 py-1 rounded-full">
              Requirements Met
            </span>
          )}
        </div>

        <div className="flex justify-around items-center">
          {/* Casual */}
          <div className="flex flex-col items-center">
            <ProgressRing progress={casualProgress}>
              <span className="text-lg font-bold text-ink">{casualEvents}</span>
            </ProgressRing>
            <span className="text-xs text-ink-subtle mt-2">Casual</span>
            <span className="text-[10px] text-ink-faint">{casualRequired} required</span>
          </div>

          {/* Professional */}
          <div className="flex flex-col items-center">
            <ProgressRing progress={professionalProgress}>
              <span className="text-lg font-bold text-ink">{professionalEvents}</span>
            </ProgressRing>
            <span className="text-xs text-ink-subtle mt-2">Professional</span>
            <span className="text-[10px] text-ink-faint">{professionalRequired} required</span>
          </div>

          {/* Total */}
          <div className="flex flex-col items-center">
            <ProgressRing progress={totalProgress}>
              <span className="text-lg font-bold text-ink">{totalEvents}</span>
            </ProgressRing>
            <span className="text-xs text-ink-subtle mt-2">Total</span>
            <span className="text-[10px] text-ink-faint">{totalRequired} required</span>
          </div>
        </div>
      </div>

      {/* Application Status Card */}
      {hasStatusUpdate ? (
        <>
          <style jsx>{`
            @keyframes pulseGlow {
              0%, 100% {
                box-shadow: 0 0 16px rgba(30, 41, 59, 0.16), 0 0 32px rgba(30, 41, 59, 0.12);
              }
              50% {
                box-shadow: 0 0 22px rgba(30, 41, 59, 0.28), 0 0 44px rgba(30, 41, 59, 0.18);
              }
            }
          `}</style>
          <Link
            href="/rushee/status"
            className="block rounded-2xl border border-line bg-white p-5 ring-2 ring-ink/10 transition hover:shadow-[0_0_24px_rgba(30,41,59,0.28)]"
            style={{ animation: 'pulseGlow 2.4s ease-in-out infinite' }}
          >
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-medium mb-1 text-ink-subtle">
                Application Status
              </p>
              <p className="text-xl font-bold text-ink">
                A Status Update Is Available
              </p>
            </div>
            <div className="w-12 h-12 rounded-full flex items-center justify-center bg-white">
              <svg className="w-6 h-6 text-ink-muted" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </div>
          </div>
          </Link>
        </>
      ) : showReadyToApply ? (
        <Link
          href="/rushee/application"
          className="block rounded-2xl p-5 shadow-sm bg-black transition hover:shadow-md"
        >
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-medium mb-1 text-ink-faint">
                Application Status
              </p>
              <p className="text-xl font-bold text-white">
                Ready to Apply
              </p>
            </div>
            <div className="w-12 h-12 rounded-full flex items-center justify-center bg-white">
              <svg className="w-6 h-6 text-black" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </div>
          </div>
        </Link>
      ) : (
        <div className={`rounded-2xl p-5 shadow-sm ${
          applicationComplete
            ? 'bg-green-50 border border-green-100'
            : 'bg-white'
        }`}>
          <div className="flex items-center justify-between">
            <div>
              <p className={`text-xs font-medium mb-1 ${
                applicationComplete
                  ? 'text-green-600'
                  : 'text-ink-subtle'
              }`}>
                Application Status
              </p>
              <p className={`text-xl font-bold ${
                applicationComplete
                  ? 'text-green-700'
                  : 'text-ink'
              }`}>
                {applicationComplete ? 'Submitted' : 'Locked'}
              </p>
              {!standardsMet && !applicationComplete && (
                <p className="text-xs text-ink-faint mt-1">
                  Complete event requirements to unlock
                </p>
              )}
            </div>

            <div className={`w-12 h-12 rounded-full flex items-center justify-center ${
              applicationComplete
                ? 'bg-green-100'
                : 'bg-surface-sunken'
            }`}>
              {applicationComplete ? (
                <svg className="w-6 h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              ) : (
                <svg className="w-6 h-6 text-ink-faint" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m0 0v2m0-2h2m-2 0H9m3-3V8m0 0V6m0 2h2m-2 0H9" />
                </svg>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

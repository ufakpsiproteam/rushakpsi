'use client'

import { useState, useEffect, useCallback } from 'react'
import confetti from 'canvas-confetti'
import DecisionLetter from './DecisionLetter'
import { supabase } from '@/lib/supabase'

interface EnvelopeCardProps {
  phase: 'invite' | 'bid'
  inviteOnly: boolean | null
  bidStatus: boolean | null
  rusheeName: string
  isLocked: boolean
  rusheeId?: string
  vpName?: string
  chapterName?: string
}

/**
 * Sealed envelope + letter reveal — PRD §6.3.8.
 *
 * Two corrections from the previous version:
 *
 * 1. Read state is stored per user, server-side, in `letter_reads`.
 *    It used to live in localStorage under a key that carried no user
 *    identity (`letter_seen_invite`), so on a shared browser — plausible
 *    at a check-in table — one rushee's "seen" state suppressed the NEW
 *    badge for the next rushee who signed in, and a rushee's own state
 *    didn't follow them to their phone.
 *
 * 2. Confetti respects prefers-reduced-motion (§10.4, §11.6): under that
 *    preference the letter simply appears.
 */
export default function EnvelopeCard({
  phase,
  inviteOnly,
  bidStatus,
  rusheeName,
  isLocked,
  rusheeId,
  vpName = 'Halle Taylor',
  chapterName = 'Alpha Phi Chapter',
}: EnvelopeCardProps) {
  const [isOpened, setIsOpened] = useState(false)
  const [hasBeenSeen, setHasBeenSeen] = useState(true) // assume seen until we know otherwise, so NEW never flashes

  const getLetterType = ():
    | 'invite-accept'
    | 'invite-reject'
    | 'bid-accept'
    | 'bid-reject'
    | null => {
    if (phase === 'invite') {
      if (inviteOnly === true) return 'invite-accept'
      if (inviteOnly === false) return 'invite-reject'
    } else if (phase === 'bid') {
      if (bidStatus === true) return 'bid-accept'
      if (bidStatus === false) return 'bid-reject'
    }
    return null
  }

  const letterType = getLetterType()

  useEffect(() => {
    let cancelled = false

    async function loadReadState() {
      try {
        const {
          data: { user },
        } = await supabase.auth.getUser()
        const id = rusheeId || user?.id
        if (!id) return

        const { data } = await supabase
          .from('letter_reads')
          .select('letter_key')
          .eq('rushee_id', id)
          .eq('letter_key', phase)
          .maybeSingle()

        if (!cancelled) setHasBeenSeen(Boolean(data))
      } catch {
        // If we can't tell, err toward not shouting NEW at someone who
        // has already read their letter.
        if (!cancelled) setHasBeenSeen(true)
      }
    }

    loadReadState()
    return () => {
      cancelled = true
    }
  }, [phase, rusheeId])

  const markSeen = useCallback(async () => {
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser()
      const id = rusheeId || user?.id
      if (!id) return

      await (supabase as any)
        .from('letter_reads')
        .upsert({ rushee_id: id, letter_key: phase }, { onConflict: 'rushee_id,letter_key' })
    } catch {
      // Read state is a nicety; failing to record it must never block the
      // rushee from seeing their letter.
    }
  }, [phase, rusheeId])

  const fireConfetti = useCallback(() => {
    const prefersReducedMotion =
      typeof window !== 'undefined' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches

    if (prefersReducedMotion) return

    // PRD §10.4 — dual-cannon burst from both lower corners over 3s.
    const end = Date.now() + 3000
    const colors = ['#000000', '#FFB81C', '#FFFFFF']

    const frame = () => {
      confetti({ particleCount: 3, angle: 60, spread: 55, origin: { x: 0 }, colors })
      confetti({ particleCount: 3, angle: 120, spread: 55, origin: { x: 1 }, colors })
      if (Date.now() < end) requestAnimationFrame(frame)
    }

    frame()
  }, [])

  const handleToggle = () => {
    if (isLocked) return

    const nextOpened = !isOpened
    setIsOpened(nextOpened)

    if (nextOpened) {
      if (!hasBeenSeen) {
        setHasBeenSeen(true)
        void markSeen()
      }

      // Confetti fires only on a positive decision — never on a rejection.
      if (letterType === 'invite-accept' || letterType === 'bid-accept') {
        fireConfetti()
      }
    }
  }

  if (isLocked || !letterType) return null

  if (isOpened) {
    return (
      <div className="card overflow-hidden">
        <div className="flex items-center justify-between gap-4 px-5 py-3.5 bg-inverse text-on-inverse">
          <h3 className="text-sm font-semibold tracking-tight">Status Update</h3>
          <button
            onClick={handleToggle}
            className="text-xs font-medium opacity-75 hover:opacity-100 transition-opacity"
          >
            Close
          </button>
        </div>
        <div className="p-6 animate-letter-reveal">
          <DecisionLetter
            type={letterType}
            rusheeName={rusheeName}
            vpName={vpName}
            chapterName={chapterName}
          />
        </div>
      </div>
    )
  }

  return (
    <button
      onClick={handleToggle}
      className={`card card-interactive card-pad w-full text-left group ${
        hasBeenSeen ? '' : 'card-emphasis'
      }`}
    >
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-4 min-w-0">
          <span
            className="flex h-11 w-11 items-center justify-center rounded-full border border-line-strong shrink-0"
            aria-hidden="true"
          >
            <svg className="w-5 h-5 text-ink" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1.6}
                d="M3 8l9 6 9-6M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
              />
            </svg>
          </span>
          <span className="min-w-0">
            <span className="block section-title group-hover:underline underline-offset-2">
              Status Update
            </span>
            <span className="block text-sm text-ink-subtle mt-0.5">
              Click to view your status update
            </span>
          </span>
        </div>

        <span className="flex items-center gap-3 shrink-0">
          {!hasBeenSeen && <span className="badge badge-solid">NEW</span>}
          <span className="text-ink-faint group-hover:text-ink transition-colors" aria-hidden="true">
            →
          </span>
        </span>
      </div>
    </button>
  )
}

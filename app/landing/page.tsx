'use client'

import Link from 'next/link'
import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { Cinzel, Manrope } from 'next/font/google'
import { formatDateInEST, getEventTimestampEST } from '@/lib/dateUtils'
import { POLICY, loadPolicy, requirementSummary } from '@/lib/policy'

const cinzel = Cinzel({ subsets: ['latin'], weight: ['400', '600', '700', '900'], display: 'swap' })
const manrope = Manrope({
  subsets: ['latin'],
  weight: ['300', '400', '500', '600', '700', '800'],
  display: 'swap',
})

/**
 * Public landing page — PRD §6.1.1.
 *
 * The cycle theme is a token/content layer, not a fork (§1.6, §10.1):
 * this cycle runs a space theme in place of the reference cycle's
 * Monopoly board. Everything below the hero — the process explainer, the
 * pillars, the FAQ, the events list — keeps the PRD's specified copy and
 * ordering. The requirements badge renders from the eligibility
 * configuration (R2) so the advertised rule is always the enforced rule.
 */

const CYCLE = {
  name: 'Chart Your Course',
  eyebrow: 'Spring 2026 Recruitment',
  tagline: 'Find your orbit. Build your trajectory. Go the distance.',
  groupMeUrl: 'https://groupme.com',
  processHeading: 'How the journey works',
}

/**
 * Static star field. Positions are fixed rather than random so the server
 * and client render identical markup — a randomised field would hydrate
 * mismatched.
 */
const STARS = [
  [4, 12, 1.6, 0.9], [11, 34, 1, 0.5], [17, 8, 2.2, 1], [23, 51, 1.2, 0.6],
  [29, 19, 1, 0.45], [34, 63, 1.8, 0.85], [39, 5, 1.3, 0.7], [44, 41, 1, 0.5],
  [48, 72, 2, 0.95], [53, 15, 1.1, 0.55], [58, 47, 1.6, 0.8], [62, 27, 1, 0.4],
  [67, 68, 1.4, 0.75], [71, 9, 2.1, 1], [76, 38, 1, 0.5], [81, 59, 1.5, 0.8],
  [85, 22, 1.2, 0.6], [89, 45, 1.9, 0.9], [93, 14, 1, 0.45], [97, 62, 1.4, 0.7],
  [7, 78, 1.3, 0.65], [14, 88, 1, 0.4], [21, 70, 1.7, 0.85], [27, 93, 1.1, 0.5],
  [36, 82, 1.5, 0.75], [42, 96, 1, 0.45], [51, 86, 1.8, 0.9], [59, 91, 1.2, 0.55],
  [66, 79, 1, 0.4], [74, 95, 1.6, 0.8], [83, 84, 1.3, 0.65], [91, 76, 1, 0.45],
  [2, 55, 1.4, 0.7], [9, 61, 1, 0.4], [19, 44, 1.2, 0.6], [31, 36, 1, 0.5],
  [46, 24, 1.5, 0.75], [55, 57, 1, 0.4], [69, 52, 1.3, 0.65], [79, 31, 1, 0.45],
  [87, 66, 1.6, 0.8], [95, 37, 1.1, 0.55], [64, 4, 1.2, 0.6], [26, 6, 1, 0.4],
] as const

function StarField() {
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden="true">
      {STARS.map(([left, top, size, opacity], i) => (
        <span
          key={i}
          className="absolute rounded-full bg-white animate-twinkle"
          style={{
            left: `${left}%`,
            top: `${top}%`,
            width: `${size}px`,
            height: `${size}px`,
            opacity,
            animationDelay: `${(i % 9) * 0.6}s`,
            animationDuration: `${4 + (i % 5)}s`,
          }}
        />
      ))}
    </div>
  )
}

const PILLARS = [
  { name: 'Brotherhood', detail: 'Lifelong connection and accountability.' },
  { name: 'Knowledge', detail: 'Sharpen business instincts and curiosity.' },
  { name: 'Integrity', detail: 'Do the right thing, every time.' },
  { name: 'Service', detail: 'Give back with intention and impact.' },
  { name: 'Unity', detail: 'Build together, win together.' },
]

const PROCESS = [
  {
    step: 'Step 1',
    title: 'Pre-Rush Events',
    subtitle: 'Get to know the brothers',
    detail: 'Connect early, ask questions, and see what makes AKPsi different.',
  },
  {
    step: 'Step 2',
    title: 'Rush Events',
    subtitle: 'Showcase who you are',
    detail: 'Bring your energy to professional and casual events.',
  },
  {
    step: 'Step 3',
    title: 'Advance to Apply',
    subtitle: 'Finish strong',
    detail: 'Complete requirements and submit your application + interview.',
  },
]

const FAQS = [
  {
    question: 'What is Alpha Kappa Psi?',
    answer:
      'Alpha Kappa Psi is the oldest and largest professional business fraternity, founded in 1904. We focus on developing principled business leaders through our Five Pillars: Brotherhood, Knowledge, Integrity, Service, and Unity.',
  },
  {
    question: 'Who can join?',
    answer:
      'Any student at the University of Florida with an interest in business and professional development is welcome to rush, regardless of major or year.',
  },
  {
    question: 'What is the time commitment?',
    answer:
      "During rush, you'll need to attend a minimum of 1 professional event, 1 casual event, and 1 event of your choice. As a brother, expect weekly meetings and various professional and social events throughout the semester.",
  },
  {
    question: 'How much does it cost?',
    answer:
      'Membership fees include national dues, chapter dues, and event costs. Specific pricing information will be shared during rush events.',
  },
  {
    question: 'What are the rush requirements?',
    answer:
      'To be eligible to apply, you must attend at least 1 professional event, 1 casual event, and 1 event of your choice during the rush period.',
  },
]

export default function LandingDesignPage() {
  const [faqOpen, setFaqOpen] = useState<number | null>(null)
  const [rushEvents, setRushEvents] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [policy, setPolicy] = useState(POLICY)

  useEffect(() => {
    loadPolicy().then(setPolicy)
  }, [])

  useEffect(() => {
    async function loadEvents() {
      try {
        const { data, error } = await supabase.from('events').select('*').order('date')
        if (error) throw error

        const sorted = (data || [])
          .slice()
          .sort((a: any, b: any) => getEventTimestampEST(a) - getEventTimestampEST(b))

        setRushEvents(sorted)
      } catch {
        setRushEvents([])
      } finally {
        setLoading(false)
      }
    }

    loadEvents()
  }, [])

  return (
    <div className={`${manrope.className} min-h-screen bg-space-void text-white overflow-x-hidden`}>
      {/* Announcement banner (§6.1.1 §1) */}
      <a
        href={CYCLE.groupMeUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="block w-full bg-gradient-to-r from-indigo-600/40 via-akpsi-gold/30 to-indigo-600/40 text-center text-xs sm:text-sm font-medium py-2.5 px-4 hover:brightness-125 transition-[filter]"
      >
        Join The GroupMe &amp; Stay Up To Date →
      </a>

      {/* Sticky navigation (§6.1.1 §2) */}
      <nav className="sticky top-0 z-50 border-b border-white/10 bg-space-void/80 backdrop-blur-md">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-5 py-3.5">
          <Link href="/" className="flex items-baseline gap-3 min-w-0">
            <span className={`${cinzel.className} text-xl font-bold tracking-[0.08em]`}>ΑΚΨ</span>
            <span className="hidden sm:block text-[11px] leading-tight text-white/55">
              Alpha Phi Chapter
              <br />
              University of Florida
            </span>
          </Link>

          <div className="flex items-center gap-2 sm:gap-3">
            <a
              href="#events"
              className="hidden sm:inline-flex rounded-lg px-3 py-2 text-sm text-white/70 hover:text-white hover:bg-white/5 transition-colors"
            >
              Rush Events
            </a>
            <Link
              href="/auth/signin"
              className="rounded-lg border border-white/25 px-4 py-2 text-sm font-semibold hover:bg-white hover:text-space-void transition-colors"
            >
              Sign In
            </Link>
          </div>
        </div>
      </nav>

      {/* Hero (§6.1.1 §3) */}
      <header className="relative isolate overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-b from-space-deep via-space-void to-space-void" />
        <StarField />

        {/* Nebula wash */}
        <div
          className="pointer-events-none absolute -top-40 left-1/2 h-[46rem] w-[46rem] -translate-x-1/2 rounded-full blur-3xl animate-aurora"
          style={{
            background:
              'radial-gradient(circle at 40% 40%, rgba(99,102,241,0.30), transparent 62%), radial-gradient(circle at 65% 55%, rgba(255,184,28,0.14), transparent 60%)',
          }}
          aria-hidden="true"
        />

        {/* Orbital rings */}
        <div
          className="pointer-events-none absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 animate-orbit-spin"
          aria-hidden="true"
        >
          <div className="h-[34rem] w-[34rem] rounded-full border border-white/[0.07]" />
          <div className="absolute inset-8 rounded-full border border-white/[0.05]" />
          <div className="absolute inset-20 rounded-full border border-akpsi-gold/[0.10]" />
        </div>

        <div className="relative mx-auto max-w-4xl px-5 pt-20 pb-24 sm:pt-28 sm:pb-32 text-center">
          <p className="text-[11px] font-semibold uppercase tracking-[0.34em] text-white/45">
            {CYCLE.eyebrow}
          </p>

          <h1
            className={`${cinzel.className} mt-5 text-[2.6rem] leading-[1.04] sm:text-6xl lg:text-7xl font-bold`}
          >
            {CYCLE.name}
          </h1>

          <p className="mx-auto mt-5 max-w-xl text-base sm:text-lg text-white/65">
            {CYCLE.tagline}
          </p>

          {/* Sign Up leads on mobile (§6.1.1 §3) */}
          <div className="mt-9 flex flex-col-reverse sm:flex-row items-center justify-center gap-3">
            <a
              href="#events"
              className="w-full sm:w-auto rounded-xl border border-white/25 px-7 py-3.5 text-sm font-semibold hover:bg-white/10 transition-colors"
            >
              View Rush Calendar
            </a>
            <Link
              href="/auth/signup"
              className="w-full sm:w-auto rounded-xl bg-white px-7 py-3.5 text-sm font-semibold text-space-void hover:bg-white/90 transition-colors"
            >
              Sign Up For Rush
            </Link>
          </div>

          <p className="mt-5 text-sm text-white/45">
            Already have an account?{' '}
            <Link href="/auth/signin" className="text-white/80 underline underline-offset-4 hover:text-white">
              Sign in.
            </Link>
          </p>
        </div>

        {/* Horizon glow */}
        <div
          className="pointer-events-none absolute inset-x-0 bottom-0 h-40"
          style={{
            background:
              'radial-gradient(120% 100% at 50% 100%, rgba(129,140,248,0.20), transparent 70%)',
          }}
          aria-hidden="true"
        />
      </header>

      {/* Process explainer (§6.1.1 §4) */}
      <section className="relative border-t border-white/10 bg-space-deep py-20">
        <div className="mx-auto max-w-6xl px-5">
          <h2 className={`${cinzel.className} text-center text-3xl sm:text-4xl font-bold`}>
            {CYCLE.processHeading}
          </h2>

          <div className="mt-12 grid gap-5 md:grid-cols-3">
            {PROCESS.map((item, i) => (
              <div
                key={item.step}
                className="relative rounded-2xl border border-white/10 bg-white/[0.03] p-7 transition-colors hover:border-white/20"
              >
                <span className="text-[11px] font-semibold uppercase tracking-[0.24em] text-akpsi-gold/80">
                  {item.step}
                </span>
                <h3 className="mt-3 text-lg font-semibold">{item.title}</h3>
                <p className="mt-1 text-sm font-medium text-white/70">{item.subtitle}</p>
                <p className="mt-3 text-sm leading-relaxed text-white/50">{item.detail}</p>

                <span
                  className={`${cinzel.className} pointer-events-none absolute right-5 top-4 text-5xl font-bold text-white/[0.05]`}
                  aria-hidden="true"
                >
                  {i + 1}
                </span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Five Pillars (§6.1.1 §5) */}
      <section className="relative border-t border-white/10 py-20">
        <StarField />
        <div className="relative mx-auto max-w-6xl px-5">
          <h2 className={`${cinzel.className} text-center text-3xl sm:text-4xl font-bold`}>
            The Five Pillars
          </h2>

          <div className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
            {PILLARS.map((pillar) => (
              <div
                key={pillar.name}
                className="rounded-2xl border border-white/10 bg-white/[0.03] p-6 text-center transition-colors hover:border-akpsi-gold/30"
              >
                <h3 className={`${cinzel.className} text-lg font-semibold`}>{pillar.name}</h3>
                <p className="mt-2 text-sm leading-relaxed text-white/50">{pillar.detail}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Rush events (§6.1.1 §6) */}
      <section id="events" className="scroll-mt-20 border-t border-white/10 bg-space-deep py-20">
        <div className="mx-auto max-w-6xl px-5">
          <div className="text-center">
            <h2 className={`${cinzel.className} text-3xl sm:text-4xl font-bold`}>Rush Events</h2>
            {/* Rendered from the eligibility configuration (R2). */}
            <p className="mt-4 inline-flex rounded-full border border-akpsi-gold/30 bg-akpsi-gold/[0.08] px-4 py-1.5 text-xs font-semibold text-akpsi-gold">
              {requirementSummary(policy)}
            </p>
          </div>

          <div className="mt-12">
            {loading ? (
              <div className="flex flex-col items-center py-16">
                <div className="h-8 w-8 animate-spin rounded-full border-2 border-white/20 border-t-white" />
              </div>
            ) : rushEvents.length === 0 ? (
              <p className="py-16 text-center text-white/50">
                No events scheduled at this time. Check back soon!
              </p>
            ) : (
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {rushEvents.map((event) => (
                  <article
                    key={event.id}
                    className="overflow-hidden rounded-2xl border border-white/10 bg-white/[0.03] transition-colors hover:border-white/20"
                  >
                    <div
                      className={`h-1 w-full ${
                        event.type === 'Professional'
                          ? 'bg-gradient-to-r from-indigo-400 to-indigo-200'
                          : 'bg-gradient-to-r from-akpsi-gold to-amber-200'
                      }`}
                    />

                    <div className="p-6">
                      <div className="flex items-start justify-between gap-3">
                        <h3 className="text-lg font-semibold leading-snug">{event.title}</h3>
                        <span className="shrink-0 rounded-full border border-white/20 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider text-white/60">
                          {event.type}
                        </span>
                      </div>

                      <dl className="mt-5 divide-y divide-white/10 border-y border-white/10 text-sm">
                        <div className="flex justify-between gap-4 py-2.5">
                          <dt className="text-white/45">Date</dt>
                          <dd className="text-right text-white/85">{formatDateInEST(event.date)}</dd>
                        </div>
                        <div className="flex justify-between gap-4 py-2.5">
                          <dt className="text-white/45">Time</dt>
                          <dd className="text-right text-white/85">{event.time || 'TBA'}</dd>
                        </div>
                        <div className="flex justify-between gap-4 py-2.5">
                          <dt className="text-white/45">Location</dt>
                          <dd className="text-right text-white/85">{event.location || 'TBA'}</dd>
                        </div>
                      </dl>

                      {event.description && (
                        <p className="mt-4 text-sm leading-relaxed text-white/50">
                          {event.description}
                        </p>
                      )}
                    </div>
                  </article>
                ))}
              </div>
            )}
          </div>
        </div>
      </section>

      {/* FAQ (§6.1.1 §7) */}
      <section className="border-t border-white/10 py-20">
        <div className="mx-auto max-w-3xl px-5">
          <h2 className={`${cinzel.className} text-center text-3xl sm:text-4xl font-bold`}>
            Frequently Asked Questions
          </h2>

          <div className="mt-10 divide-y divide-white/10 border-y border-white/10">
            {FAQS.map((faq, i) => {
              const open = faqOpen === i
              return (
                <div key={faq.question}>
                  <button
                    onClick={() => setFaqOpen(open ? null : i)}
                    aria-expanded={open}
                    className="flex w-full items-center justify-between gap-5 py-5 text-left"
                  >
                    <span className="text-base font-medium">{faq.question}</span>
                    <span
                      className="shrink-0 text-xl font-light text-white/50"
                      aria-hidden="true"
                    >
                      {open ? '−' : '+'}
                    </span>
                  </button>
                  {open && (
                    <p className="pb-6 text-sm leading-relaxed text-white/55">{faq.answer}</p>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      </section>

      {/* Closing call to action (§6.1.1 §8) */}
      <section className="relative overflow-hidden border-t border-white/10 bg-space-deep py-24">
        <StarField />
        <div
          className="pointer-events-none absolute inset-x-0 top-0 h-56 animate-aurora"
          style={{
            background:
              'radial-gradient(90% 100% at 50% 0%, rgba(99,102,241,0.22), transparent 70%)',
          }}
          aria-hidden="true"
        />

        <div className="relative mx-auto max-w-2xl px-5 text-center">
          <h2 className={`${cinzel.className} text-3xl sm:text-5xl font-bold leading-tight`}>
            Where will your next move take you?
          </h2>
          <p className="mx-auto mt-5 max-w-lg text-white/60">
            Every brother started exactly where you are now. Come to an event, meet the chapter, and
            see where it goes.
          </p>

          <div className="mt-9 flex flex-col-reverse sm:flex-row items-center justify-center gap-3">
            <a
              href="#events"
              className="w-full sm:w-auto rounded-xl border border-white/25 px-7 py-3.5 text-sm font-semibold hover:bg-white/10 transition-colors"
            >
              View Requirements
            </a>
            <Link
              href="/auth/signup"
              className="w-full sm:w-auto rounded-xl bg-white px-7 py-3.5 text-sm font-semibold text-space-void hover:bg-white/90 transition-colors"
            >
              Sign Up For Rush
            </Link>
          </div>
        </div>
      </section>

      {/* Footer (§6.1.1 §9) */}
      <footer className="border-t border-white/10 py-12">
        <div className="mx-auto flex max-w-6xl flex-col items-center gap-3 px-5 text-center">
          <span className={`${cinzel.className} text-2xl font-bold tracking-[0.08em]`}>ΑΚΨ</span>
          <p className="text-sm text-white/50">
            Alpha Kappa Psi · Alpha Phi Chapter · University of Florida
          </p>
          <p className="text-xs text-white/30">
            © {new Date().getFullYear()} Alpha Kappa Psi, Alpha Phi Chapter. All rights reserved.
          </p>
        </div>
      </footer>
    </div>
  )
}

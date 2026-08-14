'use client'

import Link from 'next/link'
import Image from 'next/image'
import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { portalFontVariables } from '@/lib/portalFonts'
import { formatDateInEST, getEventTimestampEST } from '@/lib/dateUtils'
import { POLICY, loadPolicy, requirementSummary } from '@/lib/policy'

/**
 * Public landing page — PRD §6.1.1.
 *
 * Visual system: the internal portal theme (oklch navy/blue/gold tokens,
 * Bodoni Moda / Sora / Nunito, .portal-shell) carrying the cycle's nebula
 * photo hero and starfield motif as the theme layer on top, per PRD §10.1
 * and §1.6 — the theme is content/token dressing, not a fork. Everything
 * below the hero keeps the PRD's specified copy, ordering, and live data.
 */

const CYCLE = {
  name: 'Rush ΑΚΨ',
  eyebrow: "Fall '26 Recruitment",
  subheading: 'Find your orbit',
  groupMeUrl: 'https://groupme.com',
  processHeading: 'Liftoff in…',
  instagramUrl: 'https://www.instagram.com/ufakpsi/',
  instagramHandle: '@ufakpsi',
}

const HERO_DESKTOP = '/rush-hero-desktop.jpg'
const HERO_MOBILE = '/rush-hero-mobile.jpg'

const subheading = { fontFamily: 'var(--font-portal-subheading)' } as const
const display = { fontFamily: 'var(--font-portal-display)', fontStyle: 'italic' as const }

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

/** Simple line-art Instagram glyph. */
function InstagramIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <rect x="3" y="3" width="18" height="18" rx="5" stroke="currentColor" strokeWidth="1.4" />
      <circle cx="12" cy="12" r="4.2" stroke="currentColor" strokeWidth="1.4" />
      <circle cx="17.2" cy="6.8" r="1" fill="currentColor" />
    </svg>
  )
}

/** Simple line-art rocket, decorative accent under the process cards. */
function RocketIcon() {
  return (
    <svg
      width="40"
      height="40"
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
      className="text-[var(--portal-gold-accent)]"
    >
      <path
        d="M12 2.5c2.8 1.6 4.5 4.6 4.5 8.4 0 2-.5 3.7-1.2 5.1l-3.3 2.5-3.3-2.5C7.99 14.6 7.5 12.9 7.5 10.9c0-3.8 1.7-6.8 4.5-8.4Z"
        stroke="currentColor"
        strokeWidth="1.3"
        strokeLinejoin="round"
      />
      <circle cx="12" cy="9.8" r="1.6" stroke="currentColor" strokeWidth="1.3" />
      <path d="M7.5 13.5c-1.6.3-2.7 1.4-3.2 3.4 1.9.3 3.3-.2 4.2-1.5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M16.5 13.5c1.6.3 2.7 1.4 3.2 3.4-1.9.3-3.3-.2-4.2-1.5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M10.3 18.5l1.7 2 1.7-2" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
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
    title: 'Application + Interviews',
    subtitle: 'Finish strong',
    detail: 'Complete requirements and submit your application and interview.',
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
  const [navSolid, setNavSolid] = useState(false)

  useEffect(() => {
    loadPolicy().then(setPolicy)
  }, [])

  useEffect(() => {
    const onScroll = () => setNavSolid(window.scrollY > window.innerHeight * 0.85)
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
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
    <div
      className={`portal-shell ${portalFontVariables} min-h-screen bg-inverse-soft text-on-inverse`}
    >
      {/* Announcement banner (§6.1.1 §1) */}
      <a
        href={CYCLE.groupMeUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="block w-full text-center text-xs sm:text-sm font-medium py-2.5 px-4 hover:brightness-110 transition-[filter]"
        style={{
          background:
            'linear-gradient(90deg, color-mix(in oklch, var(--portal-blue-light) 35%, transparent), color-mix(in oklch, var(--portal-gold-accent) 30%, transparent), color-mix(in oklch, var(--portal-blue-light) 35%, transparent))',
        }}
      >
        Join The GroupMe &amp; Stay Up To Date &rarr;
      </a>

      {/* Sticky navigation (§6.1.1 §2) — transparent over the hero, gains its background once scrolled past it */}
      <nav
        className={`sticky top-0 z-50 transition-colors duration-300 ${
          navSolid
            ? 'border-b border-white/10 bg-inverse-soft/85 backdrop-blur-md'
            : 'border-b border-transparent bg-transparent'
        }`}
      >
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-3 sm:px-5 sm:py-3.5">
          <Link href="/" className="flex items-baseline gap-2 sm:gap-3 min-w-0">
            <span className="lettermark text-on-inverse text-lg sm:text-xl font-bold tracking-[0.08em]">ΑΚΨ</span>
            <span className="hidden sm:block text-[11px] leading-tight text-on-inverse/55">
              Alpha Phi Chapter
              <br />
              University of Florida
            </span>
          </Link>

          <div className="flex items-center gap-2">
            <a
              href="#events"
              className="rounded-none px-2.5 py-2 sm:px-3 text-xs sm:text-sm text-on-inverse/70 hover:text-on-inverse hover:bg-white/5 transition-colors"
            >
              Rush Events
            </a>
            <Link
              href="/auth/signin"
              className="rounded-[8px] border border-white/25 px-3 py-2 sm:px-4 text-xs sm:text-sm font-semibold hover:bg-white hover:text-[var(--portal-navy-dark)] transition-colors"
            >
              Sign In
            </Link>
          </div>
        </div>
      </nav>

      {/* Hero (§6.1.1 §3) — nebula photo carried over from the cycle's design reference, kept structurally intact */}
      <header
        id="top"
        className="relative flex min-h-[85svh] w-full flex-col justify-center overflow-hidden"
      >
        <style>{`
          @keyframes gentle-bounce {
            0%, 100% { transform: translateY(0); }
            50% { transform: translateY(-5px); }
          }
        `}</style>
        <Image
          src={HERO_MOBILE}
          alt="A deep navy nebula scattered with starlight above the curve of a distant planet"
          fill
          priority
          sizes="100vw"
          className="object-cover md:hidden"
        />
        <Image
          src={HERO_DESKTOP}
          alt="A deep navy nebula scattered with starlight above the curve of a distant planet"
          fill
          priority
          sizes="100vw"
          className="hidden object-cover md:block"
        />
        <div aria-hidden="true" className="absolute inset-0 bg-[var(--portal-navy-dark)]/15" />
        <div
          aria-hidden="true"
          className="absolute inset-x-0 bottom-0 h-[60%]"
          style={{
            background:
              'linear-gradient(to top, var(--portal-navy-dark) 12%, color-mix(in oklch, var(--portal-navy-dark) 78%, transparent) 45%, transparent 100%)',
          }}
        />

        <div className="relative mx-auto w-full max-w-4xl translate-y-2.5 px-5 py-16 sm:px-6 sm:py-24 text-center">
          <p
            className="text-[11px] font-semibold uppercase tracking-[0.3em] text-[var(--portal-gold-accent)]"
            style={subheading}
          >
            {CYCLE.eyebrow}
          </p>

          <h1 className="mt-5 text-[clamp(3rem,13vw,7rem)] leading-[0.98] text-on-inverse">
            {CYCLE.name}
          </h1>

          <p className="mx-auto mt-4 max-w-sm text-base text-on-inverse/70 sm:text-lg">{CYCLE.subheading}</p>

          <div className="mt-10 flex flex-col items-center gap-3">
            <Link
              href="/auth/signup"
              className="w-full sm:w-auto rounded-[8px] border border-[var(--portal-gold-accent)] bg-transparent px-10 py-2.5 text-sm font-semibold text-[var(--portal-gold-accent)] hover:bg-[var(--portal-gold-accent)]/10 transition-colors"
            >
              Sign Up
            </Link>
            <p className="text-sm text-on-inverse/50">
              Already have an account?{' '}
              <Link href="/auth/signin" className="text-on-inverse/85 underline underline-offset-4 hover:text-on-inverse">
                Sign in.
              </Link>
            </p>
          </div>
        </div>

        <div className="absolute inset-x-0 bottom-6 mx-auto flex w-full max-w-6xl justify-center px-6">
          <span
            className="flex flex-col items-center gap-1 text-[11px] uppercase tracking-[0.3em] text-on-inverse/40 animate-[gentle-bounce_2.2s_ease-in-out_infinite]"
            style={subheading}
          >
            Scroll
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <path d="M12 4v16m0 0l-6-6m6 6l6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </span>
        </div>
      </header>

      {/* Process explainer (§6.1.1 §4) */}
      <section className="relative bg-inverse py-16 sm:py-20">
        <StarField />
        <div className="relative mx-auto max-w-6xl px-5">
          <h2 className="text-center text-3xl sm:text-4xl">{CYCLE.processHeading}</h2>

          <div className="mt-10 grid gap-4 sm:mt-12 sm:grid-cols-3 sm:gap-5">
            {PROCESS.map((item, i) => (
              <div
                key={item.step}
                className="relative border border-white/10 bg-white/[0.03] p-6 sm:p-7 transition-colors hover:border-white/20"
              >
                <h3 className="text-lg font-semibold">{item.title}</h3>
                <p className="mt-1 text-sm font-medium text-on-inverse/70">{item.subtitle}</p>
                <p className="mt-3 text-sm leading-relaxed text-on-inverse/50">{item.detail}</p>

                <span
                  className="pointer-events-none absolute right-5 top-4 text-5xl text-[var(--portal-gold-accent)]/25"
                  style={display}
                  aria-hidden="true"
                >
                  {3 - i}
                </span>
              </div>
            ))}
          </div>

          <div className="mt-10 flex justify-center sm:mt-12">
            <RocketIcon />
          </div>
        </div>
      </section>

      {/* Five Pillars (§6.1.1 §5) */}
      <section className="relative bg-inverse-soft py-16 sm:py-20">
        <div className="mx-auto max-w-6xl px-5">
          <h2 className="text-center text-3xl sm:text-4xl">The Five Pillars</h2>

          <div className="mt-10 grid gap-4 sm:mt-12 sm:grid-cols-2 lg:grid-cols-5">
            {PILLARS.map((pillar) => (
              <div
                key={pillar.name}
                className="border border-white/10 bg-white/[0.03] p-6 text-center transition-colors hover:border-[var(--portal-gold-accent)]/30"
              >
                <h3 className="text-lg font-semibold">{pillar.name}</h3>
                <p className="mt-2 text-sm leading-relaxed text-on-inverse/50">{pillar.detail}</p>
              </div>
            ))}
          </div>

          <a
            href={CYCLE.instagramUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-4 flex items-center justify-center gap-3 rounded-[8px] border border-[var(--portal-gold-accent)] bg-transparent p-6 text-center text-[var(--portal-gold-accent)] transition-colors hover:bg-[var(--portal-gold-accent)]/10"
          >
            <span
              className="text-[11px] font-semibold uppercase tracking-[0.3em]"
              style={subheading}
            >
              Follow Along
            </span>
            <InstagramIcon />
          </a>
        </div>
      </section>

      {/* Rush events (§6.1.1 §6) */}
      <section id="events" className="scroll-mt-20 bg-inverse py-16 sm:py-20">
        <div className="mx-auto max-w-6xl px-5">
          <div className="text-center">
            <h2 className="text-3xl sm:text-4xl">Rush Events</h2>
            <p
              className="mt-4 inline-flex rounded-[8px] border border-[var(--portal-gold-accent)]/30 bg-[var(--portal-gold-accent)]/[0.08] px-4 py-1.5 text-xs font-semibold text-[var(--portal-gold-accent)]"
              style={subheading}
            >
              {requirementSummary(policy)}
            </p>
          </div>

          <div className="mt-10 sm:mt-12">
            {loading ? (
              <div className="flex flex-col items-center py-16">
                <div className="h-8 w-8 animate-spin rounded-full border-2 border-white/20 border-t-white" />
              </div>
            ) : rushEvents.length === 0 ? (
              <p className="py-16 text-center text-on-inverse/50">
                No events scheduled at this time. Check back soon!
              </p>
            ) : (
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {rushEvents.map((event) => (
                  <article
                    key={event.id}
                    className="overflow-hidden rounded-[8px] border border-white/10 bg-white/[0.03] transition-colors hover:border-white/20"
                  >
                    <div
                      className="h-1 w-full"
                      style={{
                        background:
                          event.type === 'Professional'
                            ? 'linear-gradient(90deg, var(--portal-blue-light), color-mix(in oklch, var(--portal-blue-light) 40%, white))'
                            : 'linear-gradient(90deg, var(--portal-gold-accent), color-mix(in oklch, var(--portal-gold-accent) 40%, white))',
                      }}
                    />

                    <div className="p-6">
                      <div className="flex items-start justify-between gap-3">
                        <h3 className="text-lg font-semibold leading-snug">{event.title}</h3>
                        <span className="shrink-0 rounded-[8px] border border-white/20 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider text-on-inverse/60">
                          {event.type}
                        </span>
                      </div>

                      <dl className="mt-5 divide-y divide-white/10 border-y border-white/10 text-sm">
                        <div className="flex justify-between gap-4 py-2.5">
                          <dt className="text-on-inverse/45">Date</dt>
                          <dd className="text-right text-on-inverse/85">{formatDateInEST(event.date)}</dd>
                        </div>
                        <div className="flex justify-between gap-4 py-2.5">
                          <dt className="text-on-inverse/45">Time</dt>
                          <dd className="text-right text-on-inverse/85">{event.time || 'TBA'}</dd>
                        </div>
                        <div className="flex justify-between gap-4 py-2.5">
                          <dt className="text-on-inverse/45">Location</dt>
                          <dd className="text-right text-on-inverse/85">{event.location || 'TBA'}</dd>
                        </div>
                      </dl>

                      {event.description && (
                        <p className="mt-4 text-sm leading-relaxed text-on-inverse/50">{event.description}</p>
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
      <section className="bg-inverse-soft py-16 sm:py-20">
        <div className="mx-auto max-w-3xl px-5">
          <h2 className="text-center text-3xl sm:text-4xl">Frequently Asked Questions</h2>

          <div className="mt-8 divide-y divide-white/10 border-y border-white/10 sm:mt-10">
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
                    <span className="shrink-0 text-xl font-light text-on-inverse/50" aria-hidden="true">
                      {open ? '−' : '+'}
                    </span>
                  </button>
                  {open && <p className="pb-6 text-sm leading-relaxed text-on-inverse/55">{faq.answer}</p>}
                </div>
              )
            })}
          </div>
        </div>
      </section>

      {/* Closing call to action (§6.1.1 §8) */}
      <section className="relative overflow-hidden bg-inverse py-20 sm:py-24">
        <StarField />

        <div className="relative mx-auto max-w-2xl px-5 text-center">
          <h2 className="text-3xl sm:text-5xl leading-tight">Launch yourself to the moon.</h2>
          <p className="mx-auto mt-5 max-w-lg text-on-inverse/60">
            Every brother started exactly where you are now. Come to an event, meet the chapter, and see where it
            goes.
          </p>

          <div className="mt-8 flex justify-center">
            <Link
              href="/auth/signup"
              className="w-full sm:w-auto rounded-[8px] border border-[var(--portal-gold-accent)] bg-transparent px-10 py-2.5 text-sm font-semibold text-[var(--portal-gold-accent)] hover:bg-[var(--portal-gold-accent)]/10 transition-colors"
            >
              Sign Up
            </Link>
          </div>
        </div>
      </section>

      {/* Footer (§6.1.1 §9) */}
      <footer className="relative overflow-hidden border-t border-white/10 bg-inverse-soft py-10 sm:py-12">
        <div className="relative mx-auto flex max-w-6xl flex-col items-center gap-3 px-5 text-center">
          <span className="lettermark text-on-inverse text-2xl font-bold tracking-[0.08em]">ΑΚΨ</span>
          <p className="text-sm text-on-inverse/50">Alpha Kappa Psi &middot; Alpha Phi Chapter &middot; University of Florida</p>
          <a
            href={CYCLE.instagramUrl}
            target="_blank"
            rel="noopener noreferrer"
            aria-label={`${CYCLE.instagramHandle} on Instagram`}
            className="text-[var(--portal-gold-accent)] hover:brightness-110 transition-[filter]"
          >
            <InstagramIcon />
          </a>
          <p className="text-xs text-on-inverse/30">
            &copy; {new Date().getFullYear()} Alpha Kappa Psi, Alpha Phi Chapter. All rights reserved.
          </p>
        </div>
      </footer>
    </div>
  )
}

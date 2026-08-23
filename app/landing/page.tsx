'use client'

import Link from 'next/link'
import Image from 'next/image'
import { useState, useEffect, useRef } from 'react'
import { motion, useScroll, useTransform, useReducedMotion } from 'framer-motion'
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
  name: 'AKΨ Fall Rush',
  subheading: 'Find your orbit',
  groupMeUrl: 'https://groupme.com/join_group/116593082/z1Vs4Ej3',
  processHeading: 'Liftoff in…',
  instagramUrl: 'https://www.instagram.com/ufakpsi/',
  instagramHandle: '@ufakpsi',
  linkedinUrl: 'https://www.linkedin.com/company/uf-alpha-kappa-psi-alpha-phi-chapter/posts/?feedView=all',
  linkedinHandle: '@ufakpsi',
}

const HERO_DESKTOP = '/rush-hero-desktop.jpg'
const HERO_MOBILE = '/rush-hero-mobile.jpg'

const subheading = { fontFamily: '"Times New Roman", Times, Georgia, serif', fontStyle: 'normal' as const }
const display = { fontFamily: 'var(--font-portal-display)', fontStyle: 'italic' as const }

/** Shared "gold rounded" treatment — every Sign Up / Follow Along box uses this exact pill, text only differs. */
const GOLD_PILL =
  'inline-flex w-fit items-center gap-2 rounded-[8px] border border-[var(--portal-gold-accent)] bg-transparent px-6 py-2.5 text-[var(--portal-gold-accent)] hover:bg-[var(--portal-gold-accent)]/10 transition-colors'
const GOLD_PILL_LABEL = 'text-[13px] font-semibold tracking-wide'

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

const GALAXY_STARS_FAR = [
  [6, 4, 1, 0.35], [18, 6, 1.4, 0.5], [31, 9, 1, 0.3], [44, 3, 1.6, 0.55],
  [57, 11, 1, 0.35], [69, 5, 1.3, 0.45], [78, 8, 1, 0.3], [88, 6, 1.5, 0.5],
  [12, 16, 1, 0.3], [37, 18, 1.2, 0.4], [63, 15, 1, 0.35], [92, 17, 1.3, 0.45],
  [8, 26, 1.2, 0.4], [24, 30, 1, 0.35], [46, 27, 1.4, 0.5], [70, 32, 1, 0.3],
  [15, 40, 1.3, 0.45], [40, 44, 1, 0.35], [60, 41, 1.5, 0.55], [85, 45, 1, 0.3],
  [5, 55, 1.2, 0.4], [30, 58, 1, 0.35], [55, 54, 1.4, 0.5], [80, 59, 1, 0.3],
  [20, 68, 1.3, 0.45], [45, 70, 1, 0.35], [68, 66, 1.5, 0.5], [92, 71, 1, 0.3],
  [10, 80, 1.2, 0.4], [35, 82, 1, 0.35], [58, 79, 1.4, 0.5], [82, 83, 1, 0.3],
  [15, 92, 1.3, 0.45], [42, 94, 1, 0.35], [65, 90, 1.5, 0.5], [88, 95, 1, 0.3],
  [1, 12, 1, 0.3], [25, 2, 1.3, 0.4], [51, 7, 1, 0.35], [74, 1, 1.4, 0.45],
  [96, 10, 1, 0.3], [3, 21, 1.2, 0.35], [29, 23, 1, 0.3], [50, 19, 1.5, 0.5],
  [75, 22, 1, 0.3], [98, 25, 1.2, 0.4], [2, 35, 1, 0.35], [22, 37, 1.4, 0.45],
  [52, 33, 1, 0.3], [77, 38, 1.3, 0.4], [96, 41, 1, 0.35], [4, 48, 1.2, 0.4],
  [27, 51, 1, 0.3], [48, 46, 1.4, 0.45], [72, 49, 1, 0.3], [95, 53, 1.3, 0.4],
  [7, 62, 1, 0.35], [26, 65, 1.2, 0.4], [51, 61, 1, 0.3], [76, 63, 1.4, 0.45],
  [97, 67, 1, 0.3], [2, 75, 1.2, 0.35], [24, 73, 1, 0.3], [49, 77, 1.5, 0.5],
  [73, 74, 1, 0.3], [96, 78, 1.2, 0.4], [4, 88, 1, 0.35], [27, 86, 1.3, 0.4],
  [51, 89, 1, 0.3], [75, 85, 1.4, 0.45], [98, 91, 1, 0.3], [12, 97, 1.2, 0.4],
] as const

const GALAXY_STARS_NEAR = [
  [10, 8, 1.8, 0.7], [26, 4, 2.2, 0.85], [41, 10, 1.6, 0.6], [55, 5, 2, 0.9],
  [72, 9, 1.8, 0.65], [84, 3, 2.4, 0.8], [20, 14, 1.6, 0.55], [48, 16, 2, 0.75],
  [66, 13, 1.8, 0.6], [90, 15, 2.2, 0.85], [6, 22, 2, 0.7], [33, 24, 1.6, 0.6],
  [58, 20, 2.2, 0.8], [78, 25, 1.8, 0.65], [95, 21, 2, 0.75], [14, 34, 1.8, 0.6],
  [38, 36, 2.4, 0.85], [62, 33, 1.6, 0.55], [86, 37, 2, 0.75], [10, 48, 2, 0.7],
  [30, 50, 1.8, 0.6], [52, 47, 2.2, 0.8], [74, 51, 1.6, 0.6], [92, 49, 2, 0.75],
  [18, 62, 1.8, 0.65], [42, 64, 2.2, 0.8], [64, 61, 1.6, 0.55], [88, 65, 2, 0.7],
  [8, 76, 2, 0.7], [28, 78, 1.8, 0.6], [50, 75, 2.4, 0.85], [72, 79, 1.6, 0.6],
  [94, 77, 2, 0.75], [16, 90, 1.8, 0.65], [40, 92, 2.2, 0.8], [62, 89, 1.6, 0.55],
  [1, 3, 1.8, 0.6], [17, 1, 2, 0.7], [35, 6, 1.6, 0.55], [63, 2, 2.2, 0.75],
  [80, 7, 1.8, 0.65], [98, 4, 2, 0.7], [3, 17, 1.6, 0.55], [22, 19, 2, 0.7],
  [46, 21, 1.8, 0.6], [70, 18, 2.2, 0.75], [92, 23, 1.6, 0.6], [1, 30, 2, 0.7],
  [25, 28, 1.8, 0.65], [50, 31, 2.2, 0.8], [76, 29, 1.6, 0.55], [97, 33, 2, 0.7],
  [4, 42, 1.8, 0.6], [23, 45, 2, 0.7], [47, 41, 2.2, 0.75], [71, 44, 1.6, 0.6],
  [96, 46, 2, 0.7], [2, 56, 1.8, 0.65], [21, 58, 2.2, 0.8], [45, 55, 1.6, 0.55],
  [69, 57, 2, 0.7], [93, 59, 1.8, 0.65], [5, 68, 2, 0.7], [24, 70, 1.6, 0.6],
  [48, 67, 2.2, 0.75], [70, 71, 1.8, 0.65], [95, 69, 2, 0.7], [3, 82, 1.8, 0.6],
  [20, 84, 2.2, 0.8], [44, 81, 1.6, 0.55], [68, 83, 2, 0.7], [90, 87, 1.8, 0.65],
] as const

/**
 * Scroll-cue label, fixed to the viewport (so it's visible immediately on
 * load regardless of the hero's total height) — fades out once the user has
 * scrolled roughly past the first screen, since it'd otherwise stay pinned
 * on-screen through the whole extended hero and into the sections below.
 */
function ScrollCue() {
  const [opacity, setOpacity] = useState(1)

  useEffect(() => {
    const onScroll = () => setOpacity(Math.max(0, 1 - window.scrollY / (window.innerHeight * 0.5)))
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  return (
    <div
      aria-hidden="true"
      className="fixed inset-x-0 bottom-6 z-40 mx-auto flex w-full max-w-6xl justify-center px-6 transition-opacity duration-150"
      style={{ opacity }}
    >
      <span
        className="flex flex-row items-center gap-2 text-[13px] tracking-wide text-on-inverse/40 animate-[gentle-bounce_2.2s_ease-in-out_infinite]"
        style={subheading}
      >
        Scroll
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <path d="M12 4v16m0 0l-6-6m6 6l6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </span>
    </div>
  )
}

/**
 * Two-tier scroll-reactive star field, hero-scoped only — separate from
 * StarField (untouched, still used in Process/Closing CTA). Owns its own
 * ref + useScroll target so rotation tracks progress across the hero's own
 * height, not the whole document.
 */
function GalaxyStars() {
  const containerRef = useRef<HTMLDivElement>(null)
  const reduceMotion = useReducedMotion()
  const { scrollYProgress } = useScroll({
    target: containerRef,
    offset: ['start start', 'end start'],
  })

  const farRotate = useTransform(scrollYProgress, [0, 1], [0, 18])
  const nearRotate = useTransform(scrollYProgress, [0, 1], [0, 36])

  return (
    <div ref={containerRef} className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden="true">
      <motion.div
        className="absolute inset-0"
        style={{ rotate: reduceMotion ? 0 : farRotate, willChange: 'transform' }}
      >
        {GALAXY_STARS_FAR.map(([left, top, size, opacity], i) => (
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
              animationDuration: `${5 + (i % 5)}s`,
            }}
          />
        ))}
      </motion.div>

      <motion.div
        className="absolute inset-0"
        style={{ rotate: reduceMotion ? 0 : nearRotate, willChange: 'transform' }}
      >
        {GALAXY_STARS_NEAR.map(([left, top, size, opacity], i) => (
          <span
            key={i}
            className="absolute rounded-full bg-white animate-twinkle"
            style={{
              left: `${left}%`,
              top: `${top}%`,
              width: `${size}px`,
              height: `${size}px`,
              opacity,
              animationDelay: `${(i % 9) * 0.4}s`,
              animationDuration: `${4 + (i % 5)}s`,
            }}
          />
        ))}
      </motion.div>
    </div>
  )
}

/**
 * The 3/2/1 process cards. Each number brightens once a LATER milestone has
 * fully scrolled into view, not its own card: "3" brightens when card 2 is
 * fully in view, "2" brightens when card 3 is fully in view, and "1"
 * brightens once the end of the whole panel (past the rocket) is fully in
 * view. Each of the three trackers uses offset ['start end', 'end end'] —
 * progress 0 as the target first appears at the bottom of the viewport,
 * progress 1 exactly when its bottom edge reaches the viewport's bottom
 * edge (i.e. the moment it's "fully rendered in") — so opacity ramps to
 * full brightness right at that trigger and stays there (useTransform
 * clamps past 1).
 */
function ProcessCards() {
  const card2Ref = useRef<HTMLDivElement>(null)
  const card3Ref = useRef<HTMLDivElement>(null)
  const endRef = useRef<HTMLDivElement>(null)

  const { scrollYProgress: card2Progress } = useScroll({ target: card2Ref, offset: ['start end', 'end end'] })
  const { scrollYProgress: card3Progress } = useScroll({ target: card3Ref, offset: ['start end', 'end end'] })
  const { scrollYProgress: endProgress } = useScroll({ target: endRef, offset: ['start end', 'end end'] })

  const opacities = [
    useTransform(card2Progress, [0, 1], [0.25, 0.95]), // "3" — flashes when card 2 is fully in
    useTransform(card3Progress, [0, 1], [0.25, 0.95]), // "2" — flashes when card 3 is fully in
    useTransform(endProgress, [0, 1], [0.25, 0.95]), // "1" — flashes when the panel's end is fully in
  ]
  const cardRefs = [undefined, card2Ref, card3Ref]

  return (
    <>
      <div className="mt-10 grid gap-4 sm:mt-12 sm:grid-cols-3 sm:gap-5">
        {PROCESS.map((item, i) => (
          <div
            key={item.step}
            ref={cardRefs[i]}
            className="relative border border-white/10 bg-white/[0.03] p-6 sm:p-7 transition-colors hover:border-white/20"
          >
            <h3 className="text-lg font-semibold">{item.title}</h3>
            <p className="mt-1 text-sm font-medium text-on-inverse/70">{item.subtitle}</p>
            <p className="mt-3 text-sm leading-relaxed text-on-inverse/50">{item.detail}</p>

            <motion.span
              className="pointer-events-none absolute right-5 top-4 text-5xl text-[var(--portal-gold-accent)]"
              style={{ ...display, opacity: opacities[i] }}
              aria-hidden="true"
            >
              {3 - i}
            </motion.span>
          </div>
        ))}
      </div>

      <div ref={endRef} className="mt-10 flex justify-center sm:mt-12">
        <RocketIcon />
      </div>
    </>
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

/** Simple line-art LinkedIn glyph. */
function LinkedInIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <rect x="3" y="3" width="18" height="18" rx="5" stroke="currentColor" strokeWidth="1.4" />
      <line x1="7.5" y1="10" x2="7.5" y2="16.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
      <circle cx="7.5" cy="7.3" r="1" fill="currentColor" />
      <path d="M11.5 16.5v-4c0-1.4 1-2.5 2.4-2.5s2.1 1 2.1 2.5v4" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

/** Small arrow, used after "Sign Up" inside the gold pill buttons. */
function ArrowIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M5 12h14m0 0l-6-6m6 6l-6 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
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
  const [navOpacity, setNavOpacity] = useState(0)

  useEffect(() => {
    loadPolicy().then(setPolicy)
  }, [])

  useEffect(() => {
    // Fades in as soon as scrolling starts, fully opaque by roughly where the
    // headline sits (headline is vertically centered in the hero).
    const onScroll = () => {
      const fadeDistance = window.innerHeight * 0.4
      setNavOpacity(Math.min(1, Math.max(0, window.scrollY / fadeDistance)))
    }
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
      {/* Sticky navigation (§6.1.1 §2) — clear over the hero photo, fades in its background as soon as the page scrolls */}
      <nav className="fixed inset-x-0 top-0 z-50">
        <div
          aria-hidden="true"
          className="absolute inset-0 border-b border-white/10 bg-inverse-soft/85 backdrop-blur-md transition-opacity duration-150 ease-out"
          style={{ opacity: navOpacity }}
        />
        <div className="relative mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-3 sm:px-5 sm:py-3.5">
          <Link href="/" className="flex items-center gap-2 sm:gap-3 min-w-0">
            <span className="lettermark text-on-inverse text-lg sm:text-xl font-bold tracking-[0.08em]">
              ΑΚ<span className="text-[var(--portal-gold-accent)]">Ψ</span>
            </span>
            <span className="hidden sm:block whitespace-nowrap text-[11px] leading-tight text-on-inverse/55">
              Alpha Phi Chapter &ndash; University of Florida
            </span>
          </Link>

          <div className="flex items-center gap-2 sm:gap-2.5">
            <a href={CYCLE.instagramUrl} target="_blank" rel="noopener noreferrer" aria-label="Instagram" className="text-[var(--portal-gold-accent)]/80 hover:text-[var(--portal-gold-accent)] transition-colors">
              <InstagramIcon />
            </a>
            <a href={CYCLE.linkedinUrl} target="_blank" rel="noopener noreferrer" aria-label="LinkedIn" className="text-[var(--portal-gold-accent)]/80 hover:text-[var(--portal-gold-accent)] transition-colors">
              <LinkedInIcon />
            </a>
            <Link
              href="/auth/signin"
              className="ml-1 rounded-[8px] border border-[var(--portal-gold-accent)] px-3 py-2 sm:px-4 text-xs sm:text-sm font-semibold hover:bg-white hover:text-[var(--portal-navy-dark)] transition-colors"
            >
              Sign In
            </Link>
          </div>
        </div>
      </nav>

      {/* Hero (§6.1.1 §3) — nebula photo carried over from the cycle's design reference, kept structurally intact.
          Extended well past 100svh so the nebula/star rotation has real scroll distance to play out; the photo
          itself stays confined to the first screen (stretching it across the extra height would distort it) and
          the extended zone below is flat navy carrying just the nebula cloud + stars. */}
      <header
        id="top"
        className="relative w-full overflow-hidden bg-[var(--portal-navy-dark)]"
        style={{ minHeight: '100svh' }}
      >
        <style>{`
          @keyframes gentle-bounce {
            0%, 100% { transform: translateY(0); }
            50% { transform: translateY(-5px); }
          }
        `}</style>

        <div className="absolute inset-x-0 top-0 h-[100svh]">
          <Image
            src={HERO_MOBILE}
            alt="A deep navy nebula scattered with starlight above the curve of a distant planet"
            fill
            priority
            sizes="(min-width: 768px) 0px, 100vw"
            className="object-cover object-[center_20%] md:hidden"
          />
          <Image
            src={HERO_DESKTOP}
            alt="A deep navy nebula scattered with starlight above the curve of a distant planet"
            fill
            priority
            sizes="(min-width: 768px) 100vw, 0px"
            className="hidden object-cover object-[center_20%] md:block"
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
        </div>

        <GalaxyStars />

        <div className="relative mx-auto w-full max-w-4xl px-5 sm:px-6 text-center" style={{ marginTop: 'min(50vh, calc(100svh - 380px))' }}>
          <div aria-hidden="true" className="mx-auto mb-6 h-px w-16 bg-[var(--portal-gold-accent)]" />

          <h1 className="text-[clamp(3rem,13vw,7rem)] leading-[0.98] text-on-inverse">
            {CYCLE.name}
          </h1>

          <p className="mx-auto mt-4 max-w-sm text-base text-on-inverse/70 sm:text-lg">{CYCLE.subheading}</p>

          <div className="mt-10 flex flex-col items-center gap-3">
            <Link href="/auth/signup" className={GOLD_PILL}>
              <span className={GOLD_PILL_LABEL}>Sign Up</span>
              <ArrowIcon />
            </Link>
            <p className="text-sm text-on-inverse/50">
              Already have an account?{' '}
              <Link href="/auth/signin" className="text-on-inverse/85 underline underline-offset-4 hover:text-on-inverse">
                Sign in.
              </Link>
            </p>
          </div>
        </div>

        <ScrollCue />
      </header>

      {/* Announcement banner (§6.1.1 §1) — normal document flow, between the hero and the process section */}
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

      {/* Process explainer (§6.1.1 §4) */}
      <section className="relative bg-inverse py-16 sm:py-20">
        <StarField />
        <div className="relative mx-auto max-w-6xl px-5">
          <h2 className="text-center text-3xl sm:text-4xl">{CYCLE.processHeading}</h2>

          <ProcessCards />
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

          <div className="mt-6 flex justify-center">
            <a href={CYCLE.instagramUrl} target="_blank" rel="noopener noreferrer" className={GOLD_PILL}>
              <span className={GOLD_PILL_LABEL}>Follow Along</span>
              <InstagramIcon />
            </a>
          </div>
        </div>
      </section>

      {/* Rush events (§6.1.1 §6) */}
      <section id="events" className="scroll-mt-24 bg-inverse py-16 sm:py-20">
        <div className="mx-auto max-w-6xl px-5">
          <div className="text-center">
            <h2 className="text-3xl sm:text-4xl">Rush Events</h2>
            <p
              className="mt-4 inline-flex rounded-[8px] border border-[var(--portal-gold-accent)]/30 bg-[var(--portal-gold-accent)]/[0.08] px-4 py-1.5 text-sm font-semibold tracking-wide text-[var(--portal-gold-accent)]"
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

          <div className="mt-10 flex justify-center sm:mt-12">
            <a href={CYCLE.groupMeUrl} target="_blank" rel="noopener noreferrer" className={GOLD_PILL}>
              <span className={GOLD_PILL_LABEL}>Join the GroupMe for event updates</span>
              <ArrowIcon />
            </a>
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
            <Link href="/auth/signup" className={GOLD_PILL}>
              <span className={GOLD_PILL_LABEL}>Sign Up</span>
              <ArrowIcon />
            </Link>
          </div>
        </div>
      </section>

      {/* Footer (§6.1.1 §9) */}
      <footer className="relative overflow-hidden border-t border-white/10 bg-inverse-soft py-10 sm:py-12">
        <div className="relative mx-auto flex max-w-6xl flex-col items-center gap-3 px-5 text-center">
          <span className="lettermark text-on-inverse text-2xl font-bold tracking-[0.08em]">ΑΚΨ</span>
          <p className="text-sm text-on-inverse/50">Alpha Kappa Psi &middot; Alpha Phi Chapter &middot; University of Florida</p>
          <div className="flex items-center gap-5">
            <a
              href={CYCLE.instagramUrl}
              target="_blank"
              rel="noopener noreferrer"
              aria-label={`${CYCLE.instagramHandle} on Instagram`}
              className="text-[var(--portal-gold-accent)] hover:brightness-110 transition-[filter]"
            >
              <InstagramIcon />
            </a>
            <a
              href={CYCLE.linkedinUrl}
              target="_blank"
              rel="noopener noreferrer"
              aria-label="LinkedIn"
              className="text-[var(--portal-gold-accent)] hover:brightness-110 transition-[filter]"
            >
              <LinkedInIcon />
            </a>
          </div>
          <p className="text-xs text-on-inverse/30">
            &copy; {new Date().getFullYear()} Alpha Kappa Psi, Alpha Phi Chapter. All rights reserved.
          </p>
        </div>
      </footer>
    </div>
  )
}

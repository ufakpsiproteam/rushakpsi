'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { motion } from 'framer-motion'
import { useAuth } from '@/contexts/AuthContext'

/**
 * Rushee navigation — PRD §6.3.1.
 *
 * Desktop: top bar with the lettermark and "Recruitment Portal", tabs for
 * Dashboard · Events · Application · Info · Status, an account icon and
 * Sign Out.
 *
 * Mobile: a floating bottom tab bar with SIX tabs —
 * Dashboard · Events · Application · Status · Info · Account, mirroring
 * the desktop tab set. Status is one of the most-visited pages during
 * decision windows and must be reachable in one tap. It previously had
 * three tabs and neither Status nor Info was among them, leaving both
 * unreachable on a phone.
 */

interface NavItem {
  href: string
  label: string
  icon: React.ReactNode
}

const ICON = {
  dashboard: (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.6} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
    </svg>
  ),
  events: (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.6} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
    </svg>
  ),
  status: (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.6} d="M3 8l9 6 9-6M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
    </svg>
  ),
  info: (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.6} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  ),
  application: (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.6} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
    </svg>
  ),
  account: (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.6} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
    </svg>
  ),
}

const DESKTOP_TABS: NavItem[] = [
  { href: '/rushee/dashboard', label: 'Dashboard', icon: ICON.dashboard },
  { href: '/rushee/events', label: 'Events', icon: ICON.events },
  { href: '/rushee/application', label: 'Application', icon: ICON.application },
  { href: '/rushee/info', label: 'Info', icon: ICON.info },
  { href: '/rushee/status', label: 'Status', icon: ICON.status },
]

const MOBILE_TABS: NavItem[] = [
  { href: '/rushee/dashboard', label: 'Home', icon: ICON.dashboard },
  { href: '/rushee/events', label: 'Events', icon: ICON.events },
  { href: '/rushee/application', label: 'Application', icon: ICON.application },
  { href: '/rushee/status', label: 'Status', icon: ICON.status },
  { href: '/rushee/info', label: 'Info', icon: ICON.info },
  { href: '/rushee/account', label: 'Account', icon: ICON.account },
]

export default function RusheeNav() {
  const pathname = usePathname()
  const { signOut } = useAuth()

  /**
   * PRD §6.3.1 — "Sign-out completes within a bounded time and always
   * lands the user on the sign-in page, even if the network call is slow."
   */
  const handleSignOut = async () => {
    try {
      await Promise.race([signOut(), new Promise((resolve) => setTimeout(resolve, 2000))])
    } catch {
      // Falling through to the redirect is the correct behaviour here.
    } finally {
      window.location.href = '/auth/signin'
    }
  }

  return (
    <>
      <nav className="hidden lg:block nav-bar">
        <div className="app-container">
          <div className="flex items-center justify-between h-16 gap-6">
            <Link href="/rushee/dashboard" className="flex items-baseline gap-2.5 shrink-0">
              <span className="lettermark text-xl">ΑΚΨ</span>
              <span className="text-sm font-medium text-ink-muted">Recruitment Portal</span>
            </Link>

            <div className="flex items-center gap-1">
              {DESKTOP_TABS.map((tab) => {
                const active = pathname === tab.href
                return (
                  <Link
                    key={tab.href}
                    href={tab.href}
                    aria-current={active ? 'page' : undefined}
                    className={`nav-tab ${active ? 'nav-tab-active' : ''}`}
                  >
                    {tab.label}
                    {active && (
                      <motion.span
                        layoutId="portal-nav-underline"
                        className="portal-nav-underline"
                        transition={{ type: 'spring', stiffness: 380, damping: 32 }}
                      />
                    )}
                  </Link>
                )
              })}
            </div>

            <div className="flex items-center gap-1 shrink-0">
              <Link
                href="/rushee/account"
                aria-label="Account"
                className={`nav-tab ${pathname === '/rushee/account' ? 'nav-tab-active' : ''}`}
              >
                {ICON.account}
              </Link>
              <button onClick={handleSignOut} className="btn btn-ghost btn-sm">
                Sign Out
              </button>
            </div>
          </div>
        </div>
      </nav>

      {/* Mobile: five tabs, safe-area aware (PRD §6.3.1, §11.2) */}
      <nav
        className="lg:hidden bottom-tabs"
        style={{ gridTemplateColumns: `repeat(${MOBILE_TABS.length}, minmax(0, 1fr))` }}
        aria-label="Primary"
      >
        {MOBILE_TABS.map((tab) => {
          const isActive = pathname === tab.href
          return (
            <Link
              key={tab.href}
              href={tab.href}
              aria-current={isActive ? 'page' : undefined}
              className={`bottom-tab ${isActive ? 'bottom-tab-active' : ''}`}
            >
              {tab.icon}
              <span>{tab.label}</span>
            </Link>
          )
        })}
      </nav>

      {/* Keeps page content clear of the floating tab bar. */}
      <div className="lg:hidden h-24" aria-hidden="true" />
    </>
  )
}

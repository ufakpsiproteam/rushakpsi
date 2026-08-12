'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useAuth } from '@/contexts/AuthContext'

/**
 * Admin navigation — PRD §6.7.
 *
 * Corrections from the previous version:
 *  · /admin/bid-night was linked but does not exist, so the tab 404'd.
 *    The bid-night deck lives at /admin/slides; the voting session UI is
 *    not built yet, so there is no tab for it.
 *  · /admin/brothers, /admin/slides and the pledge directory all existed
 *    as real pages with no nav entry at all — reachable only by typing
 *    the URL.
 */
const NAV_ITEMS = [
  { href: '/admin/dashboard', label: 'Dashboard' },
  { href: '/admin/events', label: 'Events' },
  { href: '/admin/attendance', label: 'Attendance' },
  { href: '/admin/cuts', label: 'Review Board' },
  { href: '/admin/standing', label: 'Standings' },
  { href: '/brother/interviews', label: 'Interviews' },
  { href: '/admin/interview-questions', label: 'Interview Questions' },
  { href: '/admin/slides', label: 'Bid Night Deck' },
  { href: '/admin/brothers', label: 'Brothers' },
  { href: '/admin/brother-insights', label: 'Participation' },
  { href: '/admin/pledges', label: 'Pledges' },
]

export default function AdminNav() {
  const pathname = usePathname()
  const { signOut } = useAuth()

  const handleSignOut = async () => {
    try {
      await Promise.race([signOut(), new Promise((resolve) => setTimeout(resolve, 2000))])
    } catch {
      // Redirect regardless — sign-out must always land on sign-in.
    } finally {
      window.location.href = '/auth/signin'
    }
  }

  return (
    <nav className="nav-bar">
      <div className="app-container">
        <div className="flex h-16 items-center justify-between gap-6">
          <Link href="/admin/dashboard" className="flex items-baseline gap-2.5 shrink-0">
            <span className="lettermark text-xl">ΑΚΨ</span>
            <span className="hidden sm:block text-sm font-medium text-ink-muted">Admin Portal</span>
          </Link>

          <div className="hidden xl:flex items-center gap-0.5 overflow-x-auto">
            {NAV_ITEMS.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                aria-current={pathname === item.href ? 'page' : undefined}
                className={`nav-tab ${pathname === item.href ? 'nav-tab-active' : ''}`}
              >
                {item.label}
              </Link>
            ))}
          </div>

          <button onClick={handleSignOut} className="btn btn-ghost btn-sm shrink-0">
            Sign Out
          </button>
        </div>

        <div className="xl:hidden flex gap-1 overflow-x-auto pb-3 -mx-1 px-1">
          {NAV_ITEMS.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              aria-current={pathname === item.href ? 'page' : undefined}
              className={`nav-tab shrink-0 ${pathname === item.href ? 'nav-tab-active' : ''}`}
            >
              {item.label}
            </Link>
          ))}
        </div>
      </div>
    </nav>
  )
}

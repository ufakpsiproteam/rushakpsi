'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { motion } from 'framer-motion'
import { useAuth } from '@/contexts/AuthContext'
import RoleSwitcher from './RoleSwitcher'

interface BrotherNavProps {
  onBeforeNavigate?: () => boolean // Return true to allow navigation, false to prevent
}

export default function BrotherNav({ onBeforeNavigate }: BrotherNavProps = {}) {
  const pathname = usePathname()
  const router = useRouter()
  const { signOut } = useAuth()

  const handleNavClick = (e: React.MouseEvent<HTMLAnchorElement>, href: string) => {
    if (onBeforeNavigate && !onBeforeNavigate()) {
      e.preventDefault()
      return
    }
    // Allow normal navigation
  }

  const navItems = [
    {
      href: '/brother/dashboard',
      label: 'Dashboard',
      icon: (
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
        </svg>
      ),
    },
    {
      href: '/brother/events',
      label: 'Events',
      icon: (
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
        </svg>
      ),
    },
    {
      href: '/brother/rushees',
      label: 'Rushees',
      icon: (
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5h6m-6 4h6m-6 4h6m-9 5h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v10a2 2 0 002 2z" />
        </svg>
      ),
    },
    {
      href: '/brother/interviews',
      label: 'Interviews',
      icon: (
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-4 4v-4z" />
        </svg>
      ),
    },
  ]

  const mobileNavItems = [
    navItems[0], // dashboard
    navItems[1], // events
    navItems[3], // interviews
    {
      href: '/brother/account',
      label: 'Profile',
      icon: (
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
        </svg>
      ),
    },
  ]

  const handleSignOut = async () => {
    try {
      await Promise.race([
        signOut(),
        new Promise((resolve) => setTimeout(resolve, 2000)),
      ])
    } catch (error) {
      console.error('Error signing out:', error)
    } finally {
      window.location.href = '/auth/signin'
    }
  }

  return (
    <>
      {/* Desktop/Tablet Top Navigation - Hidden on mobile */}
      <nav className="hidden lg:block nav-bar">
        <div className="app-container">
          <div className="flex justify-between items-center h-16">
            <Link href="/brother/dashboard" className="flex items-baseline gap-2.5">
              <span className="lettermark text-xl">ΑΚΨ</span>
              <span className="text-sm font-medium text-ink-muted hidden sm:block">Brother Portal</span>
            </Link>

            <div className="hidden lg:flex items-center gap-1">
              {navItems.map((item) => {
                const active = pathname === item.href
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={(e) => handleNavClick(e, item.href)}
                    aria-current={active ? 'page' : undefined}
                    className={`nav-tab ${active ? 'nav-tab-active' : ''}`}
                  >
                    {item.label}
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

            <div className="flex items-center gap-2">
              <RoleSwitcher />
              <Link
                href="/brother/account"
                onClick={(e) => handleNavClick(e, '/brother/account')}
                aria-current={pathname === '/brother/account' ? 'page' : undefined}
                className={`nav-tab ${pathname === '/brother/account' ? 'nav-tab-active' : ''}`}
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                </svg>
              </Link>
              <button onClick={handleSignOut} className="btn btn-ghost btn-sm">
                Sign Out
              </button>
            </div>
          </div>
        </div>
      </nav>

      {/* Mobile Bottom Tab Bar */}
      <div className="lg:hidden fixed bottom-4 left-0 right-0 z-50">
        <div
          className="mx-auto w-fit rounded-full bg-[var(--color-inverse)]/90 px-10 py-3 shadow-[0_10px_30px_rgb(9_23_51_/_0.35)] backdrop-blur"
          style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
        >
          <div className="flex items-center gap-6 -translate-y-1">
            {mobileNavItems.map((item) => {
              const isActive = pathname === item.href
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={(e) => handleNavClick(e, item.href)}
                  className={`flex items-center justify-center w-10 h-10 rounded-full transition-all ${
                    isActive
                      ? 'bg-[var(--color-on-inverse)] text-[var(--color-inverse)]'
                      : 'text-[var(--color-on-inverse)]/60 hover:text-[var(--color-on-inverse)]'
                  }`}
                >
                  {item.icon}
                </Link>
              )
            })}
          </div>
        </div>
      </div>
    </>
  )
}

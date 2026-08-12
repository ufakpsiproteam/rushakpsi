'use client'

import { useState, useEffect, useRef } from 'react'
import Link from 'next/link'
import { useAuth } from '@/contexts/AuthContext'

/**
 * Elevated access menu — PRD §6.4.2.
 *
 * Renders only for brothers holding a role, with one entry per capability
 * granted. Two corrections: the Professional Chair had no entry at all,
 * so a brother holding only that role saw no elevated control anywhere in
 * the portal; and the Professional Team entry reused the Director's
 * description verbatim instead of its own.
 */

interface MenuEntry {
  key: string
  label: string
  description: string
  href: string
}

export default function RoleSwitcher() {
  const { roles, profile } = useAuth()
  const [showMenu, setShowMenu] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)

  const isAdmin = profile?.access_level === 'admin'
  const hasRecruitmentAccess =
    profile?.account_type === 'brother' && (profile.access_level === 'recruitment' || isAdmin)

  const hasDirectorRole = roles.includes('recruitment_director') || hasRecruitmentAccess
  const hasProfessionalRole = roles.includes('professional_team')
  const hasProfessionalChair = roles.includes('professional_chair')

  const entries: MenuEntry[] = []

  if (hasDirectorRole) {
    entries.push({
      key: 'director',
      label: 'Directors of Recruitment',
      description: 'View cuts & evaluations',
      href: '/brother/cuts',
    })
  }

  if (hasDirectorRole || isAdmin) {
    entries.push({
      key: 'anonymous',
      label: 'Anonymous Applications',
      description: 'Review one application at a time',
      href: '/brother/anonymous-applications',
    })
  }

  if (hasProfessionalRole) {
    entries.push({
      key: 'professional',
      label: 'Professional Team',
      description: 'View cuts & enter interview scores',
      href: '/brother/cuts',
    })
  }

  if (hasProfessionalChair) {
    entries.push({
      key: 'chair',
      label: 'Interviews & Standings',
      description: 'Scores and rushee standings',
      href: '/admin/interviews',
    })
  }

  useEffect(() => {
    if (!showMenu) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setShowMenu(false)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [showMenu])

  if (entries.length === 0) return null

  return (
    <div className="relative" ref={containerRef}>
      <button
        onClick={() => setShowMenu((v) => !v)}
        aria-expanded={showMenu}
        aria-haspopup="menu"
        className="btn btn-secondary btn-sm"
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={1.7}
            d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"
          />
        </svg>
        Elevated Access
      </button>

      {showMenu && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setShowMenu(false)} aria-hidden="true" />

          <div
            role="menu"
            className="absolute right-0 z-50 mt-2 w-72 rounded-xl border border-line bg-surface p-1.5 shadow-[0_16px_40px_rgb(9_9_11_/_0.16)]"
          >
            <p className="px-2.5 py-2 text-[11px] font-semibold uppercase tracking-[0.12em] text-ink-subtle">
              Your Roles
            </p>

            {entries.map((entry) => (
              <Link
                key={entry.key}
                href={entry.href}
                role="menuitem"
                onClick={() => setShowMenu(false)}
                className="block rounded-lg px-2.5 py-2 hover:bg-surface-sunken transition-colors"
              >
                <span className="block text-sm font-semibold text-ink">{entry.label}</span>
                <span className="block text-xs text-ink-subtle mt-0.5">{entry.description}</span>
              </Link>
            ))}
          </div>
        </>
      )}
    </div>
  )
}

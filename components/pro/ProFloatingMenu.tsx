'use client'

import { useState } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { useRouter, usePathname } from 'next/navigation'

export default function ProFloatingMenu() {
  const { profile } = useAuth()
  const router = useRouter()
  const pathname = usePathname()
  const [isOpen, setIsOpen] = useState(false)

  // Only show for pro users
  if (profile?.access_level !== 'pro') {
    return null
  }

  const menuItems = [
    {
      label: 'Brother Insights',
      href: '/admin/brother-insights',
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
        </svg>
      ),
    },
    {
      label: 'Rushee Standings',
      href: '/admin/standing',
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
        </svg>
      ),
    },
  ]

  const handleNavigate = (href: string) => {
    router.push(href)
    setIsOpen(false)
  }

  return (
    <div className="fixed bottom-6 right-6 z-50">
      {/* Menu Items - show when expanded */}
      <div
        className={`flex flex-col gap-3 mb-3 transition-all duration-300 ${
          isOpen ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4 pointer-events-none'
        }`}
      >
        {menuItems.map((item) => {
          const isActive = pathname === item.href
          return (
            <button
              key={item.href}
              onClick={() => handleNavigate(item.href)}
              className={`flex items-center gap-3 px-4 py-3 rounded-full shadow-lg transition-all hover:scale-105 ${
                isActive
                  ? 'bg-ink text-white'
                  : 'bg-white text-ink-muted hover:bg-surface-alt border border-line'
              }`}
              title={item.label}
            >
              {item.icon}
              <span className="text-sm font-semibold whitespace-nowrap pr-2">{item.label}</span>
            </button>
          )
        })}
      </div>

      {/* Main FAB Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={`w-14 h-14 rounded-full shadow-lg flex items-center justify-center transition-all hover:scale-110 ${
          isOpen
            ? 'bg-ink text-white rotate-45'
            : 'bg-ink text-white'
        }`}
        aria-label="Pro menu"
      >
        <svg
          className="w-6 h-6"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M12 4v16m8-8H4"
          />
        </svg>
      </button>

      {/* Backdrop overlay when open */}
      {isOpen && (
        <div
          className="fixed inset-0 -z-10"
          onClick={() => setIsOpen(false)}
        />
      )}
    </div>
  )
}

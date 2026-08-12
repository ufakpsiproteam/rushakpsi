'use client'

import { useEffect, useRef } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import SplashScreen from '@/components/SplashScreen'
import { getDashboardRoute, ROUTES } from '@/lib/routes'

const MIN_SPLASH_DURATION = 800
const AUTH_TIMEOUT = 3000

export default function SplashPage() {
  const { user, profile, loading } = useAuth()
  const splashStartTime = useRef(Date.now())
  const hasRedirected = useRef(false)

  useEffect(() => {
    const hasShownSplash = sessionStorage.getItem('akpsi-splash-shown')

    if (hasShownSplash && !loading) {
      performRedirect()
      return
    }

    sessionStorage.setItem('akpsi-splash-shown', 'true')
  }, [loading])

  useEffect(() => {
    if (loading) return
    if (hasRedirected.current) return

    const elapsed = Date.now() - splashStartTime.current
    const remainingTime = Math.max(0, MIN_SPLASH_DURATION - elapsed)

    const timeout = setTimeout(() => {
      performRedirect()
    }, remainingTime)

    return () => clearTimeout(timeout)
  }, [loading, user, profile])

  useEffect(() => {
    const timeout = setTimeout(() => {
      if (!hasRedirected.current) {
        performRedirect()
      }
    }, AUTH_TIMEOUT)

    return () => clearTimeout(timeout)
  }, [])

  function performRedirect() {
    if (hasRedirected.current) return
    hasRedirected.current = true

    const targetRoute = user && profile
      ? getDashboardRoute(profile)
      : ROUTES.LANDING

    // Hard redirect to ensure middleware runs
    window.location.href = targetRoute
  }

  return <SplashScreen />
}

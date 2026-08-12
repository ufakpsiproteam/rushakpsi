'use client'

import { useEffect, useState } from 'react'
import { motion, useReducedMotion } from 'framer-motion'

/**
 * Ambient wave background for the AKΨ portal theme. Fixed behind all
 * content, never intercepts pointer events. Breathes gently while the
 * user's cursor is anywhere on the page; holds still otherwise and under
 * prefers-reduced-motion.
 */
export default function WaveBackground() {
  const [hovered, setHovered] = useState(false)
  const reduceMotion = useReducedMotion()

  useEffect(() => {
    const handleEnter = () => setHovered(true)
    const handleLeave = () => setHovered(false)
    document.body.addEventListener('mouseenter', handleEnter)
    document.body.addEventListener('mouseleave', handleLeave)
    return () => {
      document.body.removeEventListener('mouseenter', handleEnter)
      document.body.removeEventListener('mouseleave', handleLeave)
    }
  }, [])

  return (
    <div className="portal-wave-bg" aria-hidden="true">
      <motion.div
        className="portal-wave-panel"
        animate={
          !reduceMotion && hovered ? { opacity: [1, 0.85, 1] } : { opacity: 1 }
        }
        transition={{
          duration: 3.5,
          ease: 'easeInOut',
          repeat: !reduceMotion && hovered ? Infinity : 0,
        }}
      >
        <svg viewBox="0 0 1440 900" preserveAspectRatio="none" xmlns="http://www.w3.org/2000/svg">
          <defs>
            <linearGradient id="portalWaveGradient" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="var(--portal-surface)" />
              <stop offset="45%" stopColor="var(--portal-blue-light)" />
              <stop offset="78%" stopColor="var(--portal-navy-mid)" />
              <stop offset="100%" stopColor="var(--portal-navy-dark)" />
            </linearGradient>
          </defs>
          <rect width="1440" height="900" fill="url(#portalWaveGradient)" opacity="0.55" />
          <path
            d="M0,620 C280,520 420,700 720,640 C1020,580 1140,460 1440,540 L1440,900 L0,900 Z"
            fill="var(--portal-navy-mid)"
            opacity="0.3"
          />
          <path
            d="M0,700 C320,640 500,780 760,720 C1040,660 1180,560 1440,660 L1440,900 L0,900 Z"
            fill="var(--portal-navy-dark)"
            opacity="0.4"
          />
          <path
            d="M0,780 C300,740 560,840 820,800 C1100,760 1220,700 1440,760 L1440,900 L0,900 Z"
            fill="var(--portal-navy-dark)"
            opacity="0.6"
          />
        </svg>
      </motion.div>
    </div>
  )
}

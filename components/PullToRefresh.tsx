'use client'

import { useState, useRef, useCallback, ReactNode } from 'react'

interface PullToRefreshProps {
  onRefresh: () => Promise<void>
  children: ReactNode
  className?: string
}

const PULL_THRESHOLD = 80
const MAX_PULL = 120

export default function PullToRefresh({ onRefresh, children, className = '' }: PullToRefreshProps) {
  const [pullDistance, setPullDistance] = useState(0)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)
  const startY = useRef(0)
  const isPulling = useRef(false)

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    const container = containerRef.current
    if (!container || isRefreshing) return

    // Only enable pull-to-refresh when scrolled to top
    if (container.scrollTop === 0) {
      startY.current = e.touches[0].clientY
      isPulling.current = true
    }
  }, [isRefreshing])

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    if (!isPulling.current || isRefreshing) return

    const currentY = e.touches[0].clientY
    const diff = currentY - startY.current

    if (diff > 0) {
      // Apply resistance to make it feel natural
      const resistance = 0.5
      const newPullDistance = Math.min(diff * resistance, MAX_PULL)
      setPullDistance(newPullDistance)
    }
  }, [isRefreshing])

  const handleTouchEnd = useCallback(async () => {
    if (!isPulling.current) return
    isPulling.current = false

    if (pullDistance >= PULL_THRESHOLD && !isRefreshing) {
      setIsRefreshing(true)
      setPullDistance(PULL_THRESHOLD / 2) // Keep spinner visible during refresh

      try {
        await onRefresh()
      } finally {
        setIsRefreshing(false)
        setPullDistance(0)
      }
    } else {
      setPullDistance(0)
    }
  }, [pullDistance, isRefreshing, onRefresh])

  const progress = Math.min(pullDistance / PULL_THRESHOLD, 1)

  return (
    <div
      ref={containerRef}
      className={`overflow-auto lg:overflow-visible ${className}`}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      style={{
        overscrollBehavior: 'none',
        WebkitOverflowScrolling: 'touch'
      }}
    >
      {/* Pull indicator */}
      <div
        className="flex justify-center items-center overflow-hidden transition-all duration-200 ease-out"
        style={{
          height: pullDistance > 0 ? pullDistance : 0,
          opacity: progress
        }}
      >
        <div
          className={`w-8 h-8 border-3 border-line-strong border-t-ink-muted rounded-full ${isRefreshing ? 'animate-spin' : ''}`}
          style={{
            transform: isRefreshing ? 'none' : `rotate(${progress * 360}deg)`,
            borderWidth: '3px'
          }}
        />
      </div>

      {/* Content */}
      <div
        style={{
          transform: pullDistance > 0 && !isRefreshing ? `translateY(${pullDistance * 0.1}px)` : 'none',
          transition: isPulling.current ? 'none' : 'transform 0.2s ease-out'
        }}
      >
        {children}
      </div>
    </div>
  )
}

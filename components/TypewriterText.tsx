'use client'

import { useState, useEffect } from 'react'

interface TypewriterTextProps {
  text: string
  speed?: number
  className?: string
  onComplete?: () => void
}

export default function TypewriterText({
  text,
  speed = 20,
  className = '',
  onComplete,
}: TypewriterTextProps) {
  const [displayedText, setDisplayedText] = useState('')
  const [currentIndex, setCurrentIndex] = useState(0)

  useEffect(() => {
    if (currentIndex < text.length) {
      const timer = setTimeout(() => {
        setDisplayedText((prev) => prev + text[currentIndex])
        setCurrentIndex((prev) => prev + 1)
      }, speed)

      return () => clearTimeout(timer)
    } else if (currentIndex === text.length && onComplete) {
      onComplete()
    }
  }, [currentIndex, text, speed, onComplete])

  // Reset when text changes
  useEffect(() => {
    setDisplayedText('')
    setCurrentIndex(0)
  }, [text])

  return (
    <div className={className}>
      {displayedText}
      {currentIndex < text.length && (
        <span className="inline-block w-0.5 h-5 bg-ink ml-0.5 animate-pulse" />
      )}
    </div>
  )
}

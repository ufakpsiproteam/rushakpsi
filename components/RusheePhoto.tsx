'use client'

import { useEffect, useState } from 'react'
import { resolvePhotoUrl } from '@/lib/resolvePhotoUrl'

interface RusheePhotoProps {
  photo: string | null | undefined
  alt: string
  className?: string
  fallback: React.ReactNode
}

/**
 * Renders a rushee/pledge photo stored in the private profile-pictures
 * bucket. `photo` may be a bare storage path or a legacy public URL —
 * see lib/resolvePhotoUrl.ts. Shows `fallback` while resolving, if
 * resolution fails, or if there's no photo at all.
 */
export default function RusheePhoto({ photo, alt, className, fallback }: RusheePhotoProps) {
  const [url, setUrl] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    setUrl(null)
    if (!photo) return

    resolvePhotoUrl(photo).then((resolved) => {
      if (!cancelled) setUrl(resolved)
    })

    return () => {
      cancelled = true
    }
  }, [photo])

  if (!url) return <>{fallback}</>

  return <img src={url} alt={alt} className={className} />
}

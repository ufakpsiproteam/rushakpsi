'use client'

import { useEffect, useState } from 'react'
import { resolvePhotoUrl } from '@/lib/resolvePhotoUrl'

interface RusheePhotoProps {
  photo: string | null | undefined
  alt: string
  className?: string
  fallback: React.ReactNode
  /** Bucket a bare storage path resolves against. Defaults to the
   *  profile-picture bucket; pass 'attendance-photos' for check-in photos. */
  bucket?: string
}

/**
 * Renders a rushee/pledge photo stored in a private storage bucket.
 * `photo` may be a bare storage path or a legacy public URL — see
 * lib/resolvePhotoUrl.ts. Shows `fallback` while resolving, if
 * resolution fails, or if there's no photo at all.
 */
export default function RusheePhoto({ photo, alt, className, fallback, bucket }: RusheePhotoProps) {
  const [url, setUrl] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    setUrl(null)
    if (!photo) return

    resolvePhotoUrl(photo, bucket).then((resolved) => {
      if (!cancelled) setUrl(resolved)
    })

    return () => {
      cancelled = true
    }
  }, [photo, bucket])

  if (!url) return <>{fallback}</>

  return <img src={url} alt={alt} className={className} />
}

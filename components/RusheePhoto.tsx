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
  /** Largest pixel width this photo ever actually renders at (pass the
   *  on-screen size x2 for retina). Requests a downscaled Storage Image
   *  Transformation instead of the full original — every caller should
   *  set this; omit only to fall back to the untransformed original. */
  size?: number
  /** true (default): crop to a size x size square, matching the
   *  `object-cover` circle/tile every caller uses. false: scale
   *  proportionally instead, for a caller that preserves the source's
   *  natural aspect ratio (e.g. `h-auto`) rather than cropping. */
  square?: boolean
}

/**
 * Renders a rushee/pledge photo stored in a private storage bucket.
 * `photo` may be a bare storage path or a legacy public URL — see
 * lib/resolvePhotoUrl.ts. Shows `fallback` while resolving, if
 * resolution fails, or if there's no photo at all.
 */
export default function RusheePhoto({ photo, alt, className, fallback, bucket, size, square }: RusheePhotoProps) {
  const [url, setUrl] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    setUrl(null)
    if (!photo) return

    resolvePhotoUrl(photo, bucket, size ? { width: size, square } : undefined).then((resolved) => {
      if (!cancelled) setUrl(resolved)
    })

    return () => {
      cancelled = true
    }
  }, [photo, bucket, size, square])

  if (!url) return <>{fallback}</>

  return <img src={url} alt={alt} className={className} />
}

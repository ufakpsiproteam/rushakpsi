import { supabase } from './supabase'

// Signed URLs are valid for 1 hour; without this cache every RusheePhoto
// mount (every grid, every re-render) called Storage for a fresh one, and
// each of those calls opens its own DB connection on Storage's side. A
// 169-rushee grid load was firing ~169 simultaneous Storage connections,
// which is what actually drove Postgres to its 60-connection ceiling and
// locked Auth out (see 2026-09-02 "database error querying schema"
// incident) — not real concurrent user count. Cached slightly under the
// real 1-hour expiry so a stale-but-still-valid URL is never served.
const signedUrlCache = new Map<string, { url: string; expiresAt: number }>()
const SIGNED_URL_TTL_MS = 55 * 60 * 1000

/**
 * Both rushees.photo and pledges.photo have historically been written
 * two different ways: a `getPublicUrl()` result (a full URL with the
 * bucket name baked into the path), or — after the 2026-08-11 security
 * hardening migration made every storage bucket private — a bare
 * "<rusheeId>/<filename>" storage path. Public URLs against a private
 * bucket 403 when the browser loads them directly, which is why photos
 * stopped displaying; only a signed URL (RLS-checked, authenticated)
 * actually works now.
 *
 * This resolves either shape to a working signed URL. Uploads should
 * write the bare path going forward (see uploadProfilePhoto in
 * lib/database.ts and components/rushee/ProfilePictureModal.tsx) — the
 * URL-parsing branch here exists only to keep already-uploaded photos
 * working without a data migration.
 */
export async function resolvePhotoUrl(
  rawPhoto: string | null | undefined,
  defaultBucket: string = 'profile-pictures'
): Promise<string | null> {
  if (!rawPhoto) return null
  const trimmed = rawPhoto.trim()
  if (!trimmed || trimmed === '👤') return null

  let bucket: string
  let path: string

  const publicUrlMatch = trimmed.match(/\/storage\/v1\/object\/public\/([^/]+)\/(.+)$/)
  if (publicUrlMatch) {
    bucket = publicUrlMatch[1]
    path = decodeURIComponent(publicUrlMatch[2])
  } else if (trimmed.startsWith('http')) {
    // Some other absolute URL this app doesn't manage — use as-is.
    return trimmed
  } else {
    // Bare storage path. Caller says which bucket new uploads land in
    // (defaults to 'profile-pictures' — see uploadProfilePhoto); falls
    // back to 'profile-photos' for photos uploaded before the bucket
    // names were unified.
    bucket = defaultBucket
    path = trimmed
  }

  const cacheKey = `${bucket}:${path}`
  const cached = signedUrlCache.get(cacheKey)
  if (cached && cached.expiresAt > Date.now()) return cached.url

  const { data, error } = await supabase.storage.from(bucket).createSignedUrl(path, 3600)
  if (!error && data) {
    signedUrlCache.set(cacheKey, { url: data.signedUrl, expiresAt: Date.now() + SIGNED_URL_TTL_MS })
    return data.signedUrl
  }

  if (bucket === 'profile-pictures') {
    const fallbackKey = `profile-photos:${path}`
    const fallbackCached = signedUrlCache.get(fallbackKey)
    if (fallbackCached && fallbackCached.expiresAt > Date.now()) return fallbackCached.url

    const fallback = await supabase.storage.from('profile-photos').createSignedUrl(path, 3600)
    if (!fallback.error && fallback.data) {
      signedUrlCache.set(fallbackKey, { url: fallback.data.signedUrl, expiresAt: Date.now() + SIGNED_URL_TTL_MS })
      return fallback.data.signedUrl
    }
  }

  return null
}

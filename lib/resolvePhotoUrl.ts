import { supabase } from './supabase'

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

  const { data, error } = await supabase.storage.from(bucket).createSignedUrl(path, 3600)
  if (!error && data) return data.signedUrl

  if (bucket === 'profile-pictures') {
    const fallback = await supabase.storage.from('profile-photos').createSignedUrl(path, 3600)
    if (!fallback.error && fallback.data) return fallback.data.signedUrl
  }

  return null
}

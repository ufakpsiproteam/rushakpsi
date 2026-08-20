'use server'

import { getServiceClient, requireSession, unwrapAuth } from '@/lib/server-auth'

/**
 * Short-lived signed URL for a rushee's resume. The `resumes` bucket is
 * private (supabase/migrations/20260811_security_hardening.sql), so a
 * stored public URL or bare path can't be linked to directly — it must be
 * exchanged for a signed URL server-side on each view.
 */
export async function getRusheeResumeUrl(
  rusheeId: string
): Promise<{ url: string | null; error: string | null }> {
  const { failure } = unwrapAuth(await requireSession({ leadership: true }))

  if (failure) {
    return { url: null, error: 'Not authorized.' }
  }

  try {
    const service = getServiceClient()

    const { data: application } = await service
      .from('applications')
      .select('resume_url')
      .eq('rushee_id', rusheeId)
      .maybeSingle()

    const stored = (application?.resume_url as string) || ''
    if (!stored) return { url: null, error: 'No resume on file.' }

    // Historical rows stored a full public URL; newer rows store a path.
    const path = stored.includes('/resumes/') ? stored.split('/resumes/')[1] : stored

    const { data, error } = await service.storage
      .from('resumes')
      .createSignedUrl(path, 300)

    if (error || !data) return { url: null, error: 'Could not generate a resume link.' }

    return { url: data.signedUrl, error: null }
  } catch {
    return { url: null, error: 'Could not generate a resume link.' }
  }
}

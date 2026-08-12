'use server'

import {
  getServiceClient,
  requireSession,
  unwrapAuth,
  callerHasRole,
  type Caller,
} from '@/lib/server-auth'

/**
 * Pledge directory data.
 *
 * PRD §6.1.3: "authenticated, restricted to Admin, Professional Chair,
 * and Recruitment Director. It is not a public route and has no shared
 * password."
 *
 * This action previously used the service-role key with no authentication
 * at all, behind a client-side password constant. Server Actions are
 * directly invokable, so the password gate protected nothing. The role
 * check now happens here, server-side, before the service client is
 * touched at all (PRD S4).
 */

export interface PledgeRecord {
  id: string
  name: string
  photo: string | null
  email: string
  phoneNumber: string
  address: string
  major: string
  minor: string
  application: Record<string, unknown> | null
}

function canReadPledgeDirectory(caller: Caller): boolean {
  return (
    caller.accountType === 'brother' &&
    (callerHasRole(caller, 'admin', 'professional_chair', 'recruitment_director') ||
      caller.accessLevel === 'admin' ||
      caller.accessLevel === 'recruitment')
  )
}

export async function getPledges(): Promise<{
  data: PledgeRecord[] | null
  error: string | null
}> {
  const { caller, failure } = unwrapAuth(await requireSession())

  if (failure || !caller) {
    return { data: null, error: 'You must be signed in to view the pledge directory.' }
  }

  if (!canReadPledgeDirectory(caller)) {
    return {
      data: null,
      error:
        'The pledge directory is limited to Admins, the Professional Chair, and Directors of Recruitment.',
    }
  }

  try {
    const service = getServiceClient()

    const { data: rusheesData, error: rusheesError } = await service
      .from('rushees')
      .select('id, name, photo')
      .eq('bid_status', true)
      .order('name')

    if (rusheesError) throw rusheesError

    const rusheeIds = (rusheesData || []).map((r: { id: string }) => r.id)

    if (rusheeIds.length === 0) {
      return { data: [], error: null }
    }

    // Scoped to the bid recipients only, rather than reading every
    // application in the table.
    const { data: applicationsData, error: applicationsError } = await service
      .from('applications')
      .select('*')
      .in('rushee_id', rusheeIds)

    if (applicationsError) throw applicationsError

    const pledges: PledgeRecord[] = (rusheesData || [])
      .map((rushee: { id: string; name: string; photo: string | null }) => {
        const application = (applicationsData || []).find(
          (app: { rushee_id: string }) => app.rushee_id === rushee.id
        ) as Record<string, unknown> | undefined

        return {
          id: rushee.id,
          name: rushee.name,
          photo: rushee.photo,
          email: (application?.email as string) || '',
          phoneNumber: (application?.phone_number as string) || '',
          address: (application?.uf_address as string) || '',
          major: (application?.major as string) || '',
          minor: (application?.minor as string) || '',
          application: application ?? null,
        }
      })
      .filter((pledge) => pledge.application !== null)

    return { data: pledges, error: null }
  } catch (error) {
    console.error('[pledges] failed to load directory')
    return { data: null, error: 'Failed to load pledge directory.' }
  }
}

/**
 * Short-lived signed URL for a pledge's resume (PRD S5 / §7.9 — buckets
 * are private and served exclusively through signed URLs issued after an
 * authorization check).
 */
export async function getPledgeResumeUrl(
  rusheeId: string
): Promise<{ url: string | null; error: string | null }> {
  const { caller, failure } = unwrapAuth(await requireSession())

  if (failure || !caller || !canReadPledgeDirectory(caller)) {
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

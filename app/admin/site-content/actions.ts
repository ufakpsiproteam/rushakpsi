'use server'

import { getServiceClient, requireSession, unwrapAuth, logAudit } from '@/lib/server-auth'
import { SITE_CONTENT_DEFAULTS, deepMergeSiteContent, type SiteContent } from '@/lib/siteContent'

/**
 * Rushing-copy admin editor — same access pattern as
 * app/admin/interview-questions/actions.ts: admin-only, service-role
 * writes, audit-logged. Content is stored as one jsonb blob keyed by
 * top-level SiteContent section, so a save only ever touches the section
 * being edited — every other section keeps deferring to
 * SITE_CONTENT_DEFAULTS (lib/siteContent.ts) until someone edits it too.
 */

async function requireAdmin() {
  const { caller, failure } = unwrapAuth(await requireSession({ roles: ['admin'] }))
  if (failure || !caller) return { caller: null, error: 'Admin access required.' }
  return { caller, error: null }
}

/** Effective content (defaults overlaid with whatever's been saved), for prefilling the edit forms. */
export async function getSiteContent(): Promise<{ data: SiteContent | null; error: string | null }> {
  const { caller, error } = await requireAdmin()
  if (!caller) return { data: null, error }

  const service = getServiceClient()
  const { data, error: dbError } = await service.from('site_content').select('content').eq('id', true).maybeSingle()
  if (dbError) return { data: null, error: 'Failed to load site content.' }

  const stored = (data as { content?: unknown } | null)?.content
  const merged = stored && typeof stored === 'object' ? deepMergeSiteContent(SITE_CONTENT_DEFAULTS, stored) : SITE_CONTENT_DEFAULTS
  return { data: merged, error: null }
}

export async function updateSiteContentSection<K extends keyof SiteContent>(
  sectionKey: K,
  value: SiteContent[K]
): Promise<{ error: string | null }> {
  const { caller, error } = await requireAdmin()
  if (!caller) return { error }

  const service = getServiceClient()
  const { data: before } = await service.from('site_content').select('content').eq('id', true).maybeSingle()
  const currentContent = (before?.content as Record<string, unknown> | null) ?? {}
  const beforeValue = currentContent[sectionKey] ?? null
  const newContent = { ...currentContent, [sectionKey]: value }

  const { error: dbError } = await service
    .from('site_content')
    .update({ content: newContent, updated_at: new Date().toISOString(), updated_by: caller.userId })
    .eq('id', true)

  if (dbError) return { error: 'Failed to save.' }

  await logAudit({
    actorId: caller.userId,
    action: 'site_content.edit',
    entityType: 'site_content',
    entityId: String(sectionKey),
    before: beforeValue,
    after: value,
  })

  return { error: null }
}

/** Resets one section back to the shipped default by clearing its override. */
export async function resetSiteContentSection(sectionKey: keyof SiteContent): Promise<{ error: string | null }> {
  const { caller, error } = await requireAdmin()
  if (!caller) return { error }

  const service = getServiceClient()
  const { data: before } = await service.from('site_content').select('content').eq('id', true).maybeSingle()
  const currentContent = (before?.content as Record<string, unknown> | null) ?? {}
  const beforeValue = currentContent[sectionKey] ?? null
  const newContent = { ...currentContent }
  delete newContent[sectionKey as string]

  const { error: dbError } = await service
    .from('site_content')
    .update({ content: newContent, updated_at: new Date().toISOString(), updated_by: caller.userId })
    .eq('id', true)

  if (dbError) return { error: 'Failed to reset.' }

  await logAudit({
    actorId: caller.userId,
    action: 'site_content.reset',
    entityType: 'site_content',
    entityId: String(sectionKey),
    before: beforeValue,
    after: null,
  })

  return { error: null }
}

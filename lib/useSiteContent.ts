'use client'

/**
 * Split out of lib/siteContent.ts so that file stays importable from
 * server actions (app/admin/site-content/actions.ts) without dragging a
 * React hook — and therefore a client-component boundary — into server
 * code.
 */

import { useEffect, useState } from 'react'
import { SITE_CONTENT_DEFAULTS, loadSiteContent, type SiteContent } from './siteContent'

/**
 * Renders SITE_CONTENT_DEFAULTS on first paint (so there is never a flash
 * of blank/different copy), then swaps in the loaded+merged content once
 * the fetch resolves.
 */
export function useSiteContent(): SiteContent {
  const [content, setContent] = useState<SiteContent>(SITE_CONTENT_DEFAULTS)

  useEffect(() => {
    let cancelled = false
    loadSiteContent().then((loaded) => {
      if (!cancelled) setContent(loaded)
    })
    return () => {
      cancelled = true
    }
  }, [])

  return content
}

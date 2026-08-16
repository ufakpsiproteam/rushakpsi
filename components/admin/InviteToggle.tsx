'use client'

import { useState, useEffect, useCallback } from 'react'
import { supabase } from '@/lib/supabase'

/**
 * Brother invite kill switch. Off blocks issuing new invites AND redeeming
 * any already-sent link — enforced server-side in app/api/invites/*, this
 * is just the control.
 */

export default function InviteToggle({ onChange }: { onChange?: (enabled: boolean) => void }) {
  const [enabled, setEnabled] = useState<boolean | null>(null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const authHeader = useCallback(async () => {
    const {
      data: { session },
    } = await supabase.auth.getSession()
    if (!session?.access_token) throw new Error('No active session')
    return {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${session.access_token}`,
    }
  }, [])

  useEffect(() => {
    ;(async () => {
      try {
        const headers = await authHeader()
        const response = await fetch('/api/admin/invite-toggle', { headers })
        const result = await response.json()
        if (response.ok) {
          setEnabled(result.enabled)
          onChange?.(result.enabled)
        }
      } catch {
        // Leave enabled null — the switch stays in its loading state.
      }
      // eslint-disable-next-line react-hooks/exhaustive-deps
    })()
  }, [authHeader])

  async function flip() {
    if (enabled === null || saving) return
    const next = !enabled
    setError('')
    setSaving(true)
    setEnabled(next)
    onChange?.(next)

    try {
      const headers = await authHeader()
      const response = await fetch('/api/admin/invite-toggle', {
        method: 'POST',
        headers,
        body: JSON.stringify({ enabled: next }),
      })
      const result = await response.json()
      if (!response.ok) {
        setEnabled(!next)
        onChange?.(!next)
        setError(result.error || 'Could not update the setting.')
      }
    } catch {
      setEnabled(!next)
      onChange?.(!next)
      setError('Could not reach the server.')
    } finally {
      setSaving(false)
    }
  }

  const loading = enabled === null

  return (
    <div className="card card-pad mb-6 flex items-start justify-between gap-4">
      <div>
        <p className="section-title">New brother accounts</p>
        <p className="field-help mt-1">
          {loading
            ? 'Checking status…'
            : enabled
            ? 'Admins can create invites and outstanding links still work.'
            : 'Invites can’t be issued and outstanding links are rejected until this is back on.'}
        </p>
        {error && <p className="text-xs text-negative mt-1">{error}</p>}
      </div>

      <button
        type="button"
        role="switch"
        aria-checked={enabled === true}
        aria-label="Toggle new brother account creation"
        disabled={loading || saving}
        onClick={flip}
        className="relative inline-flex h-7 w-12 shrink-0 items-center rounded-full transition-colors disabled:opacity-50"
        style={{
          background: enabled ? 'var(--color-positive)' : 'var(--color-ink-subtle)',
        }}
      >
        <span
          className="inline-block h-5 w-5 transform rounded-full bg-white transition-transform"
          style={{ transform: enabled ? 'translateX(22px)' : 'translateX(4px)' }}
        />
      </button>
    </div>
  )
}

import { NextRequest, NextResponse } from 'next/server'
import { requireBearer, unwrapAuth, getServiceClient } from '@/lib/server-auth'

/**
 * User lookup for the admin-assisted password reset table (PRD R53).
 * Returns the minimum needed to identify a person at the check-in desk.
 */
export async function POST(request: NextRequest) {
  try {
    const { caller, failure } = unwrapAuth(
      await requireBearer(request.headers.get('authorization'), { roles: ['admin'] })
    )

    if (failure || !caller) {
      return NextResponse.json({ error: failure?.error ?? 'Unauthorized' }, {
        status: failure?.status ?? 401,
      })
    }

    const { query } = await request.json()
    const trimmed = String(query || '').trim()

    if (trimmed.length < 2) {
      return NextResponse.json({ data: [] })
    }

    // Escape PostgREST pattern metacharacters so a search string can't
    // alter the filter it is embedded in.
    const safe = trimmed.replace(/[%_,()\\]/g, (match) => '\\' + match)

    const service = getServiceClient()

    const { data, error } = await service
      .from('user_profiles')
      .select('id, name, email, account_type, access_level')
      .or(`email.ilike.%${safe}%,name.ilike.%${safe}%`)
      .order('name', { ascending: true })
      .limit(10)

    if (error) {
      console.error('[search-users] query failed')
      return NextResponse.json({ error: 'Search failed' }, { status: 500 })
    }

    return NextResponse.json({ data: data || [] })
  } catch (error) {
    console.error('[search-users] unexpected error')
    return NextResponse.json({ error: 'An unexpected error occurred' }, { status: 500 })
  }
}

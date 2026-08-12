import { NextRequest, NextResponse } from 'next/server'
import { getServiceClient } from '@/lib/server-auth'
import { POLICY_DEFAULTS, validatePassword } from '@/lib/policy'

/**
 * Public self-signup (rushees today; the function stays general since
 * lib/auth.ts previously supported brother signup too).
 *
 * Account and profile creation happen together here, server-side, with
 * the service role — the same pattern as /api/invites/accept. Doing
 * this from the browser (auth.signUp() immediately followed by a client
 * insert relying on RLS) raced the client's session propagation: the
 * insert sometimes ran before the fresh session was attached to the
 * client, got rejected by RLS, and left an orphaned auth.users row with
 * no profile. Server-side there's no session/RLS timing to race at all.
 * If the profile write fails, the auth user is deleted again so no
 * partial account is left behind.
 */
export async function POST(request: NextRequest) {
  try {
    const { email, password, name, accountType, accessLevel, major, year } = await request.json()

    if (!email || !password || !name) {
      return NextResponse.json({ error: 'Please provide your name, email, and password' }, { status: 400 })
    }

    if (accountType !== 'rushee' && accountType !== 'brother') {
      return NextResponse.json({ error: 'Invalid account type' }, { status: 400 })
    }

    const passwordError = validatePassword(String(password), POLICY_DEFAULTS)
    if (passwordError) {
      return NextResponse.json({ error: passwordError }, { status: 400 })
    }

    if (accountType === 'rushee' && (!major || !year)) {
      return NextResponse.json({ error: 'Rushees must provide major and year' }, { status: 400 })
    }

    const service = getServiceClient()
    const resolvedAccessLevel = accountType === 'rushee' ? 'basic' : (accessLevel || 'basic')

    const { data: created, error: createError } = await service.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { name, account_type: accountType },
    })

    if (createError || !created?.user) {
      return NextResponse.json(
        { error: createError?.message || 'Could not create the account.' },
        { status: 400 }
      )
    }

    const userId = created.user.id

    const { error: profileError } = await service.from('user_profiles').insert({
      id: userId,
      email,
      name,
      account_type: accountType,
      access_level: resolvedAccessLevel,
    })

    if (profileError) {
      await service.auth.admin.deleteUser(userId)
      console.error('[auth/signup] profile creation failed, rolled back')
      return NextResponse.json({ error: 'Could not create your account.' }, { status: 500 })
    }

    if (accountType === 'brother') {
      const { error: brotherError } = await service.from('brothers').insert({
        id: userId,
        email,
        name,
        access_level: accessLevel || 'basic',
      })

      if (brotherError) {
        await service.auth.admin.deleteUser(userId)
        console.error('[auth/signup] brother record failed, rolled back')
        return NextResponse.json({ error: 'Could not create your account.' }, { status: 500 })
      }
    } else {
      const { error: rusheeError } = await service.from('rushees').insert({
        id: userId,
        name,
        email,
        major,
        year,
      })

      if (rusheeError) {
        await service.auth.admin.deleteUser(userId)
        console.error('[auth/signup] rushee record failed, rolled back')
        return NextResponse.json({ error: 'Could not create your account.' }, { status: 500 })
      }
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('[auth/signup] unexpected error')
    return NextResponse.json({ error: 'An unexpected error occurred' }, { status: 500 })
  }
}

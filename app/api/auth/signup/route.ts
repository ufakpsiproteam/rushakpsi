import { NextRequest, NextResponse } from 'next/server'
import { getServiceClient } from '@/lib/server-auth'
import { POLICY_DEFAULTS, validatePassword } from '@/lib/policy'

/**
 * Public self-signup — rushees only, hardcoded server-side. Brother
 * accounts are created exclusively via the invite flow
 * (app/api/invites/accept/route.ts). This route used to accept
 * `accountType`/`accessLevel` from the request body and trust them
 * verbatim, which let anyone create a brother account — including one
 * with `accessLevel: 'admin'` — without an invite or any authentication
 * at all. Fixed 2026-08-23: account type and access level are no longer
 * read from the request; every account created here is a `rushee` at
 * `basic` access, matching what the actual signup page has always sent.
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
    const { email, password, name, major, year } = await request.json()

    if (!email || !password || !name) {
      return NextResponse.json({ error: 'Please provide your name, email, and password' }, { status: 400 })
    }

    if (!String(email).trim().toLowerCase().endsWith('@ufl.edu')) {
      return NextResponse.json({ error: 'Please use your UF email address (example@ufl.edu)' }, { status: 400 })
    }

    const passwordError = validatePassword(String(password), POLICY_DEFAULTS)
    if (passwordError) {
      return NextResponse.json({ error: passwordError }, { status: 400 })
    }

    if (!major || !year) {
      return NextResponse.json({ error: 'Rushees must provide major and year' }, { status: 400 })
    }

    const service = getServiceClient()

    const { data: created, error: createError } = await service.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { name, account_type: 'rushee' },
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
      account_type: 'rushee',
      access_level: 'basic',
    })

    if (profileError) {
      await service.auth.admin.deleteUser(userId)
      console.error('[auth/signup] profile creation failed, rolled back')
      return NextResponse.json({ error: 'Could not create your account.' }, { status: 500 })
    }

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

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('[auth/signup] unexpected error')
    return NextResponse.json({ error: 'An unexpected error occurred' }, { status: 500 })
  }
}

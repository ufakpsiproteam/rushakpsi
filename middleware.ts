import { createServerClient } from '@supabase/ssr'
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

// Routes that don't require authentication.
//
// `/pledges` used to sit here, gated only by a password constant that
// shipped in the client bundle. The directory now lives at
// /admin/pledges and is role-checked server-side (PRD §6.1.3).
// `/brother-account-creation` is now only a signpost pointing at the
// invitation flow; it no longer creates accounts.
const publicRoutes = [
  '/',
  '/auth/signin',
  '/auth/signup',
  '/auth/forgot-password',
  '/auth/reset-password',
  '/splash',
  '/landing',
  '/brother-account-creation',
]

// Routes that use dynamic segments but are public. Token-scoped: they
// return nothing at all unless the token validates server-side (PRD S3).
const publicDynamicRoutes = ['/invite/']

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  // Allow public routes
  if (publicRoutes.includes(pathname)) {
    return NextResponse.next()
  }

  // Allow public dynamic routes
  if (publicDynamicRoutes.some(route => pathname.startsWith(route))) {
    return NextResponse.next()
  }

  // Allow static files and API routes
  if (
    pathname.startsWith('/_next') ||
    pathname.startsWith('/api') ||
    pathname.includes('.') // static files like .png, .ico, etc.
  ) {
    return NextResponse.next()
  }

  // Create Supabase client for middleware
  let response = NextResponse.next({
    request: {
      headers: request.headers,
    },
  })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) =>
            request.cookies.set(name, value)
          )
          response = NextResponse.next({
            request: {
              headers: request.headers,
            },
          })
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  // Get user session
  const { data: { user }, error: userError } = await supabase.auth.getUser()

  // No user session - redirect to signin
  if (!user || userError) {
    const redirectUrl = new URL('/auth/signin', request.url)
    redirectUrl.searchParams.set('redirect', pathname)
    return NextResponse.redirect(redirectUrl)
  }

  // Get user profile for routing. This is a convenience only — PRD S1 is
  // explicit that middleware exists to route users sensibly and is never
  // the sole control on any read or write. Row Level Security is the
  // boundary.
  let account_type: string | null = null
  let access_level: string | null = null

  const { data: profile } = await supabase
    .from('user_profiles')
    .select('account_type, access_level')
    .eq('id', user.id)
    .maybeSingle()

  if (profile) {
    account_type = profile.account_type
    access_level = profile.access_level
  } else {
    // Fall back to the underlying tables if the user_profiles view is
    // unavailable, rather than bouncing a signed-in user to sign-in.
    const { data: brother } = await supabase
      .from('brothers')
      .select('access_level')
      .eq('id', user.id)
      .maybeSingle()

    if (brother) {
      account_type = 'brother'
      access_level = brother.access_level
    } else {
      const { data: rushee } = await supabase
        .from('rushees')
        .select('id')
        .eq('id', user.id)
        .maybeSingle()

      if (rushee) account_type = 'rushee'
    }
  }

  if (!account_type) {
    const redirectUrl = new URL('/auth/signin', request.url)
    return NextResponse.redirect(redirectUrl)
  }

  // Route protection based on account type

  // Rushee routes - only rushees can access
  if (pathname.startsWith('/rushee')) {
    if (account_type !== 'rushee') {
      // Redirect brothers/admins to their dashboard
      if (account_type === 'brother' && access_level === 'admin') {
        return NextResponse.redirect(new URL('/admin/dashboard', request.url))
      }
      return NextResponse.redirect(new URL('/brother/dashboard', request.url))
    }
  }

  // Brother routes - only brothers (non-admin) can access
  // Note: Some brother routes like /brother/cuts have additional role-based
  // access checks within the page itself (using brother_roles table)
  if (pathname.startsWith('/brother')) {
    if (account_type !== 'brother') {
      // Redirect rushees to their dashboard
      return NextResponse.redirect(new URL('/rushee/dashboard', request.url))
    }
    // Admins should go to admin dashboard (optional - they could access brother routes too)
    if (access_level === 'admin' && pathname === '/brother/dashboard') {
      return NextResponse.redirect(new URL('/admin/dashboard', request.url))
    }
  }

  // Admin routes - accessible to admin and pro brothers
  if (pathname.startsWith('/admin')) {
    if (account_type !== 'brother') {
      // Redirect rushees to their dashboard
      if (account_type === 'rushee') {
        return NextResponse.redirect(new URL('/rushee/dashboard', request.url))
      }
      return NextResponse.redirect(new URL('/brother/dashboard', request.url))
    }

    // Directors of Recruitment need /admin/attendance and /admin/pledges
    // per the permission matrix (PRD §3.2); they were previously bounced
    // out of every /admin route. Page-level checks narrow this further.
    const elevated = ['admin', 'pro', 'recruitment']
    if (!access_level || !elevated.includes(access_level)) {
      return NextResponse.redirect(new URL('/brother/dashboard', request.url))
    }
  }

  return response
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     */
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}

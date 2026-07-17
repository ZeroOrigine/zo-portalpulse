// CANONICAL: PortalPulse root middleware. Session refresh + route protection.
// Owns: refreshing the Supabase auth session cookie on every request, gating
// /dashboard/* pages and /api/* routes, and steering signed-in users away
// from /login and /signup.
//
// Cookie security: @supabase/ssr issues HttpOnly, Secure (on https),
// SameSite=Lax auth cookies. SameSite=Lax is the first CSRF layer; the
// checkout, billing and signout routes add an explicit same-origin check
// on top of it.

import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

// Pages that require a signed-in user.
const PROTECTED_PAGE_PREFIXES = ['/dashboard', '/emails', '/gcs', '/settings', '/billing']

// Signed-in users get bounced from these straight to the app.
const AUTH_ONLY_PAGES = ['/login', '/signup']

// API prefixes that stay reachable without a session.
// /api/auth: signout is a session-scoped no-op when logged out.
// /api/inbound: the inbound email webhook. The email provider POSTs with NO
//   session cookie; the route authenticates itself with the timing-safe
//   INBOUND_EMAIL_WEBHOOK_SECRET check plus its own rate limit. Gating it
//   here behind a login would kill the product's core loop.
// /api/webhooks: reserved for future signature-verified machine calls.
const PUBLIC_API_PREFIXES = ['/api/auth', '/api/inbound', '/api/webhooks']

function startsWithAny(pathname: string, prefixes: string[]): boolean {
  return prefixes.some((p) => pathname === p || pathname.startsWith(`${p}/`))
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  let response = NextResponse.next({ request })

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  // Missing env only happens on a misconfigured deploy. Marketing pages keep
  // working; protected pages and API routes still verify auth server-side
  // themselves, so nothing sensitive opens up if this passes through.
  if (!supabaseUrl || !supabaseAnonKey) {
    return response
  }

  const supabase = createServerClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll()
      },
      setAll(cookiesToSet: { name: string; value: string; options?: Record<string, unknown> }[]) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
        response = NextResponse.next({ request })
        cookiesToSet.forEach(({ name, value, options }) =>
          response.cookies.set(name, value, options)
        )
      },
    },
  })

  // Always call getUser() here: it revalidates the JWT against Supabase and
  // refreshes expiring session cookies on every request.
  const {
    data: { user },
  } = await supabase.auth.getUser()

  const isProtectedPage = startsWithAny(pathname, PROTECTED_PAGE_PREFIXES)
  const isAuthOnlyPage = startsWithAny(pathname, AUTH_ONLY_PAGES)
  const isApiRoute = pathname === '/api' || pathname.startsWith('/api/')
  const isPublicApiRoute = startsWithAny(pathname, PUBLIC_API_PREFIXES)

  if (!user && isProtectedPage) {
    const loginUrl = new URL('/login', request.url)
    loginUrl.searchParams.set('redirect', pathname)
    return NextResponse.redirect(loginUrl)
  }

  if (!user && isApiRoute && !isPublicApiRoute) {
    return NextResponse.json(
      { data: null, error: 'Please sign in to do that.' },
      { status: 401 }
    )
  }

  if (user && isAuthOnlyPage) {
    return NextResponse.redirect(new URL('/dashboard', request.url))
  }

  return response
}

export const config = {
  matcher: [
    // Everything except Next.js internals and static assets.
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|css|js|map|txt|xml|woff|woff2)$).*)',
  ],
}

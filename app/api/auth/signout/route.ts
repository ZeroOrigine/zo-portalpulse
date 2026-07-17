// CANONICAL: PortalPulse signout route (POST /api/auth/signout).
// Clears the caller's own Supabase session cookies. Works for both plain
// <form method="post"> posts (302 to /login) and fetch() calls that send
// Accept: application/json.
// rate-limit-exempt: session-scoped idempotent action (signout); it only
// clears the caller's own auth cookies and never spends money or tokens.

import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

// Same-origin check: first CSRF layer is the SameSite=Lax auth cookie, this
// is the second. Kept byte-identical across checkout, billing portal and
// signout routes on purpose: one shape, one behavior.
function isSameOrigin(request: Request): boolean {
  const origin = request.headers.get('origin')
  if (!origin) return true
  const host = request.headers.get('x-forwarded-host') ?? request.headers.get('host')
  if (!host) return false
  try {
    return new URL(origin).host === host
  } catch {
    return false
  }
}

export async function POST(request: Request) {
  if (!isSameOrigin(request)) {
    return NextResponse.json(
      { data: null, error: 'That request came from an unexpected origin, so we stopped it.' },
      { status: 403 }
    )
  }

  const supabase = await createClient()
  await supabase.auth.signOut()

  const wantsJson = request.headers.get('accept')?.includes('application/json')
  if (wantsJson) {
    return NextResponse.json({ data: { signedOut: true }, error: null })
  }
  return NextResponse.redirect(new URL('/login', request.url), { status: 302 })
}

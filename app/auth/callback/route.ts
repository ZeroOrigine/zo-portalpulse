// CANONICAL: PortalPulse OAuth and PKCE callback (/auth/callback). Exchanges
// the one-time code for a session cookie, then forwards the user. Used by
// Google and GitHub sign-in and by code-style links in auth emails
// (signup confirmation, password recovery via ?next=/reset-password).
// rate-limit-exempt: GET redirect handler; the code is single-use and
// verified by Supabase auth, and a failed exchange only redirects.

import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

function safeInternalPath(path: string | null, fallback = '/dashboard'): string {
  if (!path || !path.startsWith('/') || path.startsWith('//')) return fallback
  return path
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const code = searchParams.get('code')
  const next = safeInternalPath(searchParams.get('next'))

  if (code) {
    const supabase = await createClient()
    const { error } = await supabase.auth.exchangeCodeForSession(code)
    if (!error) {
      return NextResponse.redirect(new URL(next, request.url))
    }
  }

  return NextResponse.redirect(new URL('/login?error=auth_callback', request.url))
}

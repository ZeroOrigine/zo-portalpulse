// CANONICAL: PortalPulse email confirmation handler (/auth/confirm).
// Handles token_hash links from the Supabase email templates (signup,
// recovery, email change) by verifying the OTP server-side, then forwarding
// the user. Recovery links land on /reset-password; everything else lands
// on /dashboard unless the link carries a safe internal ?next path.
// rate-limit-exempt: GET redirect handler; the one-time token it carries is
// minted and verified by Supabase auth, and a failed verify only redirects.

import { NextResponse } from 'next/server'
import type { EmailOtpType } from '@supabase/supabase-js'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

function safeInternalPath(path: string | null, fallback: string): string {
  if (!path || !path.startsWith('/') || path.startsWith('//')) return fallback
  return path
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const tokenHash = searchParams.get('token_hash')
  const type = searchParams.get('type') as EmailOtpType | null
  const fallback = type === 'recovery' ? '/reset-password' : '/dashboard'
  const next = safeInternalPath(searchParams.get('next'), fallback)

  if (tokenHash && type) {
    const supabase = await createClient()
    const { error } = await supabase.auth.verifyOtp({ type, token_hash: tokenHash })
    if (!error) {
      return NextResponse.redirect(new URL(next, request.url))
    }
  }

  // Expired, reused or malformed link: land on /login with a friendly notice.
  return NextResponse.redirect(new URL('/login?error=confirm', request.url))
}

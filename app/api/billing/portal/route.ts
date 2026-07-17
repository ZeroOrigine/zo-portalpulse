// CANONICAL: PortalPulse billing portal route (POST /api/billing/portal).
// Central payments mode: no Stripe SDK here. Asks the central payments proxy
// for a hosted billing management URL so a subscriber can change or cancel
// their plan. The extra "mode": "portal" field is advisory for the proxy; if
// the proxy does not support portal sessions yet, this route degrades to a
// clear, honest error and nothing about the subscription changes.
//
// Contract for UI code:
//   POST /api/billing/portal
//   200 -> { data: { url: string }, error: null }  then window.location.assign(url)
//   4xx/5xx -> { data: null, error: string }

import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { rateLimitCheck, clientIp } from '@/lib/rate-limit'

const PRODUCT_SLUG = 'portalpulse'

function jsonError(message: string, status: number) {
  return NextResponse.json({ data: null, error: message }, { status })
}

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
  const verdict = await rateLimitCheck('portalpulse_billing', clientIp(request), 20, 1000)
  if (!verdict.allowed) {
    return jsonError('Too many requests for today. The counter resets tomorrow.', 429)
  }

  if (!isSameOrigin(request)) {
    return jsonError('That request came from an unexpected origin, so we stopped it.', 403)
  }

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    return jsonError('Please sign in to manage billing.', 401)
  }

  const { data: subscription } = await supabase
    .from('portalpulse_subscriptions')
    .select('plan, status, stripe_customer_id')
    .eq('user_id', user.id)
    .maybeSingle()

  if (!subscription || !subscription.stripe_customer_id) {
    return jsonError('You are on the free plan, so there is no billing to manage yet. Upgrade to Pro first.', 400)
  }

  const paymentsUrl = process.env.PAYMENTS_URL
  const proxyToken = process.env.PAYMENTS_PROXY_TOKEN
  if (!paymentsUrl || !proxyToken) {
    return jsonError('The payment desk is not configured yet. Your subscription is unchanged.', 503)
  }

  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 15000)
  let proxyResponse: Response | null = null
  try {
    proxyResponse = await fetch(paymentsUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${proxyToken}`,
      },
      body: JSON.stringify({
        product_slug: PRODUCT_SLUG,
        user_id: user.id,
        mode: 'portal',
      }),
      cache: 'no-store',
      signal: controller.signal,
    })
  } catch {
    proxyResponse = null
  } finally {
    clearTimeout(timeout)
  }

  if (!proxyResponse || !proxyResponse.ok) {
    return jsonError(
      'Plan changes go through our payment desk and it did not answer. Your subscription is unchanged. Try again shortly.',
      502
    )
  }

  const payload = (await proxyResponse.json().catch(() => null)) as
    | { url?: string; data?: { url?: string } }
    | null
  const url = payload?.url ?? payload?.data?.url

  if (!url || typeof url !== 'string') {
    return jsonError(
      'The payment desk did not return a management link. Your subscription is unchanged. Try again shortly.',
      502
    )
  }

  return NextResponse.json({ data: { url }, error: null })
}

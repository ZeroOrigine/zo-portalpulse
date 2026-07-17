// CANONICAL: PortalPulse checkout route (POST /api/checkout).
// Central payments mode: this product holds no Stripe key and ships no
// Stripe SDK. The route authenticates the user, resolves the requested plan
// and billing interval to a Stripe price id (portalpulse_plans columns are
// filled by the Deploy layer; env vars are a fallback), then asks the
// central ZeroOrigine payments proxy for a hosted checkout URL. The central
// service owns the Stripe key, the webhook, idempotency and the product
// metadata tag; it writes results into portalpulse_subscriptions and
// portalpulse_payments, which this product only ever reads.
//
// Contract for UI code (dashboard and landing own the buttons):
//   POST /api/checkout
//   body: { "plan": "pro", "interval": "monthly" | "yearly" }
//   200 -> { data: { url: string }, error: null }  then window.location.assign(url)
//   4xx/5xx -> { data: null, error: string }

import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { rateLimitCheck, clientIp } from '@/lib/rate-limit'

const PRODUCT_SLUG = 'portalpulse'
const INTERVALS = ['monthly', 'yearly'] as const
type Interval = (typeof INTERVALS)[number]

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
    return jsonError('Please sign in to upgrade.', 401)
  }

  let body: { plan?: unknown; interval?: unknown } = {}
  try {
    body = await request.json()
  } catch {
    // No body or invalid JSON: defaults below still describe a valid request.
  }

  const plan = typeof body.plan === 'string' ? body.plan : 'pro'
  const interval: Interval = INTERVALS.includes(body.interval as Interval)
    ? (body.interval as Interval)
    : 'monthly'

  if (plan !== 'pro') {
    return jsonError('Pro is the plan you can upgrade to. The free plan needs no checkout.', 400)
  }

  // Already on a live paid subscription? Nothing to buy twice.
  const { data: existing } = await supabase
    .from('portalpulse_subscriptions')
    .select('plan, status')
    .eq('user_id', user.id)
    .maybeSingle()

  if (existing && existing.plan === 'pro' && ['active', 'trialing'].includes(existing.status)) {
    return jsonError('You are already on Pro. Every GC and every parsed email is unlocked.', 409)
  }

  // Price ids live on the plans row (single source of truth, written at
  // deploy time); env vars are only a fallback. Never hardcoded.
  const { data: planRow, error: planError } = await supabase
    .from('portalpulse_plans')
    .select(
      'slug, is_active, price_monthly_cents, price_yearly_cents, stripe_price_id_monthly, stripe_price_id_yearly'
    )
    .eq('slug', 'pro')
    .eq('is_active', true)
    .maybeSingle()

  if (planError || !planRow) {
    return jsonError('The Pro plan is not available right now. Try again shortly.', 503)
  }

  const priceId =
    interval === 'yearly'
      ? planRow.stripe_price_id_yearly ?? process.env.STRIPE_PRICE_ID_PRO_YEARLY ?? null
      : planRow.stripe_price_id_monthly ?? process.env.STRIPE_PRICE_ID_PRO_MONTHLY ?? null

  if (!priceId) {
    return jsonError('Upgrades are opening shortly. Check back soon, your free plan keeps working.', 503)
  }

  const paymentsUrl = process.env.PAYMENTS_URL
  const proxyToken = process.env.PAYMENTS_PROXY_TOKEN
  if (!paymentsUrl || !proxyToken) {
    return jsonError('The payment desk is not configured yet. Nothing was charged.', 503)
  }

  // QA-020: make the return-URL contract explicit instead of relying on
  // proxy-side defaults. The billing page reads ?checkout=success|cancelled,
  // so tell the proxy exactly where to send users back.
  // QA-031: NEXT_PUBLIC_APP_URL must be an absolute origin. If it is unset we
  // would build relative return URLs like '/billing?checkout=success', which
  // Stripe rejects. Treat a missing base URL as an unconfigured payment desk.
  const appUrl = (process.env.NEXT_PUBLIC_APP_URL ?? '').replace(/\/+$/, '')
  if (!appUrl) {
    return jsonError('The payment desk is not configured yet. Nothing was charged.', 503)
  }
  const successUrl = `${appUrl}/billing?checkout=success`
  const cancelUrl = `${appUrl}/billing?checkout=cancelled`

  // Ask the central payments proxy for a hosted checkout URL.
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
        price_id: priceId,
        user_id: user.id,
        success_url: successUrl,
        cancel_url: cancelUrl,
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
      'The payment desk did not answer. Nothing was charged. Try again in a minute.',
      502
    )
  }

  const payload = (await proxyResponse.json().catch(() => null)) as
    | { url?: string; data?: { url?: string } }
    | null
  const url = payload?.url ?? payload?.data?.url

  if (!url || typeof url !== 'string') {
    return jsonError(
      'Checkout did not come back with a link. Nothing was charged. Try again in a minute.',
      502
    )
  }

  return NextResponse.json({ data: { url }, error: null })
}

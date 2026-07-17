// CANONICAL: PortalPulse billing status route (GET /api/billing/status).
// Read-only view of the caller's own subscription, plan limits and current
// usage, for the dashboard's plan card and usage meter. Subscription rows
// are written only by the central payments webhook (service role); RLS
// gives the signed-in owner read access and nothing more.
// rate-limit-exempt: read-only GET of the caller's own billing state; no
// writes, no money, no model tokens.
//
// Response:
//   200 -> { data: { subscription, plan, usage }, error: null }
//   401 -> { data: null, error: string }

import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createSupabaseAdminClient } from '@/lib/supabase/admin'
import { countParsedEmailsThisMonth } from '@/lib/db/plans'

export const dynamic = 'force-dynamic'

export async function GET() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json(
      { data: null, error: 'Please sign in to see your billing status.' },
      { status: 401 }
    )
  }

  const { data: subscription } = await supabase
    .from('portalpulse_subscriptions')
    .select('plan, status, current_period_end, cancel_at_period_end')
    .eq('user_id', user.id)
    .maybeSingle()

  // The signup trigger seeds a free-plan row; if it is somehow missing, we
  // still answer with sane free-plan defaults instead of an error.
  const planSlug = subscription?.plan ?? 'free'

  const { data: plan } = await supabase
    .from('portalpulse_plans')
    .select('slug, name, description, price_monthly_cents, price_yearly_cents, max_gcs, max_emails_per_month')
    .eq('slug', planSlug)
    .maybeSingle()

  // GC usage is RLS-scoped to this user. Email usage reuses the authoritative
  // quota count from lib/db/plans (parsed + processing this UTC month) via the
  // admin client, scoped to user.id, so the meter always matches enforcement.
  const { count: gcCount } = await supabase
    .from('portalpulse_gcs')
    .select('id', { count: 'exact', head: true })

  const admin = createSupabaseAdminClient()
  const emailCount = await countParsedEmailsThisMonth(admin, user.id)

  return NextResponse.json({
    data: {
      subscription: {
        plan: planSlug,
        status: subscription?.status ?? 'active',
        current_period_end: subscription?.current_period_end ?? null,
        cancel_at_period_end: subscription?.cancel_at_period_end ?? false,
      },
      plan: plan ?? null,
      usage: {
        gcs: gcCount ?? 0,
        emails_this_month: emailCount ?? 0,
      },
    },
    error: null,
  })
}

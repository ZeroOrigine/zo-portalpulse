// CANONICAL plan limit resolution for PortalPulse.
// portalpulse_plans rows are the single source of truth for limits, so API
// gating, error copy, and marketing copy can never drift apart.
// A paid plan only counts while the subscription is active or trialing; any
// other status falls back to Free limits so lapsed cards stop parser spend.
import type { SupabaseClient } from '@supabase/supabase-js';

export interface PlanLimits {
  planSlug: string;
  planName: string;
  maxGcs: number | null;
  maxEmailsPerMonth: number | null;
  subscriptionStatus: string;
}

const FREE_PLAN_FALLBACK: PlanLimits = {
  planSlug: 'free',
  planName: 'Free',
  maxGcs: 2,
  maxEmailsPerMonth: 10,
  subscriptionStatus: 'active',
};

const BENEFIT_STATUSES = ['active', 'trialing'];

export async function getPlanLimits(admin: SupabaseClient, userId: string): Promise<PlanLimits> {
  const { data: subscription } = await admin
    .from('portalpulse_subscriptions')
    .select('plan, status')
    .eq('user_id', userId)
    .eq('product_id', 'portalpulse')
    .maybeSingle();

  const subscriptionStatus = (subscription?.status as string | undefined) ?? 'active';
  const subscribedPlan = (subscription?.plan as string | undefined) ?? 'free';
  const effectiveSlug = BENEFIT_STATUSES.includes(subscriptionStatus) ? subscribedPlan : 'free';

  const { data: plan } = await admin
    .from('portalpulse_plans')
    .select('slug, name, max_gcs, max_emails_per_month')
    .eq('slug', effectiveSlug)
    .maybeSingle();

  if (!plan) {
    return { ...FREE_PLAN_FALLBACK, subscriptionStatus };
  }

  return {
    planSlug: plan.slug as string,
    planName: plan.name as string,
    maxGcs: plan.max_gcs as number | null,
    maxEmailsPerMonth: plan.max_emails_per_month as number | null,
    subscriptionStatus,
  };
}

export async function countGcs(admin: SupabaseClient, userId: string): Promise<number> {
  const { count } = await admin
    .from('portalpulse_gcs')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', userId)
    .eq('product_id', 'portalpulse');
  return count ?? 0;
}

export function currentMonthStartIso(): string {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)).toISOString();
}

// Counts emails parsed this UTC month, plus emails currently mid parse this
// month, so a burst of forwards cannot race past the monthly cap.
export async function countParsedEmailsThisMonth(admin: SupabaseClient, userId: string): Promise<number> {
  const monthStart = currentMonthStartIso();
  const { count } = await admin
    .from('portalpulse_emails')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', userId)
    .eq('product_id', 'portalpulse')
    .or(
      `and(parse_status.eq.parsed,parsed_at.gte.${monthStart}),and(parse_status.eq.processing,created_at.gte.${monthStart})`
    );
  return count ?? 0;
}

// CANONICAL API route: the signed-in account view.
// GET   /api/me    profile, forwarding address, subscription, plan, live usage vs limits
// PATCH /api/me    update display fields (full_name, company_name, trade, timezone);
//                  role and inbound_token stay server managed by column grants
import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';
import { rateLimitCheck, clientIp } from '@/lib/rate-limit';
import { jsonError, jsonOk, readJsonBody, requireUser, validationError } from '@/lib/db/api';
import { createSupabaseAdminClient } from '@/lib/supabase/admin';
import { countGcs, countParsedEmailsThisMonth, getPlanLimits } from '@/lib/db/plans';
import { forwardingAddressForToken } from '@/lib/db/inbound';
import { PLAN_COLUMNS, PROFILE_COLUMNS, SUBSCRIPTION_COLUMNS } from '@/lib/db/types';
import type { PlanRow, ProfileRow, SubscriptionRow } from '@/lib/db/types';

export const dynamic = 'force-dynamic';

function isValidTimezone(value: string): boolean {
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: value });
    return true;
  } catch {
    return false;
  }
}

const updateProfileSchema = z
  .object({
    full_name: z.string().trim().max(120, 'Keep your name under 120 characters.').optional(),
    company_name: z.string().trim().max(160, 'Keep the company name under 160 characters.').optional(),
    trade: z.string().trim().max(80, 'Keep the trade under 80 characters.').optional(),
    timezone: z
      .string()
      .trim()
      .min(1, 'Pick a timezone.')
      .max(64, 'That timezone id is too long.')
      .refine(isValidTimezone, { message: 'Use an IANA timezone id like America/Chicago.' })
      .optional(),
  })
  .refine((value) => Object.keys(value).length > 0, { message: 'Send at least one field to update.' });

export async function GET(_request: NextRequest) {
  try {
    const auth = await requireUser();
    if ('response' in auth) return auth.response;

    const admin = createSupabaseAdminClient();

    let { data: profileData } = await auth.supabase
      .from('portalpulse_profiles')
      .select(PROFILE_COLUMNS)
      .eq('id', auth.user.id)
      .maybeSingle();

    if (!profileData) {
      // Self-heal: the signup trigger creates this row; heal if a race dropped it.
      await admin
        .from('portalpulse_profiles')
        .upsert({ id: auth.user.id, email: auth.user.email ?? null }, { onConflict: 'id', ignoreDuplicates: true });
      const retry = await auth.supabase
        .from('portalpulse_profiles')
        .select(PROFILE_COLUMNS)
        .eq('id', auth.user.id)
        .maybeSingle();
      profileData = retry.data;
    }

    if (!profileData) {
      return jsonError('We could not load your profile. Sign out and back in, then try again.', 'profile_missing', 500);
    }
    const profile = profileData as unknown as ProfileRow;

    const { data: subscriptionData } = await auth.supabase
      .from('portalpulse_subscriptions')
      .select(SUBSCRIPTION_COLUMNS)
      .eq('user_id', auth.user.id)
      .maybeSingle();
    const subscription: SubscriptionRow = (subscriptionData as unknown as SubscriptionRow | null) ?? {
      plan: 'free',
      status: 'active',
      current_period_end: null,
      cancel_at_period_end: false,
    };

    const { data: planData } = await auth.supabase
      .from('portalpulse_plans')
      .select(PLAN_COLUMNS)
      .eq('slug', subscription.plan)
      .maybeSingle();

    const limits = await getPlanLimits(admin, auth.user.id);
    const [gcCount, parsedThisMonth, failedEmailsResult, handledResult] = await Promise.all([
      countGcs(admin, auth.user.id),
      countParsedEmailsThisMonth(admin, auth.user.id),
      admin
        .from('portalpulse_emails')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', auth.user.id)
        .eq('parse_status', 'failed'),
      admin
        .from('portalpulse_deadlines')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', auth.user.id)
        .eq('status', 'completed'),
    ]);

    return jsonOk({
      profile,
      forwarding_address: forwardingAddressForToken(profile.inbound_token),
      subscription,
      plan: (planData as unknown as PlanRow | null) ?? null,
      usage: {
        gcs: gcCount,
        parsed_emails_this_month: parsedThisMonth,
        failed_email_count: failedEmailsResult.count ?? 0,
        handled_total: handledResult.count ?? 0,
      },
      limits: {
        effective_plan: limits.planSlug,
        max_gcs: limits.maxGcs,
        max_emails_per_month: limits.maxEmailsPerMonth,
      },
    });
  } catch (unexpectedError) {
    console.error('[api/me] GET crashed', unexpectedError);
    return jsonError('We could not load your account. Please try again.', 'internal_error', 500);
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const verdict = await rateLimitCheck('portalpulse_write', clientIp(request), 240, 5000);
    if (!verdict.allowed) {
      return NextResponse.json(
        { data: null, error: 'Too many requests for today. The counter resets tomorrow.' },
        { status: 429 }
      );
    }

    const auth = await requireUser();
    if ('response' in auth) return auth.response;

    const bodyResult = await readJsonBody(request);
    if ('response' in bodyResult) return bodyResult.response;

    const parsed = updateProfileSchema.safeParse(bodyResult.body);
    if (!parsed.success) return validationError(parsed.error);

    const updatePayload: Record<string, unknown> = {};
    if (parsed.data.full_name !== undefined) updatePayload.full_name = parsed.data.full_name;
    if (parsed.data.company_name !== undefined) updatePayload.company_name = parsed.data.company_name;
    if (parsed.data.trade !== undefined) updatePayload.trade = parsed.data.trade;
    if (parsed.data.timezone !== undefined) updatePayload.timezone = parsed.data.timezone;

    const { data: updatedProfile, error: updateError } = await auth.supabase
      .from('portalpulse_profiles')
      .update(updatePayload)
      .eq('id', auth.user.id)
      .select(PROFILE_COLUMNS)
      .maybeSingle();

    if (updateError) {
      console.error('[api/me] update failed', updateError.message);
      return jsonError('We hit a snag saving your profile. Please try again.', 'internal_error', 500);
    }
    if (!updatedProfile) {
      return jsonError('We could not load your profile. Sign out and back in, then try again.', 'profile_missing', 500);
    }
    return jsonOk(updatedProfile as unknown as ProfileRow);
  } catch (unexpectedError) {
    console.error('[api/me] PATCH crashed', unexpectedError);
    return jsonError('We hit a snag saving your profile. Please try again.', 'internal_error', 500);
  }
}

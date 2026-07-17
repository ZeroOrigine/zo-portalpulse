// CANONICAL API route: run (or re-run) AI parsing on one forwarded email.
// POST /api/emails/:id/parse
// Spends model tokens, so it uses its own tighter rate-limit bucket and
// enforces the plan's monthly parsed-email limit before doing any work.
import { NextResponse, type NextRequest } from 'next/server';
import { rateLimitCheck, clientIp } from '@/lib/rate-limit';
import { invalidIdResponse, isValidUuid, jsonError, jsonOk, requireUser } from '@/lib/db/api';
import { createSupabaseAdminClient } from '@/lib/supabase/admin';
import { countParsedEmailsThisMonth, getPlanLimits } from '@/lib/db/plans';
import { parseEmailIntoDeadlines } from '@/lib/db/deadline-parser';
import { EMAIL_LIST_COLUMNS } from '@/lib/db/types';
import type { EmailListRow, ParseStatus } from '@/lib/db/types';

export const dynamic = 'force-dynamic';

interface RouteContext {
  params: { id: string };
}

interface EmailForParsing {
  id: string;
  gc_id: string | null;
  subject: string;
  body_text: string;
  from_address: string;
  received_at: string;
  parse_status: ParseStatus;
  updated_at: string;
}

const STALE_PROCESSING_MS = 5 * 60 * 1000;

export async function POST(request: NextRequest, context: RouteContext) {
  try {
    const verdict = await rateLimitCheck('portalpulse_parse', clientIp(request), 60, 1200);
    if (!verdict.allowed) {
      return NextResponse.json(
        { data: null, error: 'Too many requests for today. The counter resets tomorrow.' },
        { status: 429 }
      );
    }

    if (!isValidUuid(context.params.id)) return invalidIdResponse();

    const auth = await requireUser();
    if ('response' in auth) return auth.response;

    const { data: emailData, error: emailError } = await auth.supabase
      .from('portalpulse_emails')
      .select('id, gc_id, subject, body_text, from_address, received_at, parse_status, updated_at')
      .eq('id', context.params.id)
      .maybeSingle();

    if (emailError) {
      console.error('[api/emails/:id/parse] fetch failed', emailError.message);
      return jsonError('We could not load that email. Please try again.', 'internal_error', 500);
    }
    if (!emailData) {
      return jsonError('We could not find that email.', 'not_found', 404);
    }
    const email = emailData as unknown as EmailForParsing;

    if (email.parse_status === 'processing') {
      const lastTouched = new Date(email.updated_at).getTime();
      if (Number.isFinite(lastTouched) && Date.now() - lastTouched < STALE_PROCESSING_MS) {
        return jsonError('This email is already being parsed. Give it a few seconds, then refresh.', 'parse_in_progress', 409);
      }
      // Stale processing rows (a crashed run) fall through and get retried.
    }

    const admin = createSupabaseAdminClient();
    const limits = await getPlanLimits(admin, auth.user.id);
    // Re-parsing an already parsed email adds nothing to the monthly count,
    // so only net new parses are gated here.
    if (limits.maxEmailsPerMonth !== null && email.parse_status !== 'parsed') {
      const parsedThisMonth = await countParsedEmailsThisMonth(admin, auth.user.id);
      if (parsedThisMonth >= limits.maxEmailsPerMonth) {
        return jsonError(
          `Your ${limits.planName} plan parses up to ${limits.maxEmailsPerMonth} forwarded emails per month. Upgrade to Pro for unlimited parsing.`,
          'plan_limit_reached',
          403
        );
      }
    }

    const { error: markError } = await auth.supabase
      .from('portalpulse_emails')
      .update({ parse_status: 'processing', parse_error: null })
      .eq('id', email.id);
    if (markError) {
      console.error('[api/emails/:id/parse] mark processing failed', markError.message);
      return jsonError('We could not start parsing. Please try again.', 'internal_error', 500);
    }

    const { data: profile } = await auth.supabase
      .from('portalpulse_profiles')
      .select('timezone')
      .eq('id', auth.user.id)
      .maybeSingle();
    const timezone = (profile?.timezone as string | undefined) ?? 'America/New_York';

    try {
      const deadlines = await parseEmailIntoDeadlines(admin, {
        emailId: email.id,
        userId: auth.user.id,
        gcId: email.gc_id,
        subject: email.subject,
        bodyText: email.body_text,
        fromAddress: email.from_address,
        receivedAt: email.received_at,
        timezone,
      });

      const { data: refreshedEmail } = await auth.supabase
        .from('portalpulse_emails')
        .select(EMAIL_LIST_COLUMNS)
        .eq('id', email.id)
        .maybeSingle();

      return jsonOk({
        email: (refreshedEmail ?? null) as EmailListRow | null,
        deadlines,
        created: deadlines.length,
      });
    } catch (parseFailure) {
      console.error('[api/emails/:id/parse] parse failed', parseFailure instanceof Error ? parseFailure.message : parseFailure);
      await admin
        .from('portalpulse_emails')
        .update({
          parse_status: 'failed',
          parse_error: 'We could not pull deadlines out of this email automatically. Add the deadline manually or try parsing again.',
        })
        .eq('id', email.id)
        .eq('user_id', auth.user.id);
      return jsonError(
        'We could not pull deadlines from this email right now. Try again in a minute or add the deadline manually.',
        'parse_failed',
        502
      );
    }
  } catch (unexpectedError) {
    console.error('[api/emails/:id/parse] POST crashed', unexpectedError);
    return jsonError('We could not parse that email right now. Please try again.', 'internal_error', 500);
  }
}

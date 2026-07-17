// CANONICAL API route: single forwarded email operations.
// GET    /api/emails/:id     full email (with body) plus the deadlines pulled from it
// DELETE /api/emails/:id     remove the stored email; extracted deadlines stay on the
//                            calendar with email_id set to null by the foreign key
import { NextResponse, type NextRequest } from 'next/server';
import { rateLimitCheck, clientIp } from '@/lib/rate-limit';
import { invalidIdResponse, isValidUuid, jsonError, jsonOk, requireUser } from '@/lib/db/api';
import { DEADLINE_COLUMNS, EMAIL_DETAIL_COLUMNS } from '@/lib/db/types';
import type { DeadlineRow, EmailDetailWithRelations } from '@/lib/db/types';

export const dynamic = 'force-dynamic';

interface RouteContext {
  params: { id: string };
}

export async function GET(_request: NextRequest, context: RouteContext) {
  try {
    if (!isValidUuid(context.params.id)) return invalidIdResponse();

    const auth = await requireUser();
    if ('response' in auth) return auth.response;

    const { data: email, error: emailError } = await auth.supabase
      .from('portalpulse_emails')
      .select(
        `${EMAIL_DETAIL_COLUMNS}, gc:portalpulse_gcs(id, name, color), portal_vendor:portalpulse_portal_vendors(id, name, slug)`
      )
      .eq('id', context.params.id)
      .maybeSingle();

    if (emailError) {
      console.error('[api/emails/:id] fetch failed', emailError.message);
      return jsonError('We could not load that email. Please try again.', 'internal_error', 500);
    }
    if (!email) {
      return jsonError('We could not find that email.', 'not_found', 404);
    }

    const { data: deadlines, error: deadlinesError } = await auth.supabase
      .from('portalpulse_deadlines')
      .select(DEADLINE_COLUMNS)
      .eq('email_id', context.params.id)
      .order('due_at', { ascending: true });

    if (deadlinesError) {
      console.error('[api/emails/:id] deadlines fetch failed', deadlinesError.message);
      return jsonError('We could not load that email. Please try again.', 'internal_error', 500);
    }

    return jsonOk({
      email: email as unknown as EmailDetailWithRelations,
      deadlines: (deadlines ?? []) as unknown as DeadlineRow[],
    });
  } catch (unexpectedError) {
    console.error('[api/emails/:id] GET crashed', unexpectedError);
    return jsonError('We could not load that email. Please try again.', 'internal_error', 500);
  }
}

export async function DELETE(request: NextRequest, context: RouteContext) {
  try {
    const verdict = await rateLimitCheck('portalpulse_write', clientIp(request), 240, 5000);
    if (!verdict.allowed) {
      return NextResponse.json(
        { data: null, error: 'Too many requests for today. The counter resets tomorrow.' },
        { status: 429 }
      );
    }

    if (!isValidUuid(context.params.id)) return invalidIdResponse();

    const auth = await requireUser();
    if ('response' in auth) return auth.response;

    const { data: deletedEmail, error: deleteError } = await auth.supabase
      .from('portalpulse_emails')
      .delete()
      .eq('id', context.params.id)
      .select('id')
      .maybeSingle();

    if (deleteError) {
      console.error('[api/emails/:id] delete failed', deleteError.message);
      return jsonError('We could not remove that email. Please try again.', 'internal_error', 500);
    }
    if (!deletedEmail) {
      return jsonError('We could not find that email.', 'not_found', 404);
    }
    return jsonOk({ deleted: true, id: context.params.id });
  } catch (unexpectedError) {
    console.error('[api/emails/:id] DELETE crashed', unexpectedError);
    return jsonError('We could not remove that email. Please try again.', 'internal_error', 500);
  }
}

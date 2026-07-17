// CANONICAL API route: single deadline operations.
// GET    /api/deadlines/:id     fetch one deadline with its GC summary
// PATCH  /api/deadlines/:id     edit fields or move status (complete, dismiss, reopen)
//                               completed_at is stamped by a database trigger
// DELETE /api/deadlines/:id     remove the deadline
import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';
import { rateLimitCheck, clientIp } from '@/lib/rate-limit';
import {
  invalidIdResponse,
  isValidUuid,
  jsonError,
  jsonOk,
  readJsonBody,
  requireUser,
  validationError,
} from '@/lib/db/api';
import { DEADLINE_COLUMNS, DEADLINE_STATUSES, DEADLINE_TYPES } from '@/lib/db/types';
import type { DeadlineRow } from '@/lib/db/types';

export const dynamic = 'force-dynamic';

interface RouteContext {
  params: { id: string };
}

const updateDeadlineSchema = z
  .object({
    title: z.string().trim().min(1, 'Give this deadline a title.').max(200, 'Keep the title under 200 characters.').optional(),
    details: z.string().trim().max(2000, 'Keep details under 2000 characters.').optional(),
    deadline_type: z.enum(DEADLINE_TYPES, { errorMap: () => ({ message: 'Pick a deadline type from the list.' }) }).optional(),
    status: z.enum(DEADLINE_STATUSES, { errorMap: () => ({ message: 'status must be upcoming, completed, missed, or dismissed.' }) }).optional(),
    due_at: z.string().datetime({ offset: true, message: 'Use an ISO 8601 datetime like 2026-08-01T17:00:00Z.' }).optional(),
    gc_id: z.string().uuid('Pick a GC from your list.').nullable().optional(),
  })
  .refine((value) => Object.keys(value).length > 0, { message: 'Send at least one field to update.' });

export async function GET(_request: NextRequest, context: RouteContext) {
  try {
    if (!isValidUuid(context.params.id)) return invalidIdResponse();

    const auth = await requireUser();
    if ('response' in auth) return auth.response;

    const { data: deadline, error } = await auth.supabase
      .from('portalpulse_deadlines')
      .select(`${DEADLINE_COLUMNS}, gc:portalpulse_gcs(id, name, color)`)
      .eq('id', context.params.id)
      .maybeSingle();

    if (error) {
      console.error('[api/deadlines/:id] fetch failed', error.message);
      return jsonError('We could not load that deadline. Please try again.', 'internal_error', 500);
    }
    if (!deadline) {
      return jsonError('We could not find that deadline.', 'not_found', 404);
    }
    return jsonOk(deadline);
  } catch (unexpectedError) {
    console.error('[api/deadlines/:id] GET crashed', unexpectedError);
    return jsonError('We could not load that deadline. Please try again.', 'internal_error', 500);
  }
}

export async function PATCH(request: NextRequest, context: RouteContext) {
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

    const bodyResult = await readJsonBody(request);
    if ('response' in bodyResult) return bodyResult.response;

    const parsed = updateDeadlineSchema.safeParse(bodyResult.body);
    if (!parsed.success) return validationError(parsed.error);

    if (typeof parsed.data.gc_id === 'string') {
      const { data: ownedGc } = await auth.supabase
        .from('portalpulse_gcs')
        .select('id')
        .eq('id', parsed.data.gc_id)
        .maybeSingle();
      if (!ownedGc) {
        return jsonError('That GC is not in your list. Add it first, then link the deadline.', 'validation_error', 400, {
          gc_id: 'That GC is not in your list.',
        });
      }
    }

    const updatePayload: Record<string, unknown> = {};
    if (parsed.data.title !== undefined) updatePayload.title = parsed.data.title;
    if (parsed.data.details !== undefined) updatePayload.details = parsed.data.details;
    if (parsed.data.deadline_type !== undefined) updatePayload.deadline_type = parsed.data.deadline_type;
    if (parsed.data.status !== undefined) updatePayload.status = parsed.data.status;
    if (parsed.data.due_at !== undefined) updatePayload.due_at = parsed.data.due_at;
    if (parsed.data.gc_id !== undefined) updatePayload.gc_id = parsed.data.gc_id;

    const { data: updatedDeadline, error: updateError } = await auth.supabase
      .from('portalpulse_deadlines')
      .update(updatePayload)
      .eq('id', context.params.id)
      .select(DEADLINE_COLUMNS)
      .maybeSingle();

    if (updateError) {
      console.error('[api/deadlines/:id] update failed', updateError.message);
      return jsonError('We hit a snag saving that change. Please try again.', 'internal_error', 500);
    }
    if (!updatedDeadline) {
      return jsonError('We could not find that deadline.', 'not_found', 404);
    }
    return jsonOk(updatedDeadline as unknown as DeadlineRow);
  } catch (unexpectedError) {
    console.error('[api/deadlines/:id] PATCH crashed', unexpectedError);
    return jsonError('We hit a snag saving that change. Please try again.', 'internal_error', 500);
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

    const { data: deletedDeadline, error: deleteError } = await auth.supabase
      .from('portalpulse_deadlines')
      .delete()
      .eq('id', context.params.id)
      .select('id')
      .maybeSingle();

    if (deleteError) {
      console.error('[api/deadlines/:id] delete failed', deleteError.message);
      return jsonError('We could not remove that deadline. Please try again.', 'internal_error', 500);
    }
    if (!deletedDeadline) {
      return jsonError('We could not find that deadline.', 'not_found', 404);
    }
    return jsonOk({ deleted: true, id: context.params.id });
  } catch (unexpectedError) {
    console.error('[api/deadlines/:id] DELETE crashed', unexpectedError);
    return jsonError('We could not remove that deadline. Please try again.', 'internal_error', 500);
  }
}

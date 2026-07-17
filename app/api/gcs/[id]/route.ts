// CANONICAL API route: single GC operations.
// GET    /api/gcs/:id     fetch one GC
// PATCH  /api/gcs/:id     update name, portal, contact email, or color
// DELETE /api/gcs/:id     remove the GC; linked emails and deadlines stay, unlinked
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
import { GC_COLUMNS } from '@/lib/db/types';
import type { GcRow } from '@/lib/db/types';

export const dynamic = 'force-dynamic';

interface RouteContext {
  params: { id: string };
}

const updateGcSchema = z
  .object({
    name: z
      .string()
      .trim()
      .min(1, 'Give this GC a name so you can spot it on your calendar.')
      .max(120, 'Keep the GC name under 120 characters.')
      .optional(),
    portal_vendor_id: z.string().uuid('Pick a portal from the list.').nullable().optional(),
    contact_email: z
      .string()
      .trim()
      .email('That contact email does not look quite right. Mind checking it?')
      .max(320, 'That email address is too long.')
      .nullable()
      .optional(),
    color: z.string().regex(/^#[0-9a-fA-F]{6}$/, 'Pick a color like #2563eb.').optional(),
  })
  .refine((value) => Object.keys(value).length > 0, { message: 'Send at least one field to update.' });

export async function GET(_request: NextRequest, context: RouteContext) {
  try {
    if (!isValidUuid(context.params.id)) return invalidIdResponse();

    const auth = await requireUser();
    if ('response' in auth) return auth.response;

    const { data: gc, error } = await auth.supabase
      .from('portalpulse_gcs')
      .select(`${GC_COLUMNS}, portal_vendor:portalpulse_portal_vendors(id, name, slug)`)
      .eq('id', context.params.id)
      .maybeSingle();

    if (error) {
      console.error('[api/gcs/:id] fetch failed', error.message);
      return jsonError('We could not load that GC. Please try again.', 'internal_error', 500);
    }
    if (!gc) {
      return jsonError('We could not find that GC in your list.', 'not_found', 404);
    }
    return jsonOk(gc);
  } catch (unexpectedError) {
    console.error('[api/gcs/:id] GET crashed', unexpectedError);
    return jsonError('We could not load that GC. Please try again.', 'internal_error', 500);
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

    const parsed = updateGcSchema.safeParse(bodyResult.body);
    if (!parsed.success) return validationError(parsed.error);

    if (typeof parsed.data.portal_vendor_id === 'string') {
      const { data: vendor } = await auth.supabase
        .from('portalpulse_portal_vendors')
        .select('id')
        .eq('id', parsed.data.portal_vendor_id)
        .maybeSingle();
      if (!vendor) {
        return jsonError('Pick a portal from the list.', 'validation_error', 400, {
          portal_vendor_id: 'Pick a portal from the list.',
        });
      }
    }

    const updatePayload: Record<string, unknown> = {};
    if (parsed.data.name !== undefined) updatePayload.name = parsed.data.name;
    if (parsed.data.portal_vendor_id !== undefined) updatePayload.portal_vendor_id = parsed.data.portal_vendor_id;
    if (parsed.data.contact_email !== undefined) updatePayload.contact_email = parsed.data.contact_email;
    if (parsed.data.color !== undefined) updatePayload.color = parsed.data.color;

    const { data: updatedGc, error: updateError } = await auth.supabase
      .from('portalpulse_gcs')
      .update(updatePayload)
      .eq('id', context.params.id)
      .select(GC_COLUMNS)
      .maybeSingle();

    if (updateError) {
      console.error('[api/gcs/:id] update failed', updateError.message);
      return jsonError('We hit a snag saving that change. Please try again.', 'internal_error', 500);
    }
    if (!updatedGc) {
      return jsonError('We could not find that GC in your list.', 'not_found', 404);
    }
    return jsonOk(updatedGc as unknown as GcRow);
  } catch (unexpectedError) {
    console.error('[api/gcs/:id] PATCH crashed', unexpectedError);
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

    // Foreign keys are ON DELETE SET NULL, so deadlines and emails linked to
    // this GC stay on the calendar, just without the GC label.
    const { data: deletedGc, error: deleteError } = await auth.supabase
      .from('portalpulse_gcs')
      .delete()
      .eq('id', context.params.id)
      .select('id')
      .maybeSingle();

    if (deleteError) {
      console.error('[api/gcs/:id] delete failed', deleteError.message);
      return jsonError('We could not remove that GC. Please try again.', 'internal_error', 500);
    }
    if (!deletedGc) {
      return jsonError('We could not find that GC in your list.', 'not_found', 404);
    }
    return jsonOk({ deleted: true, id: context.params.id });
  } catch (unexpectedError) {
    console.error('[api/gcs/:id] DELETE crashed', unexpectedError);
    return jsonError('We could not remove that GC. Please try again.', 'internal_error', 500);
  }
}

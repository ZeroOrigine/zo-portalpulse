// CANONICAL API route: list and create GCs (the general contractors a sub works with).
// GET  /api/gcs?page=&limit=            list, alphabetical, with portal vendor summary
// POST /api/gcs                          create, gated by the plan max_gcs limit
import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';
import { rateLimitCheck, clientIp } from '@/lib/rate-limit';
import {
  jsonError,
  jsonOk,
  parsePagination,
  readJsonBody,
  requireUser,
  validationError,
} from '@/lib/db/api';
import { createSupabaseAdminClient } from '@/lib/supabase/admin';
import { countGcs, getPlanLimits } from '@/lib/db/plans';
import { GC_COLUMNS } from '@/lib/db/types';
import type { GcRow, GcWithVendor, Paginated } from '@/lib/db/types';

export const dynamic = 'force-dynamic';

const createGcSchema = z.object({
  name: z
    .string({ required_error: 'Give this GC a name so you can spot it on your calendar.' })
    .trim()
    .min(1, 'Give this GC a name so you can spot it on your calendar.')
    .max(120, 'Keep the GC name under 120 characters.'),
  portal_vendor_id: z.string().uuid('Pick a portal from the list.').nullable().optional(),
  contact_email: z
    .string()
    .trim()
    .email('That contact email does not look quite right. Mind checking it?')
    .max(320, 'That email address is too long.')
    .nullable()
    .optional(),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/, 'Pick a color like #2563eb.').optional(),
});

export async function GET(request: NextRequest) {
  try {
    const auth = await requireUser();
    if ('response' in auth) return auth.response;

    const pagination = parsePagination(request.nextUrl.searchParams);
    const { data, error, count } = await auth.supabase
      .from('portalpulse_gcs')
      .select(`${GC_COLUMNS}, portal_vendor:portalpulse_portal_vendors(id, name, slug)`, { count: 'exact' })
      .order('name', { ascending: true })
      .range(pagination.rangeFrom, pagination.rangeTo);

    if (error) {
      console.error('[api/gcs] list failed', error.message);
      return jsonError('We could not load your GCs. Please try again.', 'internal_error', 500);
    }

    const payload: Paginated<GcWithVendor> = {
      items: (data ?? []) as unknown as GcWithVendor[],
      page: pagination.page,
      limit: pagination.limit,
      total: count ?? 0,
    };
    return jsonOk(payload);
  } catch (unexpectedError) {
    console.error('[api/gcs] GET crashed', unexpectedError);
    return jsonError('We could not load your GCs. Please try again.', 'internal_error', 500);
  }
}

export async function POST(request: NextRequest) {
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

    const parsed = createGcSchema.safeParse(bodyResult.body);
    if (!parsed.success) return validationError(parsed.error);

    const admin = createSupabaseAdminClient();
    const limits = await getPlanLimits(admin, auth.user.id);
    if (limits.maxGcs !== null) {
      const existingGcCount = await countGcs(admin, auth.user.id);
      if (existingGcCount >= limits.maxGcs) {
        return jsonError(
          `Your ${limits.planName} plan tracks up to ${limits.maxGcs} GCs. Upgrade to Pro for unlimited GCs.`,
          'plan_limit_reached',
          403
        );
      }
    }

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

    const insertPayload: Record<string, unknown> = {
      user_id: auth.user.id,
      name: parsed.data.name,
      portal_vendor_id: parsed.data.portal_vendor_id ?? null,
      contact_email: parsed.data.contact_email ?? null,
    };
    if (parsed.data.color) {
      insertPayload.color = parsed.data.color;
    }

    const { data: createdGc, error: insertError } = await auth.supabase
      .from('portalpulse_gcs')
      .insert(insertPayload)
      .select(GC_COLUMNS)
      .single();

    if (insertError) {
      console.error('[api/gcs] insert failed', insertError.message);
      return jsonError('We hit a snag saving that GC. Please try again.', 'internal_error', 500);
    }

    return jsonOk(createdGc as unknown as GcRow, 201);
  } catch (unexpectedError) {
    console.error('[api/gcs] POST crashed', unexpectedError);
    return jsonError('We hit a snag saving that GC. Please try again.', 'internal_error', 500);
  }
}

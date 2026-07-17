// CANONICAL API route: list forwarded portal emails.
// GET /api/emails?parse_status=&gc_id=&page=&limit=
// Newest first, backed by the (user_id, received_at DESC) index.
// body_text is deliberately excluded here; fetch a single email for the full body.
import type { NextRequest } from 'next/server';
import { z } from 'zod';
import { jsonError, jsonOk, parsePagination, requireUser, validationError } from '@/lib/db/api';
import { EMAIL_LIST_COLUMNS, PARSE_STATUSES } from '@/lib/db/types';
import type { EmailWithRelations, Paginated } from '@/lib/db/types';

export const dynamic = 'force-dynamic';

const listEmailsQuerySchema = z.object({
  parse_status: z
    .enum(PARSE_STATUSES, { errorMap: () => ({ message: 'parse_status must be pending, processing, parsed, failed, or ignored.' }) })
    .optional(),
  gc_id: z.string().uuid('gc_id must be a valid id.').optional(),
});

export async function GET(request: NextRequest) {
  try {
    const auth = await requireUser();
    if ('response' in auth) return auth.response;

    const searchParams = request.nextUrl.searchParams;
    const parsedQuery = listEmailsQuerySchema.safeParse({
      parse_status: searchParams.get('parse_status') ?? undefined,
      gc_id: searchParams.get('gc_id') ?? undefined,
    });
    if (!parsedQuery.success) return validationError(parsedQuery.error);

    const pagination = parsePagination(searchParams);
    let query = auth.supabase
      .from('portalpulse_emails')
      .select(
        `${EMAIL_LIST_COLUMNS}, gc:portalpulse_gcs(id, name, color), portal_vendor:portalpulse_portal_vendors(id, name, slug)`,
        { count: 'exact' }
      );

    if (parsedQuery.data.parse_status) query = query.eq('parse_status', parsedQuery.data.parse_status);
    if (parsedQuery.data.gc_id) query = query.eq('gc_id', parsedQuery.data.gc_id);

    const { data, error, count } = await query
      .order('received_at', { ascending: false })
      .range(pagination.rangeFrom, pagination.rangeTo);

    if (error) {
      console.error('[api/emails] list failed', error.message);
      return jsonError('We could not load your forwarded emails. Please try again.', 'internal_error', 500);
    }

    const payload: Paginated<EmailWithRelations> = {
      items: (data ?? []) as unknown as EmailWithRelations[],
      page: pagination.page,
      limit: pagination.limit,
      total: count ?? 0,
    };
    return jsonOk(payload);
  } catch (unexpectedError) {
    console.error('[api/emails] GET crashed', unexpectedError);
    return jsonError('We could not load your forwarded emails. Please try again.', 'internal_error', 500);
  }
}

// CANONICAL API route: portal vendor reference list (GCPay, Oracle Textura,
// Procore, Buildbite, Other). Read only for signed-in users; seeded rows are
// managed by the service role.
// GET /api/portal-vendors?page=&limit=
import type { NextRequest } from 'next/server';
import { jsonError, jsonOk, parsePagination, requireUser } from '@/lib/db/api';
import { PORTAL_VENDOR_COLUMNS } from '@/lib/db/types';
import type { Paginated, PortalVendorRow } from '@/lib/db/types';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const auth = await requireUser();
    if ('response' in auth) return auth.response;

    const pagination = parsePagination(request.nextUrl.searchParams);
    const { data, error, count } = await auth.supabase
      .from('portalpulse_portal_vendors')
      .select(PORTAL_VENDOR_COLUMNS, { count: 'exact' })
      .order('name', { ascending: true })
      .range(pagination.rangeFrom, pagination.rangeTo);

    if (error) {
      console.error('[api/portal-vendors] list failed', error.message);
      return jsonError('We could not load the portal list. Please try again.', 'internal_error', 500);
    }

    const payload: Paginated<PortalVendorRow> = {
      items: (data ?? []) as unknown as PortalVendorRow[],
      page: pagination.page,
      limit: pagination.limit,
      total: count ?? 0,
    };
    return jsonOk(payload);
  } catch (unexpectedError) {
    console.error('[api/portal-vendors] GET crashed', unexpectedError);
    return jsonError('We could not load the portal list. Please try again.', 'internal_error', 500);
  }
}

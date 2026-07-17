// CANONICAL API route: rotate the dedicated forwarding address token.
// POST /api/me/rotate-token
// Used when a forwarding address leaks or starts catching spam. The old
// address stops working the moment this returns. Uses the service-role client
// because inbound_token is server managed: authenticated column grants block
// users from writing it directly, which also blocks address hijacking.
import { NextResponse, type NextRequest } from 'next/server';
import { randomUUID } from 'crypto';
import { rateLimitCheck, clientIp } from '@/lib/rate-limit';
import { jsonError, jsonOk, requireUser } from '@/lib/db/api';
import { createSupabaseAdminClient } from '@/lib/supabase/admin';
import { forwardingAddressForToken } from '@/lib/db/inbound';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

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

    const newToken = randomUUID().replace(/-/g, '');
    const admin = createSupabaseAdminClient();
    const { data: updatedProfile, error: updateError } = await admin
      .from('portalpulse_profiles')
      .update({ inbound_token: newToken })
      .eq('id', auth.user.id)
      .select('inbound_token')
      .maybeSingle();

    if (updateError || !updatedProfile) {
      console.error('[api/me/rotate-token] update failed', updateError?.message);
      return jsonError('We could not rotate your forwarding address. Please try again.', 'internal_error', 500);
    }

    const rotatedToken = updatedProfile.inbound_token as string;
    return jsonOk({
      inbound_token: rotatedToken,
      forwarding_address: forwardingAddressForToken(rotatedToken),
      note: 'Update your email forwarding rule to the new address. The old address stops working now.',
    });
  } catch (unexpectedError) {
    console.error('[api/me/rotate-token] POST crashed', unexpectedError);
    return jsonError('We could not rotate your forwarding address. Please try again.', 'internal_error', 500);
  }
}

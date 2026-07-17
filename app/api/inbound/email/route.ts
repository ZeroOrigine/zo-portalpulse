// CANONICAL inbound email webhook: the magic trick behind PortalPulse.
// The email provider (Postmark style JSON or SendGrid style form data) POSTs
// every message sent to u_<token>@<inbound domain>. This route maps the token
// to a user, stores the email, detects the portal vendor and GC, enforces the
// plan's monthly parse limit, then runs AI extraction inline so deadlines
// appear on the calendar seconds after the sub hits forward.
//
// Security: shared-secret verified (INBOUND_EMAIL_WEBHOOK_SECRET, timing safe)
// AND rate limited, because this route spends model tokens.
// Responses: 200 tells the provider to stop retrying; 5xx asks it to retry.
import { NextResponse, type NextRequest } from 'next/server';
import { timingSafeEqual } from 'crypto';
import { rateLimitCheck, clientIp } from '@/lib/rate-limit';
import { jsonError, jsonOk } from '@/lib/db/api';
import { createSupabaseAdminClient } from '@/lib/supabase/admin';
import { countParsedEmailsThisMonth, getPlanLimits } from '@/lib/db/plans';
import { parseEmailIntoDeadlines } from '@/lib/db/deadline-parser';
import { emailDomainOf, extractInboundToken } from '@/lib/db/inbound';
import type { SupabaseClient } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

function secretsMatch(provided: string, configured: string): boolean {
  const providedBuffer = Buffer.from(provided);
  const configuredBuffer = Buffer.from(configured);
  if (providedBuffer.length !== configuredBuffer.length) return false;
  return timingSafeEqual(providedBuffer, configuredBuffer);
}

function firstString(payload: Record<string, unknown>, keys: string[]): string {
  for (const key of keys) {
    const value = payload[key];
    if (typeof value === 'string' && value.trim()) return value.trim();
  }
  return '';
}

async function readPayload(request: NextRequest): Promise<Record<string, unknown> | null> {
  const contentType = request.headers.get('content-type') ?? '';
  if (contentType.includes('application/json')) {
    const parsed = await request.json().catch(() => null);
    return parsed && typeof parsed === 'object' ? (parsed as Record<string, unknown>) : null;
  }
  if (contentType.includes('multipart/form-data') || contentType.includes('application/x-www-form-urlencoded')) {
    const formData = await request.formData().catch(() => null);
    if (!formData) return null;
    const payload: Record<string, unknown> = {};
    formData.forEach((value, key) => {
      if (typeof value === 'string') payload[key] = value;
    });
    return payload;
  }
  return null;
}

// QA-008: match the sender domain inside Postgres instead of loading every
// vendor row and scanning it in JS. The domain expands into its dot-suffix
// candidates (mail.procore.com -> mail.procore.com, procore.com, com) and the
// database returns only vendors whose email_domains array intersects them
// (array overlap && is served by the same GIN index as @>), so this stays one
// indexed query no matter how large the vendor table grows.
async function detectPortalVendorId(admin: SupabaseClient, fromDomain: string | null): Promise<string | null> {
  if (!fromDomain) return null;
  // The From header is attacker controlled; only plain hostname characters may
  // reach the filter. Anything stranger could never match a seeded domain.
  const normalizedDomain = fromDomain.toLowerCase();
  if (!/^[a-z0-9](?:[a-z0-9.-]*[a-z0-9])?$/.test(normalizedDomain)) return null;
  const labels = normalizedDomain.split('.').filter(Boolean);
  const candidates: string[] = [];
  for (let index = 0; index < labels.length; index += 1) {
    candidates.push(labels.slice(index).join('.'));
  }
  if (candidates.length === 0) return null;
  const { data: vendors, error } = await admin
    .from('portalpulse_portal_vendors')
    .select('id, email_domains')
    .overlaps('email_domains', candidates)
    .limit(5);
  if (error) {
    console.error('[api/inbound/email] vendor lookup failed', error.message);
    return null;
  }
  // If overlapping vendor domains ever match at once, prefer the most specific.
  let bestId: string | null = null;
  let bestLength = -1;
  for (const vendor of vendors ?? []) {
    const domains = (vendor.email_domains as string[] | null) ?? [];
    for (const domain of domains) {
      if (domain.length > bestLength && candidates.includes(domain)) {
        bestLength = domain.length;
        bestId = vendor.id as string;
      }
    }
  }
  return bestId;
}

// Anticipation: when the sender clearly maps to exactly one of the user's GCs,
// tag the email (and its deadlines) with that GC automatically.
async function detectGcId(
  admin: SupabaseClient,
  userId: string,
  fromDomain: string | null,
  portalVendorId: string | null
): Promise<string | null> {
  if (fromDomain) {
    const { data: gcsWithContact } = await admin
      .from('portalpulse_gcs')
      .select('id, contact_email')
      .eq('user_id', userId)
      .eq('product_id', 'portalpulse')
      .not('contact_email', 'is', null);
    const contactMatches = (gcsWithContact ?? []).filter(
      (gc) => emailDomainOf((gc.contact_email as string | null) ?? '') === fromDomain
    );
    if (contactMatches.length === 1) return contactMatches[0].id as string;
  }
  if (portalVendorId) {
    const { data: vendorGcs } = await admin
      .from('portalpulse_gcs')
      .select('id')
      .eq('user_id', userId)
      .eq('product_id', 'portalpulse')
      .eq('portal_vendor_id', portalVendorId)
      .limit(2);
    if (vendorGcs && vendorGcs.length === 1) return vendorGcs[0].id as string;
  }
  return null;
}

export async function POST(request: NextRequest) {
  try {
    const verdict = await rateLimitCheck('portalpulse_inbound', clientIp(request), 600, 6000);
    if (!verdict.allowed) {
      return NextResponse.json(
        { data: null, error: 'Too many requests for today. The counter resets tomorrow.' },
        { status: 429 }
      );
    }

    const configuredSecret = process.env.INBOUND_EMAIL_WEBHOOK_SECRET;
    if (!configuredSecret) {
      return jsonError('Inbound email is not set up yet.', 'not_configured', 503);
    }
    const authorizationHeader = request.headers.get('authorization') ?? '';
    const bearerSecret = authorizationHeader.toLowerCase().startsWith('bearer ')
      ? authorizationHeader.slice(7).trim()
      : '';
    const headerSecret = request.headers.get('x-inbound-secret') ?? '';
    const providedSecret = bearerSecret || headerSecret;
    if (!providedSecret || !secretsMatch(providedSecret, configuredSecret)) {
      return jsonError('That request is not authorized.', 'unauthorized', 401);
    }

    const payload = await readPayload(request);
    if (!payload) {
      return jsonError('Send JSON or form data.', 'unsupported_media_type', 415);
    }

    const toAddress = firstString(payload, ['to', 'To', 'recipient', 'OriginalRecipient', 'envelope_to']).slice(0, 320);
    const fromAddress = firstString(payload, ['from', 'From', 'sender']).slice(0, 320);
    const subject = firstString(payload, ['subject', 'Subject']).slice(0, 500);
    const bodyText = firstString(payload, ['text', 'TextBody', 'body-plain', 'plain', 'body_text']).slice(0, 20000);

    let rawMessageId = firstString(payload, ['messageId', 'MessageID', 'Message-Id', 'message-id']);
    if (!rawMessageId) {
      const rawHeaders = firstString(payload, ['headers', 'Headers']);
      const headerMatch = rawHeaders.match(/message-id:\s*<([^>]+)>/i);
      if (headerMatch) rawMessageId = headerMatch[1];
    }
    const messageId = rawMessageId.replace(/[<>]/g, '').slice(0, 255) || null;

    if (!toAddress) {
      // Malformed but permanent: a retry cannot fix a missing recipient.
      return jsonOk({ accepted: false, reason: 'missing_recipient' });
    }

    const token = extractInboundToken(toAddress);
    if (!token) {
      return jsonOk({ accepted: false, reason: 'unknown_recipient' });
    }

    const admin = createSupabaseAdminClient();
    const { data: profile } = await admin
      .from('portalpulse_profiles')
      .select('id, timezone')
      .eq('inbound_token', token)
      .maybeSingle();
    if (!profile) {
      return jsonOk({ accepted: false, reason: 'unknown_recipient' });
    }
    const userId = profile.id as string;
    const timezone = (profile.timezone as string | null) ?? 'America/New_York';

    const fromDomain = emailDomainOf(fromAddress);
    const portalVendorId = await detectPortalVendorId(admin, fromDomain);
    const gcId = await detectGcId(admin, userId, fromDomain, portalVendorId);

    const limits = await getPlanLimits(admin, userId);
    let limitReached = false;
    if (limits.maxEmailsPerMonth !== null) {
      const parsedThisMonth = await countParsedEmailsThisMonth(admin, userId);
      limitReached = parsedThisMonth >= limits.maxEmailsPerMonth;
    }

    const limitMessage = `Monthly parsing limit reached on the ${limits.planName} plan (${limits.maxEmailsPerMonth ?? 0} emails per month). Upgrade to Pro for unlimited parsing, then run parsing on this email again.`;

    const receivedAtRaw = firstString(payload, ['date', 'Date']);
    const receivedDate = receivedAtRaw ? new Date(receivedAtRaw) : null;
    const receivedAtIso = receivedDate && !Number.isNaN(receivedDate.getTime()) ? receivedDate.toISOString() : null;

    const emailInsert: Record<string, unknown> = {
      user_id: userId,
      gc_id: gcId,
      portal_vendor_id: portalVendorId,
      message_id: messageId,
      from_address: fromAddress,
      to_address: toAddress,
      subject,
      body_text: bodyText,
      parse_status: limitReached ? 'ignored' : 'processing',
      parse_error: limitReached ? limitMessage : null,
    };
    if (receivedAtIso) emailInsert.received_at = receivedAtIso;

    const { data: storedEmail, error: insertError } = await admin
      .from('portalpulse_emails')
      .insert(emailInsert)
      .select('id, received_at')
      .single();

    if (insertError) {
      // Unique (user_id, message_id): a double forward. Already handled, stop retries.
      if (insertError.code === '23505') {
        return jsonOk({ accepted: true, duplicate: true });
      }
      console.error('[api/inbound/email] insert failed', insertError.message);
      return jsonError('We could not store this email. The provider will retry.', 'storage_error', 500);
    }

    const emailId = storedEmail.id as string;
    const receivedAt = storedEmail.received_at as string;

    if (limitReached) {
      return jsonOk({ accepted: true, email_id: emailId, parsed: false, limit_reached: true });
    }

    try {
      const deadlines = await parseEmailIntoDeadlines(admin, {
        emailId,
        userId,
        gcId,
        subject,
        bodyText,
        fromAddress,
        receivedAt,
        timezone,
      });
      return jsonOk({ accepted: true, email_id: emailId, parsed: true, deadlines_created: deadlines.length });
    } catch (parseFailure) {
      console.error('[api/inbound/email] parse failed', parseFailure instanceof Error ? parseFailure.message : parseFailure);
      await admin
        .from('portalpulse_emails')
        .update({
          parse_status: 'failed',
          parse_error: 'We could not pull deadlines out of this email automatically. Open it in PortalPulse and run parsing again, or add the deadline manually.',
        })
        .eq('id', emailId)
        .eq('user_id', userId);
      // The email is stored and visible; do not make the provider retry.
      return jsonOk({ accepted: true, email_id: emailId, parsed: false });
    }
  } catch (unexpectedError) {
    console.error('[api/inbound/email] POST crashed', unexpectedError);
    return jsonError('We could not process this email. The provider will retry.', 'internal_error', 500);
  }
}

// CANONICAL rate limiter for PortalPulse API routes.
// Fixed windows (durable Upstash counters for sensitive buckets, in-memory
// fuse otherwise): a per-minute burst limit and a per-day cap, keyed by
// bucket + client IP. Call sites: rateLimitCheck(bucket, clientIp(request), perMinute, perDay).
//
// Honest scope note: the in-memory fallback is per-server-instance, a cost fuse
// and abuse damper rather than a security boundary. The real boundaries stay
// where they belong: auth, RLS, plan limits, and the inbound webhook's shared
// secret. Zero npm dependencies: the durable path is Upstash REST over fetch.
//
// QA-005 (resolved): the 'portalpulse_inbound' and 'portalpulse_parse' buckets
// are backed by a durable Upstash Redis counter shared across all serverless
// instances when UPSTASH_REDIS_REST_URL + UPSTASH_REDIS_REST_TOKEN are set.
// Deploys without those env vars (or an unreachable Upstash) fall back to the
// in-memory fuse and log the gap once per bucket so it stays visible.

export interface RateLimitVerdict {
  allowed: boolean;
  remaining: number;
}

interface WindowEntry {
  count: number;
  resetAt: number;
}

const MINUTE_MS = 60_000;
const DAY_MS = 86_400_000;
const MAX_TRACKED_KEYS = 50_000;

const counters = new Map<string, WindowEntry>();

// Buckets that require a durable cross-instance counter (QA-005). When the
// Upstash env vars are set these are counted in Redis over REST; otherwise we
// fall back to the in-memory fuse and log the gap once per bucket per instance.
const DURABLE_BUCKETS = new Set(['portalpulse_inbound', 'portalpulse_parse']);
const durableGapLogged = new Set<string>();

const UPSTASH_URL = (process.env.UPSTASH_REDIS_REST_URL ?? '').replace(/\/+$/, '');
const UPSTASH_TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN ?? '';

function logDurableGap(bucket: string, reason: string): void {
  if (durableGapLogged.has(bucket)) return;
  durableGapLogged.add(bucket);
  console.warn(
    `[rate-limit] QA-005: bucket "${bucket}" is using per-instance in-memory ` +
      `counters (${reason}). Effective limits multiply by serverless instance ` +
      'count until the durable Upstash counter is reachable.'
  );
}

// Durable fixed-window counters via the Upstash Redis REST pipeline API (plain
// fetch, no SDK). Keys embed the window index, so a bare INCR yields an exact
// fixed-window count; PEXPIRE merely garbage-collects finished windows.
// Returns null on any failure so the caller falls back to the in-memory fuse
// (fail-open to local limiting: a Redis blip must not drop inbound email).
async function durableCheck(
  bucket: string,
  key: string,
  perMinute: number,
  perDay: number,
  now: number
): Promise<RateLimitVerdict | null> {
  const minuteKey = `rl:${bucket}:m:${key}:${Math.floor(now / MINUTE_MS)}`;
  const dayKey = `rl:${bucket}:d:${key}:${Math.floor(now / DAY_MS)}`;
  try {
    const res = await fetch(`${UPSTASH_URL}/pipeline`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${UPSTASH_TOKEN}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify([
        ['INCR', minuteKey],
        ['PEXPIRE', minuteKey, String(MINUTE_MS * 2)],
        ['INCR', dayKey],
        ['PEXPIRE', dayKey, String(DAY_MS * 2)],
      ]),
      cache: 'no-store',
    });
    if (!res.ok) throw new Error(`Upstash HTTP ${res.status}`);
    const results = (await res.json()) as Array<{ result?: unknown; error?: string }>;
    const minuteCount = Number(results?.[0]?.result);
    const dayCount = Number(results?.[2]?.result);
    if (!Number.isFinite(minuteCount) || !Number.isFinite(dayCount)) {
      throw new Error(results?.[0]?.error || results?.[2]?.error || 'malformed pipeline response');
    }
    const remaining = Math.max(0, Math.min(perMinute - minuteCount, perDay - dayCount));
    return { allowed: minuteCount <= perMinute && dayCount <= perDay, remaining };
  } catch (error) {
    logDurableGap(bucket, error instanceof Error ? error.message : 'Upstash request failed');
    return null;
  }
}

function bump(key: string, windowMs: number, limit: number, now: number): number {
  const entry = counters.get(key);
  if (!entry || entry.resetAt <= now) {
    counters.set(key, { count: 1, resetAt: now + windowMs });
    return limit - 1;
  }
  entry.count += 1;
  return limit - entry.count;
}

function sweep(now: number): void {
  if (counters.size <= MAX_TRACKED_KEYS) return;
  counters.forEach((entry, key) => {
    if (entry.resetAt <= now) counters.delete(key);
  });
}

export function clientIp(request: Request): string {
  const forwarded = request.headers.get('x-forwarded-for');
  if (forwarded) {
    const first = forwarded.split(',')[0]?.trim();
    if (first) return first;
  }
  return request.headers.get('x-real-ip')?.trim() || 'unknown';
}

export async function rateLimitCheck(
  bucket: string,
  key: string,
  perMinute: number,
  perDay: number
): Promise<RateLimitVerdict> {
  const now = Date.now();
  if (DURABLE_BUCKETS.has(bucket)) {
    if (UPSTASH_URL && UPSTASH_TOKEN) {
      const durable = await durableCheck(bucket, key, perMinute, perDay, now);
      if (durable) return durable;
    } else {
      logDurableGap(bucket, 'UPSTASH_REDIS_REST_URL / UPSTASH_REDIS_REST_TOKEN not set');
    }
  }
  sweep(now);
  const minuteRemaining = bump(`${bucket}:m:${key}`, MINUTE_MS, perMinute, now);
  const dayRemaining = bump(`${bucket}:d:${key}`, DAY_MS, perDay, now);
  const remaining = Math.max(0, Math.min(minuteRemaining, dayRemaining));
  return { allowed: minuteRemaining >= 0 && dayRemaining >= 0, remaining };
}

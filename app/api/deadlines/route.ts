// CANONICAL API route: the unified calendar feed.
// GET  /api/deadlines?status=&deadline_type=&gc_id=&from=&to=&q=&order=&page=&limit=
//      Backed by the (user_id, due_at) index; the upcoming filter hits the
//      partial index portalpulse_deadlines_user_upcoming_idx.
// POST /api/deadlines    create a manual deadline (source is always manual)
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
import { DEADLINE_COLUMNS, DEADLINE_STATUSES, DEADLINE_TYPES } from '@/lib/db/types';
import type { DeadlineRow, DeadlineWithGc, Paginated } from '@/lib/db/types';

export const dynamic = 'force-dynamic';

// QA-023: per-user throttle for the on-read missed-status sweep. Keyed by user id,
// value is the epoch ms of the last sweep. In-memory only (best-effort per
// instance); the goal is to stop a single client from forcing repeated writes via
// GET, not to coordinate across instances.
const SWEEP_INTERVAL_MS = 60_000;
const SWEEP_MAP_MAX = 10_000;
const lastSweepByUser = new Map<string, number>();

const listDeadlinesQuerySchema = z.object({
  status: z.enum(DEADLINE_STATUSES, { errorMap: () => ({ message: 'status must be upcoming, completed, missed, or dismissed.' }) }).optional(),
  deadline_type: z.enum(DEADLINE_TYPES, { errorMap: () => ({ message: 'deadline_type is not one we know.' }) }).optional(),
  gc_id: z.string().uuid('gc_id must be a valid id.').optional(),
  from: z.string().datetime({ offset: true, message: 'from must be an ISO 8601 datetime like 2026-08-01T00:00:00Z.' }).optional(),
  to: z.string().datetime({ offset: true, message: 'to must be an ISO 8601 datetime like 2026-08-31T23:59:59Z.' }).optional(),
  q: z.string().trim().min(1, 'Type at least one character to search.').max(120, 'Keep the search under 120 characters.').optional(),
  order: z.enum(['asc', 'desc']).default('asc'),
});

const createDeadlineSchema = z.object({
  title: z
    .string({ required_error: 'Give this deadline a title.' })
    .trim()
    .min(1, 'Give this deadline a title.')
    .max(200, 'Keep the title under 200 characters.'),
  details: z.string().trim().max(2000, 'Keep details under 2000 characters.').optional().default(''),
  deadline_type: z
    .enum(DEADLINE_TYPES, { errorMap: () => ({ message: 'Pick a deadline type from the list.' }) })
    .optional()
    .default('other'),
  due_at: z
    .string({ required_error: 'When is this due?' })
    .datetime({ offset: true, message: 'Use an ISO 8601 datetime like 2026-08-01T17:00:00Z.' }),
  gc_id: z.string().uuid('Pick a GC from your list.').nullable().optional(),
});

export async function GET(request: NextRequest) {
  try {
    const auth = await requireUser();
    if ('response' in auth) return auth.response;

    // QA-023: the missed-status sweep is a WRITE on a read path. A hostile client
    // could hammer GET /api/deadlines to force unbounded UPDATE traffic. Gate it
    // behind a lightweight per-user throttle: run it at most once every 60s per
    // user (tracked in memory), so ordinary reads stay cheap and repeated reads
    // cannot manufacture write load.
    const now = Date.now();
    const lastSwept = lastSweepByUser.get(auth.user.id) ?? 0;
    if (now - lastSwept >= SWEEP_INTERVAL_MS) {
      lastSweepByUser.set(auth.user.id, now);
      // Bound memory: opportunistically evict a stale entry when the map grows.
      if (lastSweepByUser.size > SWEEP_MAP_MAX) {
        // C-001: Array.from avoids direct Map iteration, which needs es2015 target or --downlevelIteration.
        for (const [uid, ts] of Array.from(lastSweepByUser.entries())) {
          if (now - ts >= SWEEP_INTERVAL_MS) lastSweepByUser.delete(uid);
          if (lastSweepByUser.size <= SWEEP_MAP_MAX) break;
        }
      }
      // QA-003: on-read transition — lazily flag past-due 'upcoming' rows as
      // 'missed' so the missed status reflects reality without a cron. RLS plus
      // the explicit user_id filter scope the sweep to the caller, and
      // (user_id, due_at) keeps it on the index.
      const { error: sweepError } = await auth.supabase
        .from('portalpulse_deadlines')
        .update({ status: 'missed' })
        .eq('user_id', auth.user.id)
        .eq('status', 'upcoming')
        .lt('due_at', new Date().toISOString());
      if (sweepError) {
        // Non-fatal: still serve the list; overdue rows get swept on the next read.
        // Allow an immediate retry on the next read since this attempt did no work.
        lastSweepByUser.set(auth.user.id, lastSwept);
        console.error('[api/deadlines] missed sweep failed', sweepError.message);
      }
    }

    const searchParams = request.nextUrl.searchParams;
    const rawQuery = {
      status: searchParams.get('status') ?? undefined,
      deadline_type: searchParams.get('deadline_type') ?? undefined,
      gc_id: searchParams.get('gc_id') ?? undefined,
      from: searchParams.get('from') ?? undefined,
      to: searchParams.get('to') ?? undefined,
      q: searchParams.get('q') ?? undefined,
      order: searchParams.get('order') ?? undefined,
    };
    const parsedQuery = listDeadlinesQuerySchema.safeParse(rawQuery);
    if (!parsedQuery.success) return validationError(parsedQuery.error);
    const filters = parsedQuery.data;

    const pagination = parsePagination(searchParams);
    let query = auth.supabase
      .from('portalpulse_deadlines')
      .select(`${DEADLINE_COLUMNS}, gc:portalpulse_gcs(id, name, color)`, { count: 'exact' });

    if (filters.status) query = query.eq('status', filters.status);
    if (filters.deadline_type) query = query.eq('deadline_type', filters.deadline_type);
    if (filters.gc_id) query = query.eq('gc_id', filters.gc_id);
    if (filters.from) query = query.gte('due_at', filters.from);
    if (filters.to) query = query.lte('due_at', filters.to);
    if (filters.q) {
      // Strip pattern wildcards from user input so the search stays literal.
      const safeSearch = filters.q.replace(/[%_]/g, ' ').trim();
      if (safeSearch) query = query.ilike('title', `%${safeSearch}%`);
    }

    const { data, error, count } = await query
      .order('due_at', { ascending: filters.order === 'asc' })
      .range(pagination.rangeFrom, pagination.rangeTo);

    if (error) {
      console.error('[api/deadlines] list failed', error.message);
      return jsonError('We could not load your calendar. Please try again.', 'internal_error', 500);
    }

    const payload: Paginated<DeadlineWithGc> = {
      items: (data ?? []) as unknown as DeadlineWithGc[],
      page: pagination.page,
      limit: pagination.limit,
      total: count ?? 0,
    };
    return jsonOk(payload);
  } catch (unexpectedError) {
    console.error('[api/deadlines] GET crashed', unexpectedError);
    return jsonError('We could not load your calendar. Please try again.', 'internal_error', 500);
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

    const parsed = createDeadlineSchema.safeParse(bodyResult.body);
    if (!parsed.success) return validationError(parsed.error);

    if (typeof parsed.data.gc_id === 'string') {
      // RLS scopes this lookup to the caller, so linking another tenant's GC is impossible.
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

    const { data: createdDeadline, error: insertError } = await auth.supabase
      .from('portalpulse_deadlines')
      .insert({
        user_id: auth.user.id,
        title: parsed.data.title,
        details: parsed.data.details,
        deadline_type: parsed.data.deadline_type,
        due_at: parsed.data.due_at,
        gc_id: parsed.data.gc_id ?? null,
        status: 'upcoming',
        source: 'manual',
      })
      .select(DEADLINE_COLUMNS)
      .single();

    if (insertError) {
      console.error('[api/deadlines] insert failed', insertError.message);
      return jsonError('We hit a snag saving that deadline. Please try again.', 'internal_error', 500);
    }

    return jsonOk(createdDeadline as unknown as DeadlineRow, 201);
  } catch (unexpectedError) {
    console.error('[api/deadlines] POST crashed', unexpectedError);
    return jsonError('We hit a snag saving that deadline. Please try again.', 'internal_error', 500);
  }
}

// CANONICAL API helpers for PortalPulse route handlers.
// One response envelope everywhere:
//   success: { data: <payload>, error: null }
//   failure: { data: null, error: <human message>, code: <machine code>, fields?: { field: message } }
// HTTP status codes carry the status. Bodies never leak internals.
import { NextResponse } from 'next/server';
import type { SupabaseClient, User } from '@supabase/supabase-js';
import type { ZodError } from 'zod';
import { createSupabaseServerClient } from '@/lib/supabase/server';

export interface ApiSuccess<T> {
  data: T;
  error: null;
}

export interface ApiFailure {
  data: null;
  error: string;
  code: string;
  fields?: Record<string, string>;
}

export function jsonOk<T>(data: T, status = 200): NextResponse {
  const body: ApiSuccess<T> = { data, error: null };
  return NextResponse.json(body, { status });
}

export function jsonError(message: string, code: string, status: number, fields?: Record<string, string>): NextResponse {
  const body: ApiFailure = fields ? { data: null, error: message, code, fields } : { data: null, error: message, code };
  return NextResponse.json(body, { status });
}

export interface AuthenticatedContext {
  user: User;
  supabase: SupabaseClient;
}

export type AuthResult = AuthenticatedContext | { response: NextResponse };

export async function requireUser(): Promise<AuthResult> {
  let supabase: SupabaseClient;
  try {
    supabase = createSupabaseServerClient();
  } catch (configurationError) {
    console.error('[portalpulse/api] Supabase configuration missing', configurationError);
    return { response: jsonError('The service is not fully configured yet. Try again shortly.', 'configuration_error', 500) };
  }
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) {
    return { response: jsonError('Please sign in to continue.', 'unauthorized', 401) };
  }
  return { user: data.user, supabase };
}

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isValidUuid(value: string): boolean {
  return UUID_PATTERN.test(value);
}

export function invalidIdResponse(): NextResponse {
  return jsonError('That id does not look right. Check the link and try again.', 'invalid_id', 400);
}

export interface Pagination {
  page: number;
  limit: number;
  rangeFrom: number;
  rangeTo: number;
}

// Defaults: page 1, limit 20. Hard cap: limit 100. Every list endpoint uses this.
export function parsePagination(searchParams: URLSearchParams): Pagination {
  const rawPage = Number.parseInt(searchParams.get('page') ?? '1', 10);
  const rawLimit = Number.parseInt(searchParams.get('limit') ?? '20', 10);
  const page = Number.isFinite(rawPage) && rawPage >= 1 ? Math.min(rawPage, 10000) : 1;
  const limit = Number.isFinite(rawLimit) && rawLimit >= 1 ? Math.min(rawLimit, 100) : 20;
  const rangeFrom = (page - 1) * limit;
  return { page, limit, rangeFrom, rangeTo: rangeFrom + limit - 1 };
}

export function zodFieldErrors(error: ZodError): Record<string, string> {
  const fields: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = issue.path.length > 0 ? issue.path.join('.') : 'body';
    if (!fields[key]) {
      fields[key] = issue.message;
    }
  }
  return fields;
}

export function validationError(error: ZodError): NextResponse {
  return jsonError('A few fields need attention.', 'validation_error', 400, zodFieldErrors(error));
}

export async function readJsonBody(request: Request): Promise<{ body: unknown } | { response: NextResponse }> {
  try {
    return { body: await request.json() };
  } catch {
    return { response: jsonError('Send a JSON body with this request.', 'invalid_json', 400) };
  }
}

// CANONICAL client-side API helper for PortalPulse pages.
// Every route handler answers with one envelope:
//   success: { data, error: null }
//   failure: { data: null, error, code, fields? }
// This wrapper unwraps it and throws ApiError with the human message intact,
// so pages can show server copy directly without inventing their own.
import type { PlanRow, ProfileRow, SubscriptionRow } from '@/lib/db/types';

export class ApiError extends Error {
  readonly status: number;
  readonly code: string;
  readonly fields: Record<string, string>;

  constructor(message: string, status: number, code = 'error', fields: Record<string, string> = {}) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
    this.fields = fields;
  }
}

interface Envelope<T> {
  data: T | null;
  error: string | null;
  code?: string;
  fields?: Record<string, string>;
}

async function request<T>(path: string, init: RequestInit): Promise<T> {
  let response: Response;
  try {
    response = await fetch(path, {
      ...init,
      headers: { 'content-type': 'application/json', ...(init.headers ?? {}) },
    });
  } catch {
    throw new ApiError('We could not reach PortalPulse. Check your connection and try again.', 0, 'network_error');
  }

  let payload: Envelope<T> | null = null;
  try {
    payload = (await response.json()) as Envelope<T>;
  } catch {
    payload = null;
  }

  if (!response.ok || !payload || payload.error) {
    const message = payload?.error ?? 'That did not go through. Please try again.';
    throw new ApiError(message, response.status, payload?.code ?? 'error', payload?.fields ?? {});
  }
  return payload.data as T;
}

export function apiGet<T>(path: string): Promise<T> {
  return request<T>(path, { method: 'GET', cache: 'no-store' });
}

export function apiSend<T>(path: string, method: 'POST' | 'PATCH' | 'DELETE', body?: unknown): Promise<T> {
  return request<T>(path, { method, body: body === undefined ? undefined : JSON.stringify(body) });
}

export function isAuthError(error: unknown): boolean {
  return error instanceof ApiError && error.status === 401;
}

// Shape of GET /api/me, shared by every dashboard page.
export interface MeResponse {
  profile: ProfileRow;
  forwarding_address: string;
  subscription: SubscriptionRow;
  plan: PlanRow | null;
  usage: { gcs: number; parsed_emails_this_month: number };
  limits: { effective_plan: string; max_gcs: number | null; max_emails_per_month: number | null };
}

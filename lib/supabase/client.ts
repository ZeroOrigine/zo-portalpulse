// CANONICAL browser Supabase client for PortalPulse.
// Client components import from here. Server code must use lib/supabase/server.ts.
// Uses @supabase/ssr only. Never import @supabase/auth-helpers-nextjs (deprecated,
// incompatible cookie format, caused redirect loops in past deploys).
import { createBrowserClient } from '@supabase/ssr';
import type { SupabaseClient } from '@supabase/supabase-js';

let browserClient: SupabaseClient | null = null;

export function createSupabaseBrowserClient(): SupabaseClient {
  if (browserClient) {
    return browserClient;
  }
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error('Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY.');
  }
  browserClient = createBrowserClient(supabaseUrl, supabaseAnonKey);
  return browserClient;
}

// Alias: the auth pages import { createClient } from this module. Both names
// stay exported so every import site in the codebase compiles against the ONE
// memoized browser client.
export const createClient = createSupabaseBrowserClient;

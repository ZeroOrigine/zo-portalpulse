// CANONICAL server Supabase client for PortalPulse (App Router, @supabase/ssr).
// Route handlers and server components import from here. Reads the session
// from cookies; RLS runs with the signed-in user, so every query is tenant safe.
// Env is read inside the function, never at module load, so builds never crash.
import { cookies } from 'next/headers';
import { createServerClient, type CookieOptions } from '@supabase/ssr';
import type { SupabaseClient } from '@supabase/supabase-js';

export function createSupabaseServerClient(): SupabaseClient {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error('Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY.');
  }
  const cookieStore = cookies();
  return createServerClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet: { name: string; value: string; options: CookieOptions }[]) {
        try {
          cookiesToSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options)
          );
        } catch {
          // Server Components cannot set cookies. Middleware owns session refresh.
        }
      },
    },
  });
}

// Alias: the auth and billing route handlers are written against
// `await createClient()`. This async wrapper keeps those call sites valid
// while sharing the single implementation above.
export async function createClient(): Promise<SupabaseClient> {
  return createSupabaseServerClient();
}

// CANONICAL dashboard shell for PortalPulse: auth gate plus sidebar navigation.
// Server component. Every page under app/(dashboard) renders inside this shell.
// Signed-out visitors are redirected to /login before any page code runs.
import Link from 'next/link';
import { redirect } from 'next/navigation';
import type { ReactNode } from 'react';
import { createSupabaseServerClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

const NAV_ITEMS = [
  { href: '/dashboard', label: 'Deadlines', icon: 'calendar' },
  { href: '/emails', label: 'Emails', icon: 'inbox' },
  { href: '/gcs', label: 'GCs', icon: 'building' },
  { href: '/settings', label: 'Settings', icon: 'settings' },
  { href: '/billing', label: 'Billing', icon: 'billing' },
] as const;

type IconName = (typeof NAV_ITEMS)[number]['icon'] | 'menu' | 'signout';

function NavIcon({ name, className }: { name: IconName; className?: string }) {
  const paths: Record<IconName, string> = {
    calendar: 'M6.75 3v2.25M17.25 3v2.25M3.75 8.25h16.5M4.5 5.25h15a.75.75 0 01.75.75v13.5a.75.75 0 01-.75.75h-15a.75.75 0 01-.75-.75V6a.75.75 0 01.75-.75z',
    inbox: 'M2.25 13.5l3-8.25h13.5l3 8.25M2.25 13.5V18a1.5 1.5 0 001.5 1.5h16.5a1.5 1.5 0 001.5-1.5v-4.5M2.25 13.5h6l1.5 2.25h4.5l1.5-2.25h6',
    building: 'M3.75 21h16.5M5.25 21V4.5a1.5 1.5 0 011.5-1.5h7.5a1.5 1.5 0 011.5 1.5V21M9 7.5h1.5M9 11.25h1.5M9 15h1.5M13.5 7.5h.75M18.75 21v-8.25a1.5 1.5 0 00-1.5-1.5h-1.5',
    settings: 'M12 8.75a3.25 3.25 0 100 6.5 3.25 3.25 0 000-6.5zM12 2.75v3M12 18.25v3M2.75 12h3M18.25 12h3M5.4 5.4l2.12 2.12M16.48 16.48l2.12 2.12M18.6 5.4l-2.12 2.12M7.52 16.48L5.4 18.6',
    billing: 'M3.75 6.75A1.5 1.5 0 015.25 5.25h13.5a1.5 1.5 0 011.5 1.5v10.5a1.5 1.5 0 01-1.5 1.5H5.25a1.5 1.5 0 01-1.5-1.5V6.75zM3.75 9.75h16.5M6.75 14.25h4.5',
    menu: 'M3.75 6.75h16.5M3.75 12h16.5M3.75 17.25h16.5',
    signout: 'M15.75 9V5.25A2.25 2.25 0 0013.5 3h-7.5A2.25 2.25 0 003.75 5.25v13.5A2.25 2.25 0 006 21h7.5a2.25 2.25 0 002.25-2.25V15M18.75 15l3-3m0 0l-3-3m3 3H9',
  };
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
      <path d={paths[name]} />
    </svg>
  );
}

function BrandMark() {
  return (
    <span className="font-display text-xl font-extrabold tracking-tight text-gray-900">
      Portal<span className="text-brand-600">Pulse</span>
    </span>
  );
}

function SignOutButton({ compact }: { compact?: boolean }) {
  return (
    <form action="/api/auth/signout" method="post">
      <button
        type="submit"
        className={`flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium text-gray-600 transition-colors hover:bg-gray-100 hover:text-gray-900 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600 ${compact ? '' : 'mt-3'}`}
      >
        <NavIcon name="signout" className="h-4 w-4" />
        Sign out
      </button>
    </form>
  );
}

export default async function DashboardLayout({ children }: { children: ReactNode }) {
  const supabase = createSupabaseServerClient();
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) {
    redirect('/login');
  }

  const { data: profile } = await supabase
    .from('portalpulse_profiles')
    .select('full_name, company_name, email')
    .eq('id', data.user.id)
    .maybeSingle();

  const displayName =
    (profile?.full_name as string | undefined)?.trim() ||
    (profile?.company_name as string | undefined)?.trim() ||
    data.user.email ||
    'Your account';
  const displayEmail = (profile?.email as string | undefined) ?? data.user.email ?? '';

  return (
    <div className="min-h-screen bg-gray-50">
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded-lg focus:bg-white focus:px-4 focus:py-2 focus:text-sm focus:font-semibold focus:shadow"
      >
        Skip to content
      </a>

      <header className="sticky top-0 z-40 border-b border-gray-200 bg-white md:hidden">
        <div className="flex h-14 items-center justify-between px-4">
          <Link href="/dashboard" aria-label="PortalPulse deadlines">
            <BrandMark />
          </Link>
          <details className="relative" data-mobile-nav>
            <summary
              aria-label="Menu"
              className="flex cursor-pointer list-none items-center rounded-lg p-2 text-gray-700 hover:bg-gray-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600 [&::-webkit-details-marker]:hidden"
            >
              <NavIcon name="menu" className="h-6 w-6" />
            </summary>
            <nav aria-label="Main" className="absolute right-0 z-50 mt-2 w-60 rounded-xl border border-gray-200 bg-white p-2 shadow-lg">
              {NAV_ITEMS.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-gray-700 hover:bg-brand-50 hover:text-brand-700"
                >
                  <NavIcon name={item.icon} className="h-5 w-5" />
                  {item.label}
                </Link>
              ))}
              <div className="my-2 border-t border-gray-100" />
              <SignOutButton compact />
            </nav>
          </details>
        </div>
      </header>

      {/* QA-011: auto-close the mobile <details> nav on link tap, outside tap, or Escape. */}
      <script
        dangerouslySetInnerHTML={{
          __html:
            "(function(){if(window.__ppNavAutoClose)return;window.__ppNavAutoClose=true;function closeAll(){document.querySelectorAll('details[data-mobile-nav][open]').forEach(function(d){d.removeAttribute('open')})}document.addEventListener('click',function(e){var t=e.target instanceof Element?e.target:null;document.querySelectorAll('details[data-mobile-nav][open]').forEach(function(d){if(!t||!d.contains(t)||t.closest('a'))d.removeAttribute('open')})},true);document.addEventListener('keydown',function(e){if(e.key==='Escape')closeAll()})})();",
        }}
      />

      <aside className="hidden border-r border-gray-200 bg-white md:fixed md:inset-y-0 md:flex md:w-64 md:flex-col">
        <div className="flex h-16 items-center border-b border-gray-100 px-6">
          <Link href="/dashboard" aria-label="PortalPulse deadlines">
            <BrandMark />
          </Link>
        </div>
        <nav aria-label="Main" className="flex-1 space-y-1 px-3 py-4">
          {NAV_ITEMS.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="group flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-brand-50 hover:text-brand-700"
            >
              <NavIcon name={item.icon} className="h-5 w-5 text-gray-400 transition-colors group-hover:text-brand-600" />
              {item.label}
            </Link>
          ))}
        </nav>
        <div className="border-t border-gray-100 p-4">
          <p className="truncate text-sm font-semibold text-gray-900">{displayName}</p>
          {displayEmail && <p className="truncate text-xs text-gray-500">{displayEmail}</p>}
          <SignOutButton />
        </div>
      </aside>

      <main id="main" className="md:pl-64">
        <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-8">{children}</div>
      </main>
    </div>
  );
}

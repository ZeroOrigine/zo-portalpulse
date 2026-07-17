// CANONICAL: PortalPulse auth shell. Centered card chrome for /login,
// /signup, /forgot-password and /reset-password. All visuals are inline;
// the only imports are node_modules and Next.js built-ins.

import type { Metadata } from 'next'
import Link from 'next/link'

export const metadata: Metadata = {
  title: 'Account | PortalPulse',
  description:
    'Sign in to PortalPulse: one deadline calendar for every GC portal your GCs make you use.',
}

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative flex min-h-screen flex-col overflow-hidden bg-slate-50">
      {/* Quiet background glows: construction amber plus steel blue. */}
      <div aria-hidden="true" className="pointer-events-none absolute inset-0">
        <div className="absolute -right-32 -top-32 h-96 w-96 rounded-full bg-amber-200/40 blur-3xl" />
        <div className="absolute -bottom-40 -left-32 h-[28rem] w-[28rem] rounded-full bg-blue-200/40 blur-3xl" />
      </div>

      <header className="relative z-10 px-6 pt-8">
        <div className="mx-auto flex w-full max-w-md items-center justify-center">
          <Link href="/" className="group inline-flex items-center gap-2.5" aria-label="PortalPulse home">
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-900 shadow-sm transition-transform group-hover:scale-105">
              {/* Calendar with a pulse line. */}
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                <rect x="3" y="5" width="18" height="16" rx="2.5" stroke="#f59e0b" strokeWidth="2" />
                <path d="M3 9.5h18" stroke="#f59e0b" strokeWidth="2" />
                <path d="M8 2.5v4M16 2.5v4" stroke="#f59e0b" strokeWidth="2" strokeLinecap="round" />
                <path d="M6.5 15.5h2.2l1.4-2.6 2 4.4 1.5-3 1 1.2h2.9" stroke="#f59e0b" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </span>
            <span className="text-xl font-bold tracking-tight text-slate-900">PortalPulse</span>
          </Link>
        </div>
      </header>

      <main className="relative z-10 flex flex-1 items-center justify-center px-4 py-10 sm:px-6">
        {children}
      </main>

      <footer className="relative z-10 px-6 pb-8 text-center text-xs text-slate-500">
        <p>One calendar for every GC portal deadline. &copy; {new Date().getFullYear()} PortalPulse.</p>
        <p className="mt-1">
          Born autonomously at{' '}
          <a
            href="https://zeroorigine.com"
            target="_blank"
            rel="noopener noreferrer"
            className="font-medium text-slate-600 underline decoration-slate-300 underline-offset-2 transition-colors hover:text-slate-900"
          >
            ZeroOrigine
          </a>
        </p>
      </footer>
    </div>
  )
}

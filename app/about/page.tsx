// CANONICAL marketing About page for PortalPulse (/about).
import type { Metadata } from 'next';
import Link from 'next/link';

export const metadata: Metadata = {
  title: 'About | PortalPulse',
  description:
    'PortalPulse turns forwarded GC portal notification emails into one deadline calendar for trade subcontractors.',
};

interface Step {
  number: string;
  title: string;
  body: string;
}

const STEPS: Step[] = [
  {
    number: '1',
    title: 'Get your forwarding address',
    body: 'Create an account and PortalPulse issues a dedicated inbound address that belongs to you alone. You can rotate it any time from settings.',
  },
  {
    number: '2',
    title: 'Forward portal emails',
    body: 'Forward GC portal notifications by hand, or set an inbox rule that forwards portal senders automatically. PortalPulse never asks for your email password or mailbox access.',
  },
  {
    number: '3',
    title: 'Watch one calendar fill in',
    body: 'The AI parser reads each email and places COI renewals, pay app windows, lien waiver requests, and compliance documents on a single calendar, color coded by GC.',
  },
];

interface Principle {
  title: string;
  body: string;
}

const PRINCIPLES: Principle[] = [
  {
    title: 'Your inbox stays yours',
    body: 'PortalPulse only sees the emails you choose to forward. There is no mailbox connection and no password to hand over.',
  },
  {
    title: 'Every deadline shows its work',
    body: 'Each AI extracted item keeps a link back to the original email and carries a confidence score, so you can verify the date before you act on it.',
  },
  {
    title: 'You stay in control',
    body: 'Edit, complete, dismiss, or delete any deadline. Add manual deadlines for anything that never arrived by email.',
  },
  {
    title: 'Honest limits',
    body: 'The Free plan tracks up to 2 GCs and parses 10 forwarded emails per month. Pro is $29 per month or $290 per year with unlimited GCs and unlimited parsed emails.',
  },
];

const DEADLINE_KINDS: string[] = [
  'COI renewals',
  'Pay application windows',
  'Lien waiver requests',
  'Compliance documents',
  'Other dated items',
];

const PORTAL_NAMES: string[] = ['GCPay', 'Oracle Textura', 'Procore', 'Buildbite'];

export default function AboutPage() {
  const year = new Date().getFullYear();
  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:px-6">
          <Link
            href="/"
            className="flex items-center gap-2 rounded-md text-base font-semibold text-slate-900 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600"
          >
            <span aria-hidden="true" className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-600 text-sm font-bold text-white">
              P
            </span>
            PortalPulse
          </Link>
          <nav aria-label="Main" className="flex items-center gap-4 sm:gap-6">
            <Link
              href="/pricing"
              className="rounded-md text-sm font-medium text-slate-600 hover:text-slate-900 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600"
            >
              Pricing
            </Link>
            <Link
              href="/about"
              aria-current="page"
              className="rounded-md text-sm font-semibold text-slate-900 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600"
            >
              About
            </Link>
            <Link
              href="/login"
              className="hidden rounded-md text-sm font-medium text-slate-600 hover:text-slate-900 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600 sm:block"
            >
              Sign in
            </Link>
            <Link
              href="/signup"
              className="rounded-lg bg-blue-600 px-3.5 py-2 text-sm font-semibold text-white hover:bg-blue-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600"
            >
              Get started
            </Link>
          </nav>
        </div>
      </header>

      <main>
        <section className="mx-auto max-w-3xl px-4 pb-14 pt-16 sm:px-6 sm:pt-20">
          <p className="text-sm font-semibold uppercase tracking-wide text-blue-600">About PortalPulse</p>
          <h1 className="mt-3 text-4xl font-bold tracking-tight sm:text-5xl">
            One deadline calendar across every GC portal.
          </h1>
          <p className="mt-5 text-lg leading-8 text-slate-600">
            PortalPulse is built for trade subcontractors who work with several general contractors at once, each
            mandating a different payment portal. You forward the portal notification emails, and an AI parser turns
            them into deadlines on a single calendar.
          </p>
        </section>

        <section aria-labelledby="problem-heading" className="border-y border-slate-200 bg-white">
          <div className="mx-auto max-w-3xl px-4 py-14 sm:px-6">
            <h2 id="problem-heading" className="text-2xl font-bold tracking-tight">
              The problem we work on
            </h2>
            <p className="mt-4 leading-7 text-slate-600">
              Each GC picks its own portal. One runs GCPay, another runs Oracle Textura, another mandates Procore or
              Buildbite. As the sub, you inherit all of those logins, and the deadlines that matter arrive as
              notification emails that pile up unread. A lapsed COI or a pay app window that closed quietly can cost
              real money.
            </p>
            <p className="mt-4 leading-7 text-slate-600">
              Each portal serves the GC that chose it. PortalPulse serves the sub who has to keep up with all of them,
              in one place, without adding yet another login to check every day.
            </p>
          </div>
        </section>

        <section aria-labelledby="how-heading" className="mx-auto max-w-5xl px-4 py-14 sm:px-6">
          <h2 id="how-heading" className="text-2xl font-bold tracking-tight">
            How it works
          </h2>
          <ol className="mt-8 grid gap-6 sm:grid-cols-3">
            {STEPS.map((step) => (
              <li key={step.number} className="rounded-xl border border-slate-200 bg-white p-6">
                <span
                  aria-hidden="true"
                  className="flex h-8 w-8 items-center justify-center rounded-full bg-blue-600 text-sm font-bold text-white"
                >
                  {step.number}
                </span>
                <h3 className="mt-4 text-base font-semibold text-slate-900">{step.title}</h3>
                <p className="mt-2 text-sm leading-6 text-slate-600">{step.body}</p>
              </li>
            ))}
          </ol>
        </section>

        <section aria-labelledby="reads-heading" className="border-y border-slate-200 bg-white">
          <div className="mx-auto max-w-5xl px-4 py-14 sm:px-6">
            <h2 id="reads-heading" className="text-2xl font-bold tracking-tight">
              What the parser reads
            </h2>
            <p className="mt-4 max-w-3xl leading-7 text-slate-600">
              The parser extracts dated items from forwarded notifications and files each one under a deadline type, so
              your calendar stays scannable at a glance.
            </p>
            <ul className="mt-6 flex flex-wrap gap-2">
              {DEADLINE_KINDS.map((kind) => (
                <li
                  key={kind}
                  className="rounded-full border border-blue-200 bg-blue-50 px-3 py-1 text-sm font-medium text-blue-700"
                >
                  {kind}
                </li>
              ))}
            </ul>
            <p className="mt-6 max-w-3xl leading-7 text-slate-600">
              PortalPulse recognizes notification senders from {PORTAL_NAMES.join(', ')}, and it reads forwarded emails
              from other portals too. When a sender clearly maps to one of your GCs, the deadline is tagged with that GC
              automatically.
            </p>
          </div>
        </section>

        <section aria-labelledby="principles-heading" className="mx-auto max-w-5xl px-4 py-14 sm:px-6">
          <h2 id="principles-heading" className="text-2xl font-bold tracking-tight">
            How we run it
          </h2>
          <div className="mt-8 grid gap-6 sm:grid-cols-2">
            {PRINCIPLES.map((principle) => (
              <article key={principle.title} className="rounded-xl border border-slate-200 bg-white p-6">
                <h3 className="text-base font-semibold text-slate-900">{principle.title}</h3>
                <p className="mt-2 text-sm leading-6 text-slate-600">{principle.body}</p>
              </article>
            ))}
          </div>
        </section>

        <section aria-labelledby="origin-heading" className="border-y border-slate-200 bg-white">
          <div className="mx-auto max-w-3xl px-4 py-14 sm:px-6">
            <h2 id="origin-heading" className="text-2xl font-bold tracking-tight">
              Where PortalPulse comes from
            </h2>
            <p className="mt-4 leading-7 text-slate-600">
              PortalPulse was born autonomously at{' '}
              <a
                href="https://zeroorigine.com"
                target="_blank"
                rel="noopener noreferrer"
                className="font-medium text-blue-600 underline underline-offset-2 hover:text-blue-500"
              >
                ZeroOrigine
              </a>
              , an autonomous software company whose systems design, build, deploy, and operate products under human
              oversight. It runs on production infrastructure with real authentication, per user data isolation, and
              Stripe billing.
            </p>
          </div>
        </section>

        <section aria-labelledby="cta-heading" className="mx-auto max-w-3xl px-4 py-16 text-center sm:px-6">
          <h2 id="cta-heading" className="text-2xl font-bold tracking-tight">
            Start with the Free plan
          </h2>
          <p className="mt-3 leading-7 text-slate-600">
            Track up to 2 GCs with 10 parsed emails per month, free. Upgrade to Pro when you need unlimited.
          </p>
          <div className="mt-6 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <Link
              href="/signup"
              className="w-full rounded-lg bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-blue-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600 sm:w-auto"
            >
              Create your account
            </Link>
            <Link
              href="/pricing"
              className="w-full rounded-lg border border-slate-300 bg-white px-5 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600 sm:w-auto"
            >
              See pricing
            </Link>
          </div>
        </section>
      </main>

      <footer className="border-t border-slate-200 bg-white">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-4 px-4 py-8 sm:flex-row sm:px-6">
          <p className="text-sm text-slate-500">
            {year} PortalPulse. All rights reserved.
          </p>
          <div className="flex flex-wrap items-center justify-center gap-x-5 gap-y-2 text-sm">
            <Link
              href="/pricing"
              className="rounded-md text-slate-600 hover:text-slate-900 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600"
            >
              Pricing
            </Link>
            <Link
              href="/about"
              className="rounded-md text-slate-600 hover:text-slate-900 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600"
            >
              About
            </Link>
            <a
              href="https://zeroorigine.com"
              target="_blank"
              rel="noopener noreferrer"
              className="rounded-md text-slate-600 underline underline-offset-2 hover:text-slate-900 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600"
            >
              Born autonomously at ZeroOrigine
            </a>
          </div>
        </div>
      </footer>
    </div>
  );
}

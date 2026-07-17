// CANONICAL: PortalPulse marketing landing page (route "/"). Every section is inline by design.
import type { Metadata } from "next";
import Link from "next/link";
import { BTN_PRIMARY, BTN_SECONDARY, IconArrowRight, IconPlus, PlanGrid, SiteFooter, SiteHeader } from "@/components/marketing";

export const metadata: Metadata = {
  title: "PortalPulse: every GC portal deadline on one calendar",
  description:
    "Forward GC portal notification emails to your PortalPulse address. AI extracts COI renewals, pay app windows, and lien waiver requests into one calendar across GCPay, Textura, Procore, and Buildbite.",
  openGraph: {
    title: "PortalPulse: every GC portal deadline on one calendar",
    description:
      "Forward portal notification emails to one address. AI turns them into a single deadline calendar across every GC, whatever portal each one mandates.",
    type: "website",
    url: "/",
    siteName: "PortalPulse",
  },
};

type IconProps = { className?: string };

function IconMail({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className={className}>
      <rect x="3" y="5" width="18" height="14" rx="2" />
      <path d="m3 7 9 6 9-6" />
    </svg>
  );
}

function IconSparkles({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className={className}>
      <path d="M12 3l1.8 4.7 4.7 1.8-4.7 1.8L12 16l-1.8-4.7-4.7-1.8 4.7-1.8L12 3z" />
      <path d="M19 14.5l.9 2.3 2.3.9-2.3.9-.9 2.3-.9-2.3-2.3-.9 2.3-.9.9-2.3z" />
    </svg>
  );
}

function IconShield({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className={className}>
      <path d="M12 3l7 3v5c0 4.6-3 8.4-7 10-4-1.6-7-5.4-7-10V6l7-3z" />
      <path d="m9 12 2 2 4-4" />
    </svg>
  );
}

function IconClock({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className={className}>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3 2" />
    </svg>
  );
}

function IconFileCheck({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className={className}>
      <path d="M6 3h8l4 4v13a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1z" />
      <path d="M14 3v5h5" />
      <path d="m9 14 2 2 4-4" />
    </svg>
  );
}

function IconLayers({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className={className}>
      <path d="m12 3 9 5-9 5-9-5 9-5z" />
      <path d="m3 13 9 5 9-5" />
    </svg>
  );
}

function IconArrowDown({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className={className}>
      <path d="M12 5v14m0 0 5-5m-5 5-5-5" />
    </svg>
  );
}

const PORTALS = ["GCPay", "Textura", "Procore", "Buildbite", "Plain email"];

const FEATURES = [
  {
    title: "One forwarding address",
    body: "Set a forwarding rule once per portal, or forward emails as they land. Your GCs change nothing on their end.",
    icon: IconMail,
  },
  {
    title: "AI reads every email",
    body: "The parser pulls the deadline, the GC, and the portal out of messy notification emails, then files it on your calendar.",
    icon: IconSparkles,
  },
  {
    title: "COI renewals surfaced",
    body: "Certificate renewals show up with a countdown instead of hiding in a folder, so coverage stays current on active jobs.",
    icon: IconShield,
  },
  {
    title: "Pay app windows tracked",
    body: "Every GC runs a different billing cycle. See each window open and close on one calendar, and submit on time.",
    icon: IconClock,
  },
  {
    title: "Lien waivers on time",
    body: "Waiver requests stop sitting unsigned in unread mail. Each one lands on the calendar with its due date.",
    icon: IconFileCheck,
  },
  {
    title: "Every GC, one view",
    body: "GCPay, Textura, Procore, Buildbite, or a PM who just emails: their deadlines all live on the same calendar.",
    icon: IconLayers,
  },
];

const STEPS = [
  {
    title: "Get your address",
    body: "Sign up free and PortalPulse gives you a dedicated email address for portal mail.",
  },
  {
    title: "Forward portal emails",
    body: "Add a one-time forwarding rule in Gmail or Outlook, or forward messages as they arrive. No new logins, no GC signoff.",
  },
  {
    title: "Work from one calendar",
    body: "AI extracts each deadline and files it by GC and portal. Open PortalPulse and see what’s due this week across every job.",
  },
];

const MOMENTS = [
  {
    title: "The pay app you almost missed",
    body: "The window closes at 5pm today. The notice landed nine days ago in a portal you check for exactly one GC. On PortalPulse, that date sits on your calendar from the moment the email arrives.",
  },
  {
    title: "The COI that lapsed mid-job",
    body: "The renewal notice went to a folder, the certificate expired, and the GC noticed before you did. A renewal with a visible countdown is a renewal that gets handled.",
  },
  {
    title: "The lien waiver holding a check",
    body: "Payment was ready. The waiver request sat unsigned in unread mail. Waivers that show up on the calendar get signed, and checks stop waiting on paperwork you never saw.",
  },
];

const FAQS = [
  {
    q: "Do my GCs have to change anything?",
    a: "No. You forward emails from your own inbox, so GCs keep their portals and their process. They never need to know you use PortalPulse.",
  },
  {
    q: "Which portals does PortalPulse work with?",
    a: "Any portal that sends you notification emails. That covers GCPay, Textura, Procore, and Buildbite, plus plain emails from a PM. If it lands in your inbox, you can forward it.",
  },
  {
    q: "Is the free plan actually useful?",
    a: "Yes. It includes your forwarding address, full AI parsing, every deadline type, and a unified calendar for up to 2 GCs and 10 parsed portal emails a month. Upgrade to Pro when you outgrow either.",
  },
  {
    q: "What happens to the emails I forward?",
    a: "PortalPulse parses them to extract deadlines and keeps the source email attached to each calendar entry, so you can always check the original. You choose what to forward, and you can delete it whenever you want.",
  },
  {
    q: "What if the AI reads a date wrong?",
    a: "Every entry links back to the original email, so a quick glance confirms it. If something looks off, you can fix the entry and your calendar updates.",
  },
  {
    q: "Can I cancel anytime?",
    a: "Yes. Cancel in a couple of clicks and you keep access through the end of your billing period. Your calendar drops back to the free plan instead of disappearing.",
  },
];

export default function HomePage() {
  return (
    <div className="bg-white text-slate-900 antialiased dark:bg-slate-950 dark:text-slate-100">
      <style>{`
        @keyframes pp-fade-up { from { opacity: 0; transform: translateY(14px); } to { opacity: 1; transform: translateY(0); } }
        .pp-fade { animation: pp-fade-up 0.7s ease-out both; }
        .pp-delay-2 { animation-delay: 0.15s; }
        @media (prefers-reduced-motion: reduce) { .pp-fade { animation: none; } }
      `}</style>

      <a href="#main" className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-[60] focus:rounded-lg focus:bg-slate-900 focus:px-4 focus:py-2 focus:text-sm focus:font-semibold focus:text-white">
        Skip to content
      </a>

      <SiteHeader />

      <main id="main">
        {/* Hero */}
        <section className="relative overflow-hidden">
          <div aria-hidden="true" className="pointer-events-none absolute inset-0 -z-10 bg-gradient-to-b from-amber-50 via-white to-white dark:from-slate-900 dark:via-slate-950 dark:to-slate-950" />
          <div aria-hidden="true" className="pointer-events-none absolute -right-24 -top-24 -z-10 h-96 w-96 rounded-full bg-amber-200/50 blur-3xl dark:bg-amber-500/10" />
          <div aria-hidden="true" className="pointer-events-none absolute -left-32 top-64 -z-10 h-80 w-80 rounded-full bg-sky-200/40 blur-3xl dark:bg-sky-500/10" />

          <div className="mx-auto grid max-w-7xl gap-14 px-4 pb-20 pt-14 sm:px-6 sm:pt-20 lg:grid-cols-2 lg:items-center lg:gap-12 lg:px-8 lg:pb-28">
            <div className="pp-fade max-w-2xl">
              <p className="inline-flex items-center gap-2 rounded-full border border-amber-300/70 bg-amber-50 px-3 py-1 text-xs font-semibold text-amber-800 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-300">
                <span className="h-1.5 w-1.5 rounded-full bg-amber-500" aria-hidden="true" />
                Built for trade subs working 3 or more GCs
              </p>
              <h1 className="mt-5 font-display text-4xl font-bold tracking-tight text-slate-900 dark:text-white sm:text-5xl lg:text-[3.4rem] lg:leading-[1.08]">
                Stop missing deadlines buried in GC portal emails
              </h1>
              <p className="mt-5 text-lg leading-8 text-slate-600 dark:text-slate-300">
                Every GC mandates a different portal. PortalPulse hands you one forwarding address instead. Send portal emails there, and AI files every COI renewal, pay app window, and lien waiver request onto a single calendar.
              </p>
              <div className="mt-8 flex flex-col gap-3 sm:flex-row">
                <Link href="/signup" className={BTN_PRIMARY}>
                  Get started free
                  <IconArrowRight className="h-4 w-4" />
                </Link>
                <Link href="/#how-it-works" className={BTN_SECONDARY}>
                  See how it works
                </Link>
              </div>
              <p className="mt-4 text-sm text-slate-500 dark:text-slate-400">Free for up to 2 GCs and 10 parsed emails a month. No credit card required.</p>
              <div className="mt-8 flex items-center gap-3">
                <div className="flex -space-x-2" aria-hidden="true">
                  <span className="flex h-9 w-9 items-center justify-center rounded-full border-2 border-white bg-slate-800 text-xs font-bold text-amber-400 dark:border-slate-950">G</span>
                  <span className="flex h-9 w-9 items-center justify-center rounded-full border-2 border-white bg-slate-800 text-xs font-bold text-sky-400 dark:border-slate-950">T</span>
                  <span className="flex h-9 w-9 items-center justify-center rounded-full border-2 border-white bg-slate-800 text-xs font-bold text-violet-400 dark:border-slate-950">P</span>
                  <span className="flex h-9 w-9 items-center justify-center rounded-full border-2 border-white bg-slate-800 text-xs font-bold text-emerald-400 dark:border-slate-950">B</span>
                </div>
                <p className="text-sm text-slate-600 dark:text-slate-400">One calendar across GCPay, Textura, Procore, and Buildbite</p>
              </div>
            </div>

            <div className="pp-fade pp-delay-2 relative mx-auto w-full max-w-lg lg:max-w-none">
              <div aria-hidden="true" className="absolute -inset-6 -z-10 rounded-[2.5rem] bg-gradient-to-tr from-amber-200/50 via-transparent to-sky-200/50 blur-2xl dark:from-amber-500/10 dark:to-sky-500/10" />
              <div className="rounded-3xl bg-gradient-to-br from-amber-400/60 via-slate-500/40 to-slate-700/60 p-px shadow-2xl">
                <div className="rounded-[calc(1.5rem-1px)] bg-slate-900 p-5 sm:p-6">
                  <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">Forwarded email</p>
                  <div className="mt-2 rounded-xl border border-slate-700/80 bg-slate-800/80 p-4">
                    <div className="flex items-center gap-2 text-xs text-slate-400">
                      <IconMail className="h-4 w-4 shrink-0 text-slate-500" />
                      <span className="truncate">Textura Notifications · to: you@yourtrade.com</span>
                    </div>
                    <p className="mt-2 text-sm font-semibold text-white">Payment application period is closing</p>
                    <p className="mt-1 truncate text-xs text-slate-400">Submit your payment application for Riverside Job 214 before the period closes on Thursday at 5:00 PM…</p>
                  </div>
                  <div className="my-3 flex items-center justify-center gap-2 text-xs font-medium text-amber-400">
                    <IconArrowDown className="h-4 w-4" />
                    AI pulls out the deadline
                  </div>
                  <div className="rounded-xl border border-slate-700/80 bg-slate-800/80 p-4">
                    <div className="flex items-center justify-between">
                      <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">Your unified calendar</p>
                      <span className="rounded-full bg-slate-700 px-2 py-0.5 text-[10px] font-medium text-slate-300">This week</span>
                    </div>
                    <ul className="mt-3 space-y-2">
                      <li className="flex items-center gap-3 rounded-lg bg-slate-900/60 px-3 py-2.5">
                        <span className="h-2.5 w-2.5 shrink-0 rounded-full bg-amber-400" aria-hidden="true" />
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-medium text-white">Pay app window closes</p>
                          <p className="truncate text-xs text-slate-400">Northline Builders · Textura</p>
                        </div>
                        <span className="shrink-0 rounded-md bg-amber-400/15 px-2 py-1 text-xs font-semibold text-amber-300">Thu</span>
                      </li>
                      <li className="flex items-center gap-3 rounded-lg bg-slate-900/60 px-3 py-2.5">
                        <span className="h-2.5 w-2.5 shrink-0 rounded-full bg-sky-400" aria-hidden="true" />
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-medium text-white">COI renewal due</p>
                          <p className="truncate text-xs text-slate-400">Meridian Construction · GCPay</p>
                        </div>
                        <span className="shrink-0 rounded-md bg-sky-400/15 px-2 py-1 text-xs font-semibold text-sky-300">Fri</span>
                      </li>
                      <li className="flex items-center gap-3 rounded-lg bg-slate-900/60 px-3 py-2.5">
                        <span className="h-2.5 w-2.5 shrink-0 rounded-full bg-violet-400" aria-hidden="true" />
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-medium text-white">Lien waiver request</p>
                          <p className="truncate text-xs text-slate-400">Summit General · Procore</p>
                        </div>
                        <span className="shrink-0 rounded-md bg-violet-400/15 px-2 py-1 text-xs font-semibold text-violet-300">Mon</span>
                      </li>
                    </ul>
                  </div>
                </div>
              </div>
              <p className="mt-3 text-center text-xs text-slate-500 dark:text-slate-400">Example with sample data. Your calendar fills from the emails you forward.</p>
            </div>
          </div>
        </section>

        {/* Portal compatibility bar */}
        <section className="border-y border-slate-200 bg-slate-50 py-10 dark:border-slate-800 dark:bg-slate-900/60">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <p className="text-center text-xs font-semibold uppercase tracking-widest text-slate-500 dark:text-slate-400">Reads notification emails from the portals GCs mandate</p>
            <div className="mt-5 flex flex-wrap items-center justify-center gap-3">
              {PORTALS.map((portal) => (
                <span key={portal} className="rounded-full border border-slate-200 bg-white px-5 py-2.5 text-sm font-semibold text-slate-700 shadow-sm dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200">
                  {portal}
                </span>
              ))}
            </div>
            <p className="mt-5 text-center text-sm text-slate-500 dark:text-slate-400">If a portal can email you, PortalPulse can put its deadlines on your calendar.</p>
          </div>
        </section>

        {/* Features */}
        <section id="features" className="scroll-mt-24 py-20 sm:py-24">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <div className="mx-auto max-w-2xl text-center">
              <h2 className="font-display text-3xl font-bold tracking-tight text-slate-900 dark:text-white sm:text-4xl">Out of four portals, onto one calendar</h2>
              <p className="mt-4 text-lg text-slate-600 dark:text-slate-300">PortalPulse does one job: it turns portal notification emails into deadlines you can see coming.</p>
            </div>
            <div className="mt-14 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {FEATURES.map((feature) => {
                const Icon = feature.icon;
                return (
                  <div key={feature.title} className="rounded-3xl border border-slate-200 bg-white p-7 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md dark:border-slate-800 dark:bg-slate-900">
                    <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-amber-100 text-amber-700 dark:bg-amber-500/10 dark:text-amber-400">
                      <Icon className="h-5 w-5" />
                    </span>
                    <h3 className="mt-5 font-display text-lg font-semibold text-slate-900 dark:text-white">{feature.title}</h3>
                    <p className="mt-2 text-sm leading-6 text-slate-600 dark:text-slate-300">{feature.body}</p>
                  </div>
                );
              })}
            </div>
          </div>
        </section>

        {/* How it works */}
        <section id="how-it-works" className="scroll-mt-24 border-y border-slate-200 bg-slate-50 py-20 dark:border-slate-800 dark:bg-slate-900/60 sm:py-24">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <div className="mx-auto max-w-2xl text-center">
              <h2 className="font-display text-3xl font-bold tracking-tight text-slate-900 dark:text-white sm:text-4xl">From unread email to visible deadline in three steps</h2>
              <p className="mt-4 text-lg text-slate-600 dark:text-slate-300">No integrations, no GC signoff, no new logins to manage. Your first forwarded email becomes a calendar entry in about a minute.</p>
            </div>
            <div className="relative mx-auto mt-14 grid max-w-5xl gap-10 md:grid-cols-3">
              <div aria-hidden="true" className="absolute left-0 right-0 top-7 hidden h-px bg-slate-300/70 dark:bg-slate-700 md:block" />
              {STEPS.map((step, index) => (
                <div key={step.title} className="relative">
                  <div className="relative z-10 flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-900 font-display text-xl font-bold text-amber-400 shadow-md dark:bg-slate-800">
                    {index + 1}
                  </div>
                  <h3 className="mt-5 font-display text-lg font-semibold text-slate-900 dark:text-white">{step.title}</h3>
                  <p className="mt-2 text-sm leading-6 text-slate-600 dark:text-slate-300">{step.body}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Pricing */}
        <section id="pricing" className="scroll-mt-24 py-20 sm:py-24">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <div className="mx-auto max-w-2xl text-center">
              <h2 className="font-display text-3xl font-bold tracking-tight text-slate-900 dark:text-white sm:text-4xl">Pricing that respects slow months</h2>
              <p className="mt-4 text-lg text-slate-600 dark:text-slate-300">Start free. Upgrade when your GC list outgrows the free plan. Downgrade or cancel anytime.</p>
            </div>
            <div className="mt-14">
              <PlanGrid />
            </div>
            <p className="mt-8 text-center text-sm text-slate-500 dark:text-slate-400">
              Prices in USD, billed monthly. Upgrade, downgrade, or cancel anytime.{" "}
              <Link href="/pricing" className="font-semibold text-slate-700 underline underline-offset-4 transition hover:text-slate-900 dark:text-slate-200 dark:hover:text-white">See full pricing details</Link>
            </p>
          </div>
        </section>

        {/* The moments this exists for */}
        <section className="border-y border-slate-200 bg-slate-50 py-20 dark:border-slate-800 dark:bg-slate-900/60 sm:py-24">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <div className="mx-auto max-w-2xl text-center">
              <h2 className="font-display text-3xl font-bold tracking-tight text-slate-900 dark:text-white sm:text-4xl">The moments PortalPulse exists for</h2>
              <p className="mt-4 text-lg text-slate-600 dark:text-slate-300">If you work 3 or more GCs, you have probably lived at least one of these.</p>
            </div>
            <div className="mt-14 grid gap-6 md:grid-cols-3">
              {MOMENTS.map((moment) => (
                <div key={moment.title} className="rounded-3xl border border-slate-200 bg-white p-7 shadow-sm dark:border-slate-800 dark:bg-slate-900">
                  <h3 className="font-display text-lg font-semibold text-slate-900 dark:text-white">{moment.title}</h3>
                  <p className="mt-3 text-sm leading-6 text-slate-600 dark:text-slate-300">{moment.body}</p>
                </div>
              ))}
            </div>
            <p className="mt-10 text-center text-base font-medium text-slate-700 dark:text-slate-200">PortalPulse exists so the next one shows up on your calendar with time to act.</p>
          </div>
        </section>

        {/* FAQ */}
        <section id="faq" className="scroll-mt-24 py-20 sm:py-24">
          <div className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8">
            <div className="text-center">
              <h2 className="font-display text-3xl font-bold tracking-tight text-slate-900 dark:text-white sm:text-4xl">Questions subs ask before they sign up</h2>
            </div>
            <div className="mt-10 space-y-4">
              {FAQS.map((item) => (
                <details key={item.q} className="group rounded-2xl border border-slate-200 bg-white p-6 dark:border-slate-800 dark:bg-slate-900">
                  <summary className="flex cursor-pointer list-none items-center justify-between gap-4 [&::-webkit-details-marker]:hidden">
                    <h3 className="text-base font-semibold text-slate-900 dark:text-white">{item.q}</h3>
                    <span aria-hidden="true" className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-slate-300 text-slate-500 transition group-open:rotate-45 dark:border-slate-700 dark:text-slate-400">
                      <IconPlus className="h-4 w-4" />
                    </span>
                  </summary>
                  <p className="mt-4 text-sm leading-6 text-slate-600 dark:text-slate-300">{item.a}</p>
                </details>
              ))}
            </div>
          </div>
        </section>

        {/* Final CTA */}
        <section className="px-4 pb-20 sm:px-6 sm:pb-24 lg:px-8">
          <div className="relative mx-auto max-w-7xl overflow-hidden rounded-3xl bg-slate-900 px-6 py-16 text-center sm:px-12 sm:py-20">
            <div aria-hidden="true" className="absolute -top-24 left-1/2 h-64 w-[36rem] -translate-x-1/2 rounded-full bg-amber-500/20 blur-3xl" />
            <h2 className="relative font-display text-3xl font-bold tracking-tight text-white sm:text-4xl">See every deadline in one place</h2>
            <p className="relative mx-auto mt-4 max-w-2xl text-lg leading-8 text-slate-300">
              Get your forwarding address, send one portal email, and watch it land on your calendar. That’s the whole setup.
            </p>
            <div className="relative mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
              <Link href="/signup" className={BTN_PRIMARY}>
                Get started free
                <IconArrowRight className="h-4 w-4" />
              </Link>
            </div>
            <p className="relative mt-4 text-sm text-slate-400">Free for up to 2 GCs and 10 parsed emails a month. No credit card required.</p>
          </div>
        </section>
      </main>

      <SiteFooter />
    </div>
  );
}

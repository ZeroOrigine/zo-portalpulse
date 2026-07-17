// CANONICAL shared marketing chrome for PortalPulse public pages.
// ONE definition of SiteHeader, SiteFooter, the small marketing icon set, the
// button classes, and — most importantly — PLANS. PLANS mirrors the
// portalpulse_plans seed EXACTLY (free: 2 GCs / 10 parsed emails per month;
// pro: $29 monthly or $290 yearly, unlimited). Landing and pricing both render
// PlanGrid from here, so marketing copy can never drift from the database again.
import Link from "next/link";

type IconProps = { className?: string };

export function IconCheck({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className={className}>
      <path d="m5 12 5 5 9-10" />
    </svg>
  );
}

export function IconPlus({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className={className}>
      <path d="M12 5v14M5 12h14" />
    </svg>
  );
}

export function IconArrowRight({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className={className}>
      <path d="M5 12h14m0 0-5-5m5 5-5 5" />
    </svg>
  );
}

export const BTN_PRIMARY =
  "inline-flex h-12 items-center justify-center gap-2 rounded-xl bg-amber-500 px-6 text-sm font-semibold text-slate-950 shadow-sm transition hover:bg-amber-400 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-500";
export const BTN_SECONDARY =
  "inline-flex h-12 items-center justify-center gap-2 rounded-xl border border-slate-300 bg-white px-6 text-sm font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800";

export const NAV_LINKS = [
  { label: "Features", href: "/#features" },
  { label: "How it works", href: "/#how-it-works" },
  { label: "Pricing", href: "/pricing" },
  { label: "FAQ", href: "/#faq" },
  { label: "About", href: "/about" },
];

// TRUTH SOURCE: mirrors the portalpulse_plans seed. free = 2 GCs, 10 parsed
// emails/month, $0. pro = unlimited, 2900 cents/mo or 29000 cents/yr.
export const PLANS = [
  {
    name: "Free",
    price: "$0",
    period: "forever",
    blurb: "For getting your deadlines under control.",
    cta: "Start free",
    href: "/signup",
    highlight: false,
    features: [
      "A dedicated PortalPulse forwarding address",
      "AI parsing of portal notification emails",
      "One unified calendar covering up to 2 GCs",
      "10 parsed portal emails per month",
      "COI renewals, pay app windows, and lien waiver requests",
      "No credit card required",
    ],
  },
  {
    name: "Pro",
    price: "$29",
    period: "per month",
    blurb: "For subs whose GC list keeps growing.",
    cta: "Get Pro",
    href: "/signup",
    highlight: true,
    features: [
      "Everything in Free",
      "Unlimited GCs on one calendar",
      "Unlimited parsed portal emails every month",
      "Yearly option: $290 per year (two months free)",
      "Email support",
    ],
  },
];

function PulseMark() {
  return (
    <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-amber-500 text-slate-950">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className="h-5 w-5">
        <path d="M3 12h4l2.5-6 4 12L16 12h5" />
      </svg>
    </span>
  );
}

export function PlanGrid() {
  return (
    <div className="mx-auto grid max-w-4xl gap-8 md:grid-cols-2">
      {PLANS.map((plan) => (
        <div
          key={plan.name}
          className={
            plan.highlight
              ? "relative flex flex-col rounded-3xl border-2 border-amber-500 bg-white p-8 shadow-xl dark:bg-slate-900"
              : "relative flex flex-col rounded-3xl border border-slate-200 bg-white p-8 shadow-sm dark:border-slate-800 dark:bg-slate-900"
          }
        >
          {plan.highlight ? (
            <span className="absolute -top-3.5 left-1/2 -translate-x-1/2 rounded-full bg-amber-500 px-3 py-1 text-xs font-bold uppercase tracking-wide text-slate-950">Most popular</span>
          ) : null}
          <h3 className="font-display text-lg font-semibold text-slate-900 dark:text-white">{plan.name}</h3>
          <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">{plan.blurb}</p>
          <p className="mt-6 flex items-baseline gap-2">
            <span className="font-display text-4xl font-bold tracking-tight text-slate-900 dark:text-white">{plan.price}</span>
            <span className="text-sm font-medium text-slate-500 dark:text-slate-400">{plan.period}</span>
          </p>
          <ul className="mt-6 flex-1 space-y-3">
            {plan.features.map((feature) => (
              <li key={feature} className="flex gap-3 text-sm leading-6 text-slate-600 dark:text-slate-300">
                <IconCheck className="mt-1 h-4 w-4 shrink-0 text-amber-600 dark:text-amber-400" />
                <span>{feature}</span>
              </li>
            ))}
          </ul>
          <Link href={plan.href} className={plan.highlight ? `${BTN_PRIMARY} mt-8 w-full` : `${BTN_SECONDARY} mt-8 w-full`}>
            {plan.cta}
          </Link>
        </div>
      ))}
    </div>
  );
}

export function SiteHeader() {
  return (
    <header className="sticky top-0 z-50 border-b border-slate-200/80 bg-white/85 backdrop-blur dark:border-slate-800 dark:bg-slate-950/85">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
        <Link href="/" className="flex items-center gap-2.5 rounded-lg focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-500">
          <PulseMark />
          <span className="font-display text-lg font-bold tracking-tight text-slate-900 dark:text-white">PortalPulse</span>
        </Link>

        <nav className="hidden items-center gap-7 md:flex" aria-label="Main">
          {NAV_LINKS.map((link) => (
            <Link key={link.label} href={link.href} className="text-sm font-medium text-slate-600 transition hover:text-slate-900 dark:text-slate-300 dark:hover:text-white">
              {link.label}
            </Link>
          ))}
        </nav>

        <div className="hidden items-center gap-3 md:flex">
          <Link href="/login" className="inline-flex h-11 items-center rounded-xl px-4 text-sm font-semibold text-slate-700 transition hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-800">
            Log in
          </Link>
          <Link href="/signup" className="inline-flex h-11 items-center rounded-xl bg-amber-500 px-5 text-sm font-semibold text-slate-950 shadow-sm transition hover:bg-amber-400 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-500">
            Start free
          </Link>
        </div>

        <details className="group relative md:hidden">
          <summary aria-label="Open menu" className="flex h-11 w-11 cursor-pointer list-none items-center justify-center rounded-xl text-slate-700 transition hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-800 [&::-webkit-details-marker]:hidden">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className="h-6 w-6 group-open:hidden">
              <path d="M4 7h16M4 12h16M4 17h16" />
            </svg>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className="hidden h-6 w-6 group-open:block">
              <path d="M6 6l12 12M18 6 6 18" />
            </svg>
          </summary>
          <div className="absolute right-0 top-14 z-50 w-64 rounded-2xl border border-slate-200 bg-white p-3 shadow-xl dark:border-slate-800 dark:bg-slate-900">
            <nav className="flex flex-col" aria-label="Mobile">
              {NAV_LINKS.map((link) => (
                <Link key={link.label} href={link.href} className="flex min-h-[44px] items-center rounded-lg px-3 text-sm font-medium text-slate-700 transition hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-800">
                  {link.label}
                </Link>
              ))}
            </nav>
            <div className="mt-2 border-t border-slate-200 pt-2 dark:border-slate-800">
              <Link href="/login" className="flex min-h-[44px] items-center rounded-lg px-3 text-sm font-medium text-slate-700 transition hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-800">
                Log in
              </Link>
              <Link href="/signup" className="mt-1 flex min-h-[44px] items-center justify-center rounded-xl bg-amber-500 px-3 text-sm font-semibold text-slate-950 transition hover:bg-amber-400">
                Start free
              </Link>
            </div>
          </div>
        </details>
      </div>
    </header>
  );
}

export function SiteFooter() {
  return (
    <footer className="border-t border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-950">
      <div className="mx-auto max-w-7xl px-4 py-14 sm:px-6 lg:px-8">
        <div className="flex flex-col gap-10 md:flex-row md:items-start md:justify-between">
          <div className="max-w-sm">
            <div className="flex items-center gap-2.5">
              <PulseMark />
              <span className="font-display text-lg font-bold tracking-tight text-slate-900 dark:text-white">PortalPulse</span>
            </div>
            <p className="mt-3 text-sm leading-6 text-slate-600 dark:text-slate-400">
              One forwarding address, one calendar, every GC portal deadline. Built for trade subs juggling GCPay, Textura, Procore, and Buildbite.
            </p>
          </div>
          <div className="grid grid-cols-2 gap-10 sm:gap-16">
            <div>
              <p className="text-sm font-semibold text-slate-900 dark:text-white">Product</p>
              <ul className="mt-3 space-y-2">
                <li><Link href="/#features" className="text-sm text-slate-600 transition hover:text-slate-900 dark:text-slate-400 dark:hover:text-white">Features</Link></li>
                <li><Link href="/#how-it-works" className="text-sm text-slate-600 transition hover:text-slate-900 dark:text-slate-400 dark:hover:text-white">How it works</Link></li>
                <li><Link href="/pricing" className="text-sm text-slate-600 transition hover:text-slate-900 dark:text-slate-400 dark:hover:text-white">Pricing</Link></li>
                <li><Link href="/#faq" className="text-sm text-slate-600 transition hover:text-slate-900 dark:text-slate-400 dark:hover:text-white">FAQ</Link></li>
              </ul>
            </div>
            <div>
              <p className="text-sm font-semibold text-slate-900 dark:text-white">Company</p>
              <ul className="mt-3 space-y-2">
                <li><Link href="/about" className="text-sm text-slate-600 transition hover:text-slate-900 dark:text-slate-400 dark:hover:text-white">About</Link></li>
                <li><Link href="/login" className="text-sm text-slate-600 transition hover:text-slate-900 dark:text-slate-400 dark:hover:text-white">Log in</Link></li>
                <li><Link href="/signup" className="text-sm text-slate-600 transition hover:text-slate-900 dark:text-slate-400 dark:hover:text-white">Create account</Link></li>
              </ul>
            </div>
          </div>
        </div>
        <div className="mt-12 flex flex-col gap-3 border-t border-slate-200 pt-6 text-sm text-slate-500 dark:border-slate-800 dark:text-slate-400 sm:flex-row sm:items-center sm:justify-between">
          <p>&copy; {new Date().getFullYear()} PortalPulse. Built for the subs who keep jobs moving.</p>
          <a href="https://zeroorigine.com" rel="noopener noreferrer" className="font-medium text-slate-600 underline-offset-4 transition hover:underline dark:text-slate-300">
            Born autonomously at ZeroOrigine
          </a>
        </div>
      </div>
    </footer>
  );
}

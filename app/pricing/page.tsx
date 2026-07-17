// CANONICAL: PortalPulse pricing page (route "/pricing").
// Plans render from the shared PLANS truth source in components/marketing,
// which mirrors the portalpulse_plans database seed exactly. The phantom
// Enterprise tier and the wrong "3 GCs" free limit are gone.
import type { Metadata } from "next";
import Link from "next/link";
import { BTN_PRIMARY, IconArrowRight, IconCheck, IconPlus, PlanGrid, SiteFooter, SiteHeader } from "@/components/marketing";

export const metadata: Metadata = {
  title: "PortalPulse pricing: start free, upgrade as your GC list grows",
  description:
    "PortalPulse is free for up to 2 GCs with 10 AI-parsed portal emails a month. Pro is $29 per month (or $290 per year) for unlimited GCs and unlimited parsed emails. Cancel anytime.",
  openGraph: {
    title: "PortalPulse pricing",
    description:
      "Free for up to 2 GCs and 10 parsed portal emails a month. Pro at $29 per month or $290 per year for unlimited GCs and parsing.",
    type: "website",
    url: "/pricing",
    siteName: "PortalPulse",
  },
};

const INCLUDED = [
  "A dedicated forwarding address for portal mail",
  "AI parsing of unstructured notification emails",
  "COI renewals, pay app windows, and lien waiver requests",
  "One calendar across every GC and portal",
];

const BILLING_FAQS = [
  {
    q: "How does the free plan stay free?",
    a: "The free plan covers up to 2 GCs and 10 parsed portal emails a month, which is where portal juggling starts to hurt. Subs who grow past that upgrade to Pro, and that is what pays the bills.",
  },
  {
    q: "Do you offer annual billing?",
    a: "Yes. Pro is $29 per month or $290 per year, which works out to two months free. You pick the interval at checkout and can switch or cancel from Manage subscription.",
  },
  {
    q: "Is there a trial for Pro?",
    a: "The free plan is the trial. Use PortalPulse free for as long as you like, and upgrade when you need more than 2 GCs or more than 10 parsed emails in a month.",
  },
  {
    q: "What happens if I cancel or downgrade?",
    a: "Your calendar and parsed history stay in your account. You keep paid features until the end of the billing period, then your account moves to the free plan instead of disappearing.",
  },
];

export default function PricingPage() {
  return (
    <div className="bg-white text-slate-900 antialiased dark:bg-slate-950 dark:text-slate-100">
      <a href="#main" className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-[60] focus:rounded-lg focus:bg-slate-900 focus:px-4 focus:py-2 focus:text-sm focus:font-semibold focus:text-white">
        Skip to content
      </a>

      <SiteHeader />

      <main id="main">
        <section className="relative overflow-hidden">
          <div aria-hidden="true" className="pointer-events-none absolute inset-0 -z-10 bg-gradient-to-b from-amber-50 via-white to-white dark:from-slate-900 dark:via-slate-950 dark:to-slate-950" />
          <div className="mx-auto max-w-7xl px-4 pb-6 pt-16 text-center sm:px-6 sm:pt-20 lg:px-8">
            <p className="mx-auto inline-flex items-center gap-2 rounded-full border border-amber-300/70 bg-amber-50 px-3 py-1 text-xs font-semibold text-amber-800 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-300">
              <span className="h-1.5 w-1.5 rounded-full bg-amber-500" aria-hidden="true" />
              Free plan included. No credit card required.
            </p>
            <h1 className="mx-auto mt-5 max-w-3xl font-display text-4xl font-bold tracking-tight text-slate-900 dark:text-white sm:text-5xl">
              Simple pricing for how subs actually work
            </h1>
            <p className="mx-auto mt-5 max-w-2xl text-lg leading-8 text-slate-600 dark:text-slate-300">
              Start free with a full calendar for up to 2 GCs and 10 parsed portal emails a month. Move to Pro when the list grows. Prices are in USD, billed monthly or yearly.
            </p>
          </div>
        </section>

        <section className="pb-20 pt-10 sm:pb-24">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <PlanGrid />
            <p className="mt-8 text-center text-sm text-slate-500 dark:text-slate-400">Upgrade, downgrade, or cancel anytime. Billing changes take effect at the end of your current period.</p>
          </div>
        </section>

        <section className="border-y border-slate-200 bg-slate-50 py-16 dark:border-slate-800 dark:bg-slate-900/60 sm:py-20">
          <div className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8">
            <div className="mx-auto max-w-2xl text-center">
              <h2 className="font-display text-3xl font-bold tracking-tight text-slate-900 dark:text-white sm:text-4xl">Every plan includes the core product</h2>
              <p className="mt-4 text-lg text-slate-600 dark:text-slate-300">The free plan runs the same parser and the same calendar as Pro. Pro adds room, not quality.</p>
            </div>
            <ul className="mt-10 grid gap-4 sm:grid-cols-2">
              {INCLUDED.map((item) => (
                <li key={item} className="flex items-start gap-3 rounded-2xl border border-slate-200 bg-white p-5 text-sm font-medium leading-6 text-slate-700 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-200">
                  <IconCheck className="mt-1 h-4 w-4 shrink-0 text-amber-600 dark:text-amber-400" />
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </div>
        </section>

        <section className="py-20 sm:py-24">
          <div className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8">
            <div className="text-center">
              <h2 className="font-display text-3xl font-bold tracking-tight text-slate-900 dark:text-white sm:text-4xl">Billing questions, answered straight</h2>
            </div>
            <div className="mt-10 space-y-4">
              {BILLING_FAQS.map((item) => (
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

        <section className="px-4 pb-20 sm:px-6 sm:pb-24 lg:px-8">
          <div className="relative mx-auto max-w-7xl overflow-hidden rounded-3xl bg-slate-900 px-6 py-16 text-center sm:px-12 sm:py-20">
            <div aria-hidden="true" className="absolute -top-24 left-1/2 h-64 w-[36rem] -translate-x-1/2 rounded-full bg-amber-500/20 blur-3xl" />
            <h2 className="relative font-display text-3xl font-bold tracking-tight text-white sm:text-4xl">Start with the free plan</h2>
            <p className="relative mx-auto mt-4 max-w-2xl text-lg leading-8 text-slate-300">
              Get your forwarding address, send one portal email, and see it land on your calendar in about a minute.
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

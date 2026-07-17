'use client';

// CANONICAL billing page for PortalPulse: current plan, live usage against
// plan limits, and upgrade to Pro. Plan names, prices, and limits are read
// from portalpulse_plans so this page can never drift from the database.
// Checkout return params (?checkout=...) are read from window.location inside
// an effect, never via useSearchParams, so static generation stays safe.
import { useCallback, useEffect, useState } from 'react';
import { ApiError, apiGet, isAuthError, type MeResponse } from '@/lib/core/api';
import { ToastShelf, useToasts } from '@/lib/core/toast';
import { formatDateShort, formatMoney } from '@/lib/core/format';
import { createSupabaseBrowserClient } from '@/lib/supabase/client';
import { PLAN_COLUMNS } from '@/lib/db/types';
import type { PlanRow } from '@/lib/db/types';

type Interval = 'monthly' | 'yearly';

const STATUS_BADGES: Record<string, { label: string; classes: string }> = {
  active: { label: 'Active', classes: 'bg-emerald-50 text-emerald-700 ring-emerald-600/20' },
  trialing: { label: 'Trial', classes: 'bg-blue-50 text-blue-700 ring-blue-600/20' },
  past_due: { label: 'Payment issue', classes: 'bg-amber-50 text-amber-800 ring-amber-600/20' },
  unpaid: { label: 'Payment issue', classes: 'bg-amber-50 text-amber-800 ring-amber-600/20' },
  canceled: { label: 'Canceled', classes: 'bg-gray-100 text-gray-600 ring-gray-500/20' },
  incomplete: { label: 'Incomplete', classes: 'bg-amber-50 text-amber-800 ring-amber-600/20' },
  incomplete_expired: { label: 'Expired', classes: 'bg-gray-100 text-gray-600 ring-gray-500/20' },
  paused: { label: 'Paused', classes: 'bg-gray-100 text-gray-600 ring-gray-500/20' },
};

function CheckIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
      <path d="M5 13l4 4L19 7" />
    </svg>
  );
}

function UsageMeter({ label, used, cap, suffix }: { label: string; used: number; cap: number | null; suffix: string }) {
  if (cap === null) {
    return (
      <div>
        <div className="flex items-baseline justify-between">
          <p className="text-sm font-medium text-gray-700">{label}</p>
          <p className="text-sm text-gray-500">
            {used}
            {suffix} · no cap
          </p>
        </div>
        <div className="mt-1.5 h-2 rounded-full bg-gray-100">
          <div className="h-2 w-full rounded-full bg-emerald-200" />
        </div>
      </div>
    );
  }
  const percent = Math.min(100, Math.round((used / cap) * 100));
  const barColor = percent >= 100 ? 'bg-red-500' : percent >= 80 ? 'bg-amber-500' : 'bg-brand-600';
  return (
    <div>
      <div className="flex items-baseline justify-between">
        <p className="text-sm font-medium text-gray-700">{label}</p>
        <p className="text-sm text-gray-500">
          {used} of {cap}
          {suffix}
        </p>
      </div>
      <div className="mt-1.5 h-2 rounded-full bg-gray-100">
        <div className={`h-2 rounded-full ${barColor}`} style={{ width: `${percent}%` }} />
      </div>
    </div>
  );
}

function planFeatures(plan: PlanRow): string[] {
  return [
    plan.max_gcs === null ? 'Unlimited GCs' : `Up to ${plan.max_gcs} ${plan.max_gcs === 1 ? 'GC' : 'GCs'}`,
    plan.max_emails_per_month === null ? 'Unlimited parsed emails' : `${plan.max_emails_per_month} parsed emails per month`,
    'One calendar across every GC portal',
    'AI deadline extraction',
    'Manual deadlines on the same calendar',
  ];
}

function ErrorPanel({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div className="card mx-auto max-w-md p-8 text-center">
      <h2 className="text-lg">We could not load this page.</h2>
      <p className="mt-2 text-sm text-gray-600">{message}</p>
      <button type="button" onClick={onRetry} className="btn-primary mt-4">
        Try again
      </button>
    </div>
  );
}

function BillingSkeleton() {
  return (
    <div className="space-y-6" aria-hidden="true">
      <div className="skeleton h-8 w-36" />
      <div className="skeleton h-44" />
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <div className="skeleton h-80" />
        <div className="skeleton h-80" />
      </div>
    </div>
  );
}

export default function BillingPage() {
  const { toasts, push, dismiss } = useToasts();
  const [me, setMe] = useState<MeResponse | null>(null);
  const [plans, setPlans] = useState<PlanRow[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [interval, setInterval_] = useState<Interval>('monthly');
  const [checkoutBusy, setCheckoutBusy] = useState(false);
  const [portalBusy, setPortalBusy] = useState(false);

  const load = useCallback(async () => {
    setLoadError(null);
    try {
      const supabase = createSupabaseBrowserClient();
      const [meData, plansResult] = await Promise.all([
        apiGet<MeResponse>('/api/me'),
        supabase.from('portalpulse_plans').select(PLAN_COLUMNS).eq('is_active', true).order('price_monthly_cents', { ascending: true }),
      ]);
      if (plansResult.error) {
        throw new Error('We could not load the plan list. Please try again.');
      }
      setMe(meData);
      setPlans((plansResult.data ?? []) as unknown as PlanRow[]);
    } catch (error) {
      if (isAuthError(error)) {
        window.location.assign('/login');
        return;
      }
      setLoadError(error instanceof Error ? error.message : 'We could not load your billing details. Please try again.');
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  // Checkout and billing portal return params, read from the URL after mount.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const outcome = params.get('checkout') ?? params.get('billing');
    if (!outcome) return;
    if (outcome === 'success') {
      push('Payment received. Pro is unlocking now, give it a few seconds.', { tone: 'success' });
      setTimeout(() => {
        void load();
      }, 3000);
    } else if (outcome === 'cancelled' || outcome === 'canceled') {
      push('Checkout closed. Nothing was charged.', { tone: 'info' });
    }
    window.history.replaceState(null, '', window.location.pathname);
  }, [load, push]);

  const startCheckout = useCallback(
    async (planSlug: string) => {
      setCheckoutBusy(true);
      try {
        const response = await fetch('/api/checkout', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ plan: planSlug, interval }),
        });
        const payload = await response.json().catch(() => null);
        const url: unknown = payload?.data?.url ?? payload?.url ?? payload?.data?.checkout_url ?? payload?.checkout_url;
        if (response.ok && typeof url === 'string') {
          window.location.assign(url);
          return;
        }
        push(typeof payload?.error === 'string' ? payload.error : 'We could not start checkout. Please try again.', { tone: 'error' });
      } catch {
        push('We could not reach checkout. Check your connection and try again.', { tone: 'error' });
      } finally {
        setCheckoutBusy(false);
      }
    },
    [interval, push]
  );

  const openPortal = useCallback(async () => {
    setPortalBusy(true);
    try {
      const response = await fetch('/api/billing/portal', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
      });
      const payload = await response.json().catch(() => null);
      const url: unknown = payload?.data?.url ?? payload?.url;
      if (response.ok && typeof url === 'string') {
        window.location.assign(url);
        return;
      }
      push(typeof payload?.error === 'string' ? payload.error : 'We could not open billing management. Please try again.', { tone: 'error' });
    } catch {
      push('We could not reach billing management. Check your connection and try again.', { tone: 'error' });
    } finally {
      setPortalBusy(false);
    }
  }, [push]);

  const loading = !loadError && (me === null || plans === null);
  const subscription = me?.subscription ?? null;
  const statusBadge = subscription ? STATUS_BADGES[subscription.status] ?? STATUS_BADGES.active : STATUS_BADGES.active;
  const onPaidPlan = subscription !== null && subscription.plan !== 'free';
  const benefitsPaused = me !== null && onPaidPlan && me.limits.effective_plan === 'free';
  const proPlan = (plans ?? []).find((plan) => plan.price_monthly_cents > 0) ?? null;
  const yearlySavingsCents = proPlan ? proPlan.price_monthly_cents * 12 - proPlan.price_yearly_cents : 0;

  return (
    <>
      <div className="space-y-6">
        {loadError ? (
          <ErrorPanel message={loadError} onRetry={() => void load()} />
        ) : loading ? (
          <BillingSkeleton />
        ) : me && plans && subscription ? (
          <>
            <header>
              <h1 className="text-2xl sm:text-3xl">Billing</h1>
              <p className="mt-1 text-gray-600">Your plan, your usage, and nothing hidden.</p>
            </header>

            {benefitsPaused && (
              <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
                Your last payment did not go through, so Free plan limits apply for now. Update your card in Manage subscription and your Pro
                limits lift again.
              </div>
            )}

            <section aria-label="Current plan" className="card p-6">
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="text-base font-semibold">Current plan: {me.plan?.name ?? 'Free'}</h2>
                <span className={`badge ${statusBadge.classes}`}>{statusBadge.label}</span>
              </div>
              {onPaidPlan && subscription.current_period_end && (
                <p className="mt-1 text-sm text-gray-600">
                  {subscription.cancel_at_period_end
                    ? `Stays active until ${formatDateShort(subscription.current_period_end)}, then you move to Free.`
                    : `Renews ${formatDateShort(subscription.current_period_end)}.`}
                </p>
              )}
              <div className="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-2">
                <UsageMeter label="GCs" used={me.usage.gcs} cap={me.limits.max_gcs} suffix="" />
                <UsageMeter label="Parsed emails" used={me.usage.parsed_emails_this_month} cap={me.limits.max_emails_per_month} suffix=" this month" />
              </div>
              {onPaidPlan && (
                <div className="mt-5 border-t border-gray-100 pt-4">
                  <button type="button" onClick={() => void openPortal()} disabled={portalBusy} className="btn-secondary">
                    {portalBusy ? 'Opening...' : 'Manage subscription'}
                  </button>
                  <p className="mt-1 text-xs text-gray-500">Update your card, switch between monthly and yearly, or cancel.</p>
                </div>
              )}
            </section>

            <section aria-label="Plans" className="space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <h2 className="text-base font-semibold">Plans</h2>
                <div className="inline-flex rounded-lg border border-gray-300 bg-white p-0.5" role="group" aria-label="Billing interval">
                  <button
                    type="button"
                    onClick={() => setInterval_('monthly')}
                    aria-pressed={interval === 'monthly'}
                    className={`rounded-md px-3 py-1.5 text-xs font-semibold transition-colors ${interval === 'monthly' ? 'bg-gray-900 text-white' : 'text-gray-600 hover:text-gray-900'}`}
                  >
                    Monthly
                  </button>
                  <button
                    type="button"
                    onClick={() => setInterval_('yearly')}
                    aria-pressed={interval === 'yearly'}
                    className={`rounded-md px-3 py-1.5 text-xs font-semibold transition-colors ${interval === 'yearly' ? 'bg-gray-900 text-white' : 'text-gray-600 hover:text-gray-900'}`}
                  >
                    Yearly{yearlySavingsCents > 0 ? ` (save ${formatMoney(yearlySavingsCents)})` : ''}
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                {plans.map((plan) => {
                  const isPaid = plan.price_monthly_cents > 0;
                  const isCurrent = subscription.plan === plan.slug;
                  const priceCents = interval === 'monthly' ? plan.price_monthly_cents : plan.price_yearly_cents;
                  const priceLabel = isPaid ? formatMoney(priceCents) : '$0';
                  const intervalShort = interval === 'monthly' ? 'mo' : 'yr';
                  return (
                    <div key={plan.slug} className={`card relative flex flex-col p-6 ${isPaid ? 'ring-2 ring-brand-600' : ''}`}>
                      {isCurrent && <span className="badge absolute right-4 top-4 bg-gray-100 text-gray-700 ring-gray-500/20">Current plan</span>}
                      <h3 className="text-lg font-bold">{plan.name}</h3>
                      <p className="mt-1 text-sm text-gray-600">{plan.description}</p>
                      <p className="mt-4">
                        <span className="font-display text-3xl font-extrabold text-gray-900">{priceLabel}</span>
                        {isPaid && <span className="text-gray-500">/{intervalShort}</span>}
                      </p>
                      <ul className="mt-4 space-y-2 text-sm text-gray-700">
                        {planFeatures(plan).map((feature) => (
                          <li key={feature} className="flex items-start gap-2">
                            <CheckIcon className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />
                            {feature}
                          </li>
                        ))}
                      </ul>
                      <div className="mt-6">
                        {isCurrent ? (
                          <button type="button" disabled className="btn-secondary w-full">
                            Current plan
                          </button>
                        ) : isPaid ? (
                          <>
                            <button type="button" onClick={() => void startCheckout(plan.slug)} disabled={checkoutBusy} className="btn-primary w-full">
                              {checkoutBusy ? 'Opening checkout...' : `Get ${plan.name} for ${priceLabel}/${intervalShort}`}
                            </button>
                            <p className="mt-2 text-center text-xs text-gray-500">Charged today. Cancel anytime from Manage subscription.</p>
                          </>
                        ) : (
                          <p className="text-xs text-gray-500">
                            To move back to Free, cancel from Manage subscription. You keep {me.plan?.name ?? 'your paid plan'} until the period
                            ends.
                          </p>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>
          </>
        ) : null}
      </div>
      <ToastShelf toasts={toasts} onDismiss={dismiss} />
    </>
  );
}

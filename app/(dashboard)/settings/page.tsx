'use client';

// CANONICAL settings page for PortalPulse: forwarding address management,
// profile details, and the timezone that anchors parsed deadline times.
// Shared UI (Modal, ErrorPanel, FieldError, CopyIcon, copyText) comes from
// components/ui — no local redefinitions.
import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import type { FormEvent } from 'react';
import { ApiError, apiGet, apiSend, isAuthError, type MeResponse } from '@/lib/core/api';
import { ToastShelf, useToasts } from '@/lib/core/toast';
import { CopyIcon, ErrorPanel, FieldError, Modal, copyText } from '@/components/ui';
import type { ProfileRow } from '@/lib/db/types';

const TIMEZONE_OPTIONS = [
  { value: 'America/New_York', label: 'Eastern (New York)' },
  { value: 'America/Chicago', label: 'Central (Chicago)' },
  { value: 'America/Denver', label: 'Mountain (Denver)' },
  { value: 'America/Phoenix', label: 'Arizona (Phoenix)' },
  { value: 'America/Los_Angeles', label: 'Pacific (Los Angeles)' },
  { value: 'America/Anchorage', label: 'Alaska (Anchorage)' },
  { value: 'Pacific/Honolulu', label: 'Hawaii (Honolulu)' },
  { value: 'America/Toronto', label: 'Eastern (Toronto)' },
  { value: 'America/Vancouver', label: 'Pacific (Vancouver)' },
  { value: 'UTC', label: 'UTC' },
];

interface RotateResponse {
  inbound_token: string;
  forwarding_address: string;
  note: string;
}

function SettingsSkeleton() {
  return (
    <div className="space-y-6" aria-hidden="true">
      <div className="skeleton h-8 w-40" />
      <div className="skeleton h-32" />
      <div className="skeleton h-72" />
      <div className="skeleton h-32" />
    </div>
  );
}

export default function SettingsPage() {
  const { toasts, push, dismiss } = useToasts();
  const [me, setMe] = useState<MeResponse | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [fullName, setFullName] = useState('');
  const [company, setCompany] = useState('');
  const [trade, setTrade] = useState('');
  const [timezone, setTimezone] = useState('America/New_York');
  const [saving, setSaving] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [showRotate, setShowRotate] = useState(false);
  const [rotating, setRotating] = useState(false);
  const formInitialized = useRef(false);

  const load = useCallback(async () => {
    setLoadError(null);
    try {
      const meData = await apiGet<MeResponse>('/api/me');
      setMe(meData);
      if (!formInitialized.current) {
        setFullName(meData.profile.full_name);
        setCompany(meData.profile.company_name);
        setTrade(meData.profile.trade);
        setTimezone(meData.profile.timezone);
        formInitialized.current = true;
      }
    } catch (error) {
      if (isAuthError(error)) {
        window.location.assign('/login');
        return;
      }
      setLoadError(error instanceof Error ? error.message : 'We could not load your account. Please try again.');
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const handleCopy = useCallback(async () => {
    if (!me) return;
    const copied = await copyText(me.forwarding_address);
    if (copied) push('Copied. Forward any GC portal email to this address.', { tone: 'success' });
    else push('Copy did not work here. Select the address and copy it manually.', { tone: 'error' });
  }, [me, push]);

  const saveProfile = useCallback(
    async (event: FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      setSaving(true);
      setFieldErrors({});
      try {
        const updated = await apiSend<ProfileRow>('/api/me', 'PATCH', {
          full_name: fullName.trim(),
          company_name: company.trim(),
          trade: trade.trim(),
          timezone,
        });
        setMe((current) => (current ? { ...current, profile: updated } : current));
        push('Saved. Parsed deadline times follow your timezone.', { tone: 'success' });
      } catch (error) {
        if (error instanceof ApiError) {
          setFieldErrors(error.fields);
          push(error.message, { tone: 'error' });
        } else {
          push('We hit a snag saving your profile. Please try again.', { tone: 'error' });
        }
      } finally {
        setSaving(false);
      }
    },
    [company, fullName, push, timezone, trade]
  );

  const rotate = useCallback(async () => {
    setRotating(true);
    try {
      const result = await apiSend<RotateResponse>('/api/me/rotate-token', 'POST');
      setMe((current) =>
        current
          ? { ...current, forwarding_address: result.forwarding_address, profile: { ...current.profile, inbound_token: result.inbound_token } }
          : current
      );
      setShowRotate(false);
      push('New address ready. Update your forwarding rule now, the old address just stopped working.', { tone: 'success' });
    } catch (error) {
      push(error instanceof ApiError ? error.message : 'We could not rotate your forwarding address. Please try again.', { tone: 'error' });
    } finally {
      setRotating(false);
    }
  }, [push]);

  const timezoneOptions = me && !TIMEZONE_OPTIONS.some((option) => option.value === me.profile.timezone)
    ? [{ value: me.profile.timezone, label: me.profile.timezone }, ...TIMEZONE_OPTIONS]
    : TIMEZONE_OPTIONS;

  const loading = !loadError && me === null;

  return (
    <>
      <div className="space-y-6">
        {loadError ? (
          <ErrorPanel message={loadError} onRetry={() => void load()} />
        ) : loading ? (
          <SettingsSkeleton />
        ) : me ? (
          <>
            <header>
              <h1 className="text-2xl sm:text-3xl">Settings</h1>
              <p className="mt-1 text-gray-600">Your forwarding address, your details, and the timezone your deadlines follow.</p>
            </header>

            <section aria-label="Forwarding address" className="card p-6">
              <h2 className="text-base font-semibold">Forwarding address</h2>
              <p className="mt-1 text-sm text-gray-600">
                Forward GC portal emails here. Set an auto-forward rule for portal senders in Gmail or Outlook and you never have to think about
                it again.
              </p>
              <div className="mt-4 flex flex-col gap-2 sm:flex-row">
                <code className="flex-1 truncate rounded-lg border border-gray-200 bg-gray-50 px-4 py-3 font-mono text-sm text-gray-900">
                  {me.forwarding_address}
                </code>
                <button type="button" onClick={() => void handleCopy()} className="btn-secondary">
                  <CopyIcon className="h-4 w-4" />
                  Copy
                </button>
              </div>
              <div className="mt-4 border-t border-gray-100 pt-4">
                <button type="button" onClick={() => setShowRotate(true)} className="text-sm font-semibold text-red-600 hover:text-red-700">
                  Rotate address
                </button>
                <p className="mt-1 text-xs text-gray-500">Use this if the address leaks or starts catching spam. The old one stops working instantly.</p>
              </div>
            </section>

            <section aria-label="Profile" className="card p-6">
              <h2 className="text-base font-semibold">Profile</h2>
              <form onSubmit={saveProfile} noValidate className="mt-4 space-y-4">
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div>
                    <label htmlFor="pf-name" className="field-label">
                      Full name
                    </label>
                    <input id="pf-name" type="text" value={fullName} onChange={(event) => setFullName(event.target.value)} className="field-input" maxLength={120} />
                    <FieldError message={fieldErrors.full_name} />
                  </div>
                  <div>
                    <label htmlFor="pf-company" className="field-label">
                      Company
                    </label>
                    <input id="pf-company" type="text" value={company} onChange={(event) => setCompany(event.target.value)} className="field-input" maxLength={160} />
                    <FieldError message={fieldErrors.company_name} />
                  </div>
                  <div>
                    <label htmlFor="pf-trade" className="field-label">
                      Trade
                    </label>
                    <input
                      id="pf-trade"
                      type="text"
                      value={trade}
                      onChange={(event) => setTrade(event.target.value)}
                      placeholder="Electrical, drywall, HVAC..."
                      className="field-input"
                      maxLength={80}
                    />
                    <FieldError message={fieldErrors.trade} />
                  </div>
                  <div>
                    <label htmlFor="pf-tz" className="field-label">
                      Timezone
                    </label>
                    <select id="pf-tz" value={timezone} onChange={(event) => setTimezone(event.target.value)} className="field-input">
                      {timezoneOptions.map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                    <p className="mt-1 text-xs text-gray-500">Deadline times from parsed emails follow this timezone.</p>
                    <FieldError message={fieldErrors.timezone} />
                  </div>
                </div>
                <button type="submit" disabled={saving} className="btn-primary">
                  {saving ? 'Saving...' : 'Save profile'}
                </button>
              </form>
            </section>

            <section aria-label="Account" className="card p-6">
              <h2 className="text-base font-semibold">Account</h2>
              <dl className="mt-3 space-y-2 text-sm">
                <div className="flex flex-wrap items-baseline gap-2">
                  <dt className="font-medium text-gray-500">Signed in as</dt>
                  <dd className="text-gray-900">{me.profile.email ?? 'your account'}</dd>
                </div>
                <div className="flex flex-wrap items-baseline gap-2">
                  <dt className="font-medium text-gray-500">Plan</dt>
                  <dd className="text-gray-900">
                    {me.plan?.name ?? 'Free'}
                    <Link href="/billing" className="ml-2 font-medium text-brand-600 hover:text-brand-700">
                      Manage billing
                    </Link>
                  </dd>
                </div>
              </dl>
              <form action="/api/auth/signout" method="post" className="mt-4">
                <button type="submit" className="btn-secondary">
                  Sign out
                </button>
              </form>
            </section>
          </>
        ) : null}
      </div>

      {showRotate && (
        <Modal title="Rotate your forwarding address?" onClose={() => setShowRotate(false)}>
          <div className="space-y-3 text-sm text-gray-700">
            <p>Here is exactly what happens:</p>
            <ul className="list-disc space-y-1 pl-5">
              <li>Your current address stops working the moment you rotate.</li>
              <li>Emails sent to the old address will bounce.</li>
              <li>You get a fresh address to put in your forwarding rule.</li>
            </ul>
            <div className="flex flex-wrap gap-2 pt-2">
              <button type="button" onClick={() => void rotate()} disabled={rotating} className="btn-danger">
                {rotating ? 'Rotating...' : 'Rotate address'}
              </button>
              <button type="button" onClick={() => setShowRotate(false)} disabled={rotating} className="btn-secondary">
                Keep current address
              </button>
            </div>
          </div>
        </Modal>
      )}
      <ToastShelf toasts={toasts} onDismiss={dismiss} />
    </>
  );
}

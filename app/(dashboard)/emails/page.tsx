'use client';

// CANONICAL emails page for PortalPulse: every forwarded portal notification,
// its parse status, and one-click re-parsing when an email needs a second look.
import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { ApiError, apiGet, apiSend, isAuthError, type MeResponse } from '@/lib/core/api';
import { ToastShelf, useToasts } from '@/lib/core/toast';
import { PARSE_STATUS_BADGE_CLASSES, PARSE_STATUS_LABELS, formatReceivedAt, pluralize } from '@/lib/core/format';
import type { DeadlineRow, EmailListRow, EmailWithRelations, Paginated } from '@/lib/db/types';

const PAGE_SIZE = 50;

interface ParseResult {
  email: EmailListRow | null;
  deadlines: DeadlineRow[];
  created: number;
}

async function copyText(value: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(value);
    return true;
  } catch {
    return false;
  }
}

function CopyIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
      <path d="M9 9.75A2.25 2.25 0 0111.25 7.5h6a2.25 2.25 0 012.25 2.25v6a2.25 2.25 0 01-2.25 2.25h-6A2.25 2.25 0 019 15.75v-6z" />
      <path d="M6.75 15H6a2.25 2.25 0 01-2.25-2.25v-6A2.25 2.25 0 016 4.5h6a2.25 2.25 0 012.25 2.25v.75" />
    </svg>
  );
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

function EmailsSkeleton() {
  return (
    <div className="space-y-6" aria-hidden="true">
      <div className="space-y-2">
        <div className="skeleton h-8 w-56 max-w-full" />
        <div className="skeleton h-4 w-80 max-w-full" />
      </div>
      <div className="skeleton h-16" />
      <div className="space-y-2">
        {[0, 1, 2, 3, 4].map((i) => (
          <div key={i} className="skeleton h-24" />
        ))}
      </div>
    </div>
  );
}

export default function EmailsPage() {
  const { toasts, push, dismiss } = useToasts();
  const [me, setMe] = useState<MeResponse | null>(null);
  const [emails, setEmails] = useState<EmailWithRelations[] | null>(null);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [busyIds, setBusyIds] = useState<Record<string, boolean>>({});
  const [loadingMore, setLoadingMore] = useState(false);

  const load = useCallback(async () => {
    setLoadError(null);
    try {
      const [meData, emailData] = await Promise.all([
        apiGet<MeResponse>('/api/me'),
        apiGet<Paginated<EmailWithRelations>>(`/api/emails?limit=${PAGE_SIZE}&page=1`),
      ]);
      setMe(meData);
      setEmails(emailData.items);
      setTotal(emailData.total);
      setPage(1);
    } catch (error) {
      if (isAuthError(error)) {
        window.location.assign('/login');
        return;
      }
      setLoadError(error instanceof Error ? error.message : 'We could not load your forwarded emails. Please try again.');
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  // Quiet refresh of page 1 while any email is mid parse, so statuses flip to
  // parsed on their own without the user mashing reload.
  const refresh = useCallback(async () => {
    try {
      const emailData = await apiGet<Paginated<EmailWithRelations>>(`/api/emails?limit=${PAGE_SIZE}&page=1`);
      setEmails((current) => {
        if (!current) return emailData.items;
        const seen = new Set(emailData.items.map((item) => item.id));
        const rest = current.slice(PAGE_SIZE).filter((item) => !seen.has(item.id));
        return [...emailData.items, ...rest];
      });
      setTotal(emailData.total);
    } catch {
      // Silent: the next tick or a manual reload picks it up.
    }
  }, []);

  useEffect(() => {
    const active = (emails ?? []).some((email) => email.parse_status === 'pending' || email.parse_status === 'processing');
    if (!active) return;
    const timer = setInterval(() => {
      void refresh();
    }, 6000);
    return () => clearInterval(timer);
  }, [emails, refresh]);

  const loadMore = useCallback(async () => {
    setLoadingMore(true);
    try {
      const nextPage = page + 1;
      const emailData = await apiGet<Paginated<EmailWithRelations>>(`/api/emails?limit=${PAGE_SIZE}&page=${nextPage}`);
      setEmails((current) => {
        const existing = new Set((current ?? []).map((item) => item.id));
        return [...(current ?? []), ...emailData.items.filter((item) => !existing.has(item.id))];
      });
      setTotal(emailData.total);
      setPage(nextPage);
    } catch (error) {
      push(error instanceof ApiError ? error.message : 'We could not load more emails. Please try again.', { tone: 'error' });
    } finally {
      setLoadingMore(false);
    }
  }, [page, push]);

  const runParse = useCallback(
    async (email: EmailWithRelations) => {
      const priorStatus = email.parse_status;
      setBusyIds((current) => ({ ...current, [email.id]: true }));
      setEmails((list) => (list ?? []).map((item) => (item.id === email.id ? { ...item, parse_status: 'processing', parse_error: null } : item)));
      try {
        const result = await apiSend<ParseResult>(`/api/emails/${email.id}/parse`, 'POST');
        setEmails((list) =>
          (list ?? []).map((item) => (item.id === email.id ? (result.email ? { ...item, ...result.email } : { ...item, parse_status: 'parsed' }) : item))
        );
        push(
          result.created > 0
            ? `Parsed. ${result.created} ${pluralize(result.created, 'deadline')} added to your calendar.`
            : 'Parsed. No deadline found in this one.',
          { tone: 'success' }
        );
      } catch (error) {
        setEmails((list) =>
          (list ?? []).map((item) => (item.id === email.id ? { ...item, parse_status: priorStatus === 'processing' ? 'failed' : priorStatus } : item))
        );
        if (error instanceof ApiError && error.code === 'plan_limit_reached') {
          push(error.message, { tone: 'error', actionLabel: 'See plans', onAction: () => window.location.assign('/billing') });
        } else {
          push(error instanceof ApiError ? error.message : 'We could not parse that email right now. Please try again.', { tone: 'error' });
        }
      } finally {
        setBusyIds((current) => {
          const next = { ...current };
          delete next[email.id];
          return next;
        });
      }
    },
    [push]
  );

  const handleCopy = useCallback(async () => {
    if (!me) return;
    const copied = await copyText(me.forwarding_address);
    if (copied) push('Copied. Forward any GC portal email to this address.', { tone: 'success' });
    else push('Copy did not work here. Select the address and copy it manually.', { tone: 'error' });
  }, [me, push]);

  const loading = !loadError && (me === null || emails === null);
  const emailCap = me?.limits.max_emails_per_month ?? null;
  const emailsUsed = me?.usage.parsed_emails_this_month ?? 0;
  const nearLimit = emailCap !== null && emailsUsed >= emailCap * 0.8;

  return (
    <>
      <div className="space-y-6">
        {loadError ? (
          <ErrorPanel message={loadError} onRetry={() => void load()} />
        ) : loading ? (
          <EmailsSkeleton />
        ) : me && emails ? (
          <>
            <header className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <h1 className="text-2xl sm:text-3xl">Forwarded emails</h1>
                <p className="mt-1 text-gray-600">Every portal notification you forward, and what we pulled from it.</p>
              </div>
              {emailCap !== null && (
                <Link
                  href="/billing"
                  className={`badge self-start sm:self-auto ${nearLimit ? 'bg-amber-50 text-amber-800 ring-amber-600/20' : 'bg-gray-100 text-gray-600 ring-gray-500/20'}`}
                >
                  {emailsUsed} of {emailCap} parsed this month
                </Link>
              )}
            </header>

            <section aria-label="Forwarding address" className="card flex flex-col gap-3 p-4 sm:flex-row sm:items-center">
              <div className="min-w-0 flex-1">
                <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Forward portal emails to</p>
                <p className="mt-0.5 truncate font-mono text-sm text-gray-900">{me.forwarding_address}</p>
              </div>
              <button type="button" onClick={() => void handleCopy()} className="btn-secondary px-3 py-2 text-xs">
                <CopyIcon className="h-4 w-4" />
                Copy
              </button>
            </section>

            {emails.length === 0 ? (
              <section className="card p-10 text-center">
                <h2 className="text-xl">Nothing forwarded yet.</h2>
                <p className="mx-auto mt-2 max-w-md text-sm text-gray-600">
                  Forward a GC portal email to your address above and it lands here within seconds, parsed into deadlines. We keep the original so
                  you can always check the source.
                </p>
                <Link href="/dashboard" className="btn-secondary mt-4">
                  See setup steps
                </Link>
              </section>
            ) : (
              <>
                <ul className="space-y-2">
                  {emails.map((email) => {
                    const canParse = email.parse_status === 'pending' || email.parse_status === 'failed' || email.parse_status === 'ignored';
                    const busy = Boolean(busyIds[email.id]);
                    return (
                      <li key={email.id} className="card animate-fade-up">
                        <div className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center">
                          <Link href={`/emails/${email.id}`} className="group min-w-0 flex-1">
                            <div className="flex flex-wrap items-center gap-2">
                              <p className="truncate font-semibold text-gray-900 group-hover:text-brand-700">{email.subject || '(no subject)'}</p>
                              <span
                                className={`badge ${PARSE_STATUS_BADGE_CLASSES[email.parse_status]} ${email.parse_status === 'processing' ? 'animate-pulse' : ''}`}
                              >
                                {PARSE_STATUS_LABELS[email.parse_status]}
                              </span>
                            </div>
                            <p className="mt-1 truncate text-sm text-gray-600">{email.from_address || 'Unknown sender'}</p>
                            <p className="mt-1 flex flex-wrap items-center gap-2 text-xs text-gray-500">
                              {email.portal_vendor && <span className="badge bg-gray-100 text-gray-700 ring-gray-500/20">{email.portal_vendor.name}</span>}
                              {email.gc && (
                                <span className="inline-flex items-center gap-1.5">
                                  <span className="h-2 w-2 rounded-full" style={{ backgroundColor: email.gc.color }} aria-hidden="true" />
                                  {email.gc.name}
                                </span>
                              )}
                              <span>{formatReceivedAt(email.received_at)}</span>
                            </p>
                            {(email.parse_status === 'failed' || email.parse_status === 'ignored') && email.parse_error && (
                              <p className="mt-2 text-xs text-amber-700">{email.parse_error}</p>
                            )}
                          </Link>
                          <div className="flex shrink-0 items-center gap-2">
                            {canParse && (
                              <button type="button" onClick={() => void runParse(email)} disabled={busy} className="btn-secondary px-3 py-1.5 text-xs">
                                {busy ? 'Reading...' : email.parse_status === 'failed' ? 'Retry parsing' : 'Parse now'}
                              </button>
                            )}
                            <Link href={`/emails/${email.id}`} className="btn-secondary px-3 py-1.5 text-xs">
                              Open
                            </Link>
                          </div>
                        </div>
                      </li>
                    );
                  })}
                </ul>
                {emails.length < total && (
                  <div className="text-center">
                    <button type="button" onClick={() => void loadMore()} disabled={loadingMore} className="btn-secondary">
                      {loadingMore ? 'Loading...' : `Load more (${total - emails.length} left)`}
                    </button>
                  </div>
                )}
              </>
            )}
          </>
        ) : null}
      </div>
      <ToastShelf toasts={toasts} onDismiss={dismiss} />
    </>
  );
}

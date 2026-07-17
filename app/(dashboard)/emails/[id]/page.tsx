'use client';

// CANONICAL email detail page for PortalPulse: the full forwarded email, the
// deadlines AI pulled from it, and controls to re-parse or delete it.
import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ApiError, apiGet, apiSend, isAuthError } from '@/lib/core/api';
import { ToastShelf, useToasts } from '@/lib/core/toast';
import {
  DEADLINE_TYPE_BADGE_CLASSES,
  DEADLINE_TYPE_LABELS,
  PARSE_STATUS_BADGE_CLASSES,
  PARSE_STATUS_LABELS,
  dueLabel,
  formatConfidence,
  formatDueDate,
  pluralize,
} from '@/lib/core/format';
import type { DeadlineRow, EmailDetailWithRelations } from '@/lib/db/types';

interface EmailDetailResponse {
  email: EmailDetailWithRelations;
  deadlines: DeadlineRow[];
}

interface ParseResult {
  email: unknown;
  deadlines: DeadlineRow[];
  created: number;
}

function ErrorPanel({ message }: { message: string }) {
  return (
    <div className="card mx-auto max-w-md p-8 text-center">
      <h2 className="text-lg">We could not load that email.</h2>
      <p className="mt-2 text-sm text-gray-600">{message}</p>
      <Link href="/emails" className="btn-primary mt-4 inline-flex">
        Back to emails
      </Link>
    </div>
  );
}

function DetailSkeleton() {
  return (
    <div className="space-y-6" aria-hidden="true">
      <div className="skeleton h-5 w-32" />
      <div className="skeleton h-40" />
      <div className="skeleton h-32" />
      <div className="skeleton h-64" />
    </div>
  );
}

export default function EmailDetailPage({ params }: { params: { id: string } }) {
  const router = useRouter();
  const { toasts, push, dismiss } = useToasts();
  const [data, setData] = useState<EmailDetailResponse | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [parsing, setParsing] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [busyIds, setBusyIds] = useState<Record<string, boolean>>({});

  const load = useCallback(async () => {
    try {
      const result = await apiGet<EmailDetailResponse>(`/api/emails/${params.id}`);
      setData(result);
      setLoadError(null);
    } catch (error) {
      if (isAuthError(error)) {
        window.location.assign('/login');
        return;
      }
      setLoadError(error instanceof Error ? error.message : 'We could not load that email. Please try again.');
    }
  }, [params.id]);

  useEffect(() => {
    void load();
  }, [load]);

  // While the email is mid parse, poll so extracted deadlines show up on their own.
  useEffect(() => {
    if (data?.email.parse_status !== 'processing') return;
    const timer = setInterval(() => {
      void load();
    }, 5000);
    return () => clearInterval(timer);
  }, [data, load]);

  const parseNow = useCallback(async () => {
    setParsing(true);
    try {
      const result = await apiSend<ParseResult>(`/api/emails/${params.id}/parse`, 'POST');
      await load();
      push(
        result.created > 0
          ? `Parsed. ${result.created} ${pluralize(result.created, 'deadline')} on your calendar.`
          : 'Parsed. No deadline found in this one.',
        { tone: 'success' }
      );
    } catch (error) {
      await load();
      if (error instanceof ApiError && error.code === 'plan_limit_reached') {
        push(error.message, { tone: 'error', actionLabel: 'See plans', onAction: () => window.location.assign('/billing') });
      } else {
        push(error instanceof ApiError ? error.message : 'We could not parse that email right now. Please try again.', { tone: 'error' });
      }
    } finally {
      setParsing(false);
    }
  }, [load, params.id, push]);

  const removeEmail = useCallback(async () => {
    setDeleting(true);
    try {
      await apiSend<{ deleted: boolean; id: string }>(`/api/emails/${params.id}`, 'DELETE');
      router.push('/emails');
    } catch (error) {
      push(error instanceof ApiError ? error.message : 'We could not remove that email. Please try again.', { tone: 'error' });
      setDeleting(false);
      setConfirmingDelete(false);
    }
  }, [params.id, push, router]);

  const markDone = useCallback(
    async (deadline: DeadlineRow) => {
      setBusyIds((current) => ({ ...current, [deadline.id]: true }));
      try {
        await apiSend<DeadlineRow>(`/api/deadlines/${deadline.id}`, 'PATCH', { status: 'completed' });
        setData((current) =>
          current
            ? { ...current, deadlines: current.deadlines.map((item) => (item.id === deadline.id ? { ...item, status: 'completed' } : item)) }
            : current
        );
        push('Done. One less thing to chase.', { tone: 'success' });
      } catch (error) {
        push(error instanceof ApiError ? error.message : 'We hit a snag saving that change. Please try again.', { tone: 'error' });
      } finally {
        setBusyIds((current) => {
          const next = { ...current };
          delete next[deadline.id];
          return next;
        });
      }
    },
    [push]
  );

  const email = data?.email ?? null;
  const deadlines = data?.deadlines ?? [];
  const loading = !loadError && data === null;

  return (
    <>
      <div className="space-y-6">
        <Link href="/emails" className="inline-flex items-center gap-1 text-sm font-medium text-gray-600 hover:text-gray-900">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4" aria-hidden="true">
            <path d="M15 6l-6 6 6 6" />
          </svg>
          All emails
        </Link>

        {loadError ? (
          <ErrorPanel message={loadError} />
        ) : loading ? (
          <DetailSkeleton />
        ) : email ? (
          <>
            <section className="card p-6">
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-xl sm:text-2xl">{email.subject || '(no subject)'}</h1>
                <span className={`badge ${PARSE_STATUS_BADGE_CLASSES[email.parse_status]} ${email.parse_status === 'processing' ? 'animate-pulse' : ''}`}>
                  {PARSE_STATUS_LABELS[email.parse_status]}
                </span>
                {email.portal_vendor && <span className="badge bg-gray-100 text-gray-700 ring-gray-500/20">{email.portal_vendor.name}</span>}
                {email.gc && (
                  <span className="badge bg-gray-100 text-gray-700 ring-gray-500/20">
                    <span className="h-2 w-2 rounded-full" style={{ backgroundColor: email.gc.color }} aria-hidden="true" />
                    {email.gc.name}
                  </span>
                )}
              </div>

              {email.parse_status === 'processing' && (
                <p className="mt-3 rounded-lg bg-blue-50 p-3 text-sm text-blue-800">Reading this email now. Deadlines appear in a few seconds.</p>
              )}
              {(email.parse_status === 'failed' || email.parse_status === 'ignored') && email.parse_error && (
                <p className="mt-3 rounded-lg bg-amber-50 p-3 text-sm text-amber-800">{email.parse_error}</p>
              )}

              <dl className="mt-4 grid grid-cols-1 gap-x-6 gap-y-3 text-sm sm:grid-cols-2">
                <div>
                  <dt className="font-medium text-gray-500">From</dt>
                  <dd className="mt-0.5 break-all text-gray-900">{email.from_address || 'Unknown sender'}</dd>
                </div>
                <div>
                  <dt className="font-medium text-gray-500">Forwarded to</dt>
                  <dd className="mt-0.5 break-all font-mono text-xs text-gray-900">{email.to_address}</dd>
                </div>
                <div>
                  <dt className="font-medium text-gray-500">Received</dt>
                  <dd className="mt-0.5 text-gray-900">{formatDueDate(email.received_at)}</dd>
                </div>
              </dl>

              <div className="mt-5 flex flex-wrap items-center gap-2">
                <button type="button" onClick={() => void parseNow()} disabled={parsing || email.parse_status === 'processing'} className="btn-secondary">
                  {parsing || email.parse_status === 'processing' ? 'Reading...' : 'Run parsing again'}
                </button>
                {confirmingDelete ? (
                  <span className="inline-flex items-center gap-2">
                    <span className="text-sm text-gray-600">Delete this email? Deadlines pulled from it stay on your calendar.</span>
                    <button type="button" onClick={() => void removeEmail()} disabled={deleting} className="btn-danger px-3 py-1.5 text-xs">
                      {deleting ? 'Deleting...' : 'Yes, delete'}
                    </button>
                    <button type="button" onClick={() => setConfirmingDelete(false)} disabled={deleting} className="btn-secondary px-3 py-1.5 text-xs">
                      Keep it
                    </button>
                  </span>
                ) : (
                  <button
                    type="button"
                    onClick={() => setConfirmingDelete(true)}
                    className="inline-flex items-center justify-center rounded-lg px-3 py-2 text-sm font-semibold text-red-600 transition-colors hover:bg-red-50"
                  >
                    Delete email
                  </button>
                )}
              </div>
            </section>

            <section aria-label="Extracted deadlines" className="card">
              <div className="border-b border-gray-100 p-4">
                <h2 className="text-base font-semibold">Deadlines from this email</h2>
              </div>
              {deadlines.length === 0 ? (
                <p className="p-6 text-sm text-gray-600">
                  No deadlines extracted from this one. If you can see a date in the email below, add it from the dashboard and it joins the
                  calendar.
                </p>
              ) : (
                <ul className="divide-y divide-gray-100">
                  {deadlines.map((deadline) => {
                    const confidence = formatConfidence(deadline.confidence);
                    const done = deadline.status === 'completed';
                    return (
                      <li key={deadline.id} className="flex items-start gap-3 p-4">
                        <span className="mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: email.gc?.color ?? '#94a3b8' }} aria-hidden="true" />
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <p className={`font-semibold ${done ? 'text-gray-400 line-through' : 'text-gray-900'}`}>{deadline.title}</p>
                            <span className={`badge ${DEADLINE_TYPE_BADGE_CLASSES[deadline.deadline_type]}`}>{DEADLINE_TYPE_LABELS[deadline.deadline_type]}</span>
                            {confidence && <span className="badge bg-brand-50 text-brand-700 ring-brand-600/20">AI · {confidence}</span>}
                            {deadline.status === 'dismissed' && <span className="badge bg-gray-100 text-gray-600 ring-gray-500/20">Dismissed</span>}
                            {done && <span className="badge bg-emerald-50 text-emerald-700 ring-emerald-600/20">Done</span>}
                          </div>
                          <p className="mt-1 text-sm text-gray-600">
                            {dueLabel(deadline.due_at)}
                            <span className="text-gray-400"> · </span>
                            {formatDueDate(deadline.due_at)}
                          </p>
                          {deadline.details && <p className="mt-1 text-sm text-gray-500">{deadline.details}</p>}
                        </div>
                        {deadline.status === 'upcoming' && (
                          <button
                            type="button"
                            onClick={() => void markDone(deadline)}
                            disabled={Boolean(busyIds[deadline.id])}
                            aria-label={`Mark ${deadline.title} done`}
                            className="btn-secondary shrink-0 px-3 py-1.5 text-xs"
                          >
                            {busyIds[deadline.id] ? 'Saving' : 'Done'}
                          </button>
                        )}
                      </li>
                    );
                  })}
                </ul>
              )}
            </section>

            <section aria-label="Original email" className="card">
              <div className="border-b border-gray-100 p-4">
                <h2 className="text-base font-semibold">Original email</h2>
              </div>
              <div className="max-h-96 overflow-y-auto p-4">
                <pre className="whitespace-pre-wrap break-words font-sans text-sm text-gray-700">{email.body_text || '(empty body)'}</pre>
              </div>
            </section>
          </>
        ) : null}
      </div>
      <ToastShelf toasts={toasts} onDismiss={dismiss} />
    </>
  );
}

'use client';

// CANONICAL dashboard page for PortalPulse: the unified deadline calendar.
// Overdue first, then today, this week, and later. Every deadline wears its
// GC color no matter which portal the original email came from.
import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import type { FormEvent, ReactNode } from 'react';
import { ApiError, apiGet, apiSend, isAuthError, type MeResponse } from '@/lib/core/api';
import { ToastShelf, useToasts } from '@/lib/core/toast';
import {
  DEADLINE_TYPE_BADGE_CLASSES,
  DEADLINE_TYPE_LABELS,
  dueBucket,
  dueLabel,
  formatConfidence,
  formatDueDate,
  pluralize,
  type DueBucket,
} from '@/lib/core/format';
import { DEADLINE_TYPES } from '@/lib/db/types';
import type { DeadlineRow, DeadlineType, DeadlineWithGc, GcWithVendor, Paginated } from '@/lib/db/types';

const SECTIONS: { key: DueBucket; title: string; tone: string }[] = [
  { key: 'overdue', title: 'Overdue', tone: 'text-red-600' },
  { key: 'today', title: 'Due today', tone: 'text-amber-700' },
  { key: 'week', title: 'Next 7 days', tone: 'text-gray-700' },
  { key: 'later', title: 'Further out', tone: 'text-gray-500' },
];

type Buckets = Record<DueBucket, DeadlineWithGc[]>;

function bucketize(items: DeadlineWithGc[]): Buckets {
  const buckets: Buckets = { overdue: [], today: [], week: [], later: [] };
  for (const item of items) {
    buckets[dueBucket(item.due_at)].push(item);
  }
  return buckets;
}

function sortByDue(items: DeadlineWithGc[]): DeadlineWithGc[] {
  return [...items].sort((a, b) => new Date(a.due_at).getTime() - new Date(b.due_at).getTime());
}

async function copyText(value: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(value);
    return true;
  } catch {
    return false;
  }
}

function PlusIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" className={className} aria-hidden="true">
      <path d="M12 5v14M5 12h14" />
    </svg>
  );
}

function CopyIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
      <path d="M9 9.75A2.25 2.25 0 0111.25 7.5h6a2.25 2.25 0 012.25 2.25v6a2.25 2.25 0 01-2.25 2.25h-6A2.25 2.25 0 019 15.75v-6z" />
      <path d="M6.75 15H6a2.25 2.25 0 01-2.25-2.25v-6A2.25 2.25 0 016 4.5h6a2.25 2.25 0 012.25 2.25v.75" />
    </svg>
  );
}

function CheckCircleIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
      <path d="M9 12.75l2.25 2.25L15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  );
}

function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: ReactNode }) {
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center p-4 sm:items-center">
      <button type="button" aria-label="Close dialog" onClick={onClose} className="absolute inset-0 cursor-default bg-gray-900/50" />
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className="relative max-h-[90vh] w-full max-w-lg animate-fade-up overflow-y-auto rounded-2xl border border-gray-200 bg-white p-6 shadow-xl"
      >
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-bold">{title}</h2>
          <button type="button" aria-label="Close" onClick={onClose} className="rounded-lg p-1.5 text-gray-500 hover:bg-gray-100 hover:text-gray-700">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" className="h-5 w-5" aria-hidden="true">
              <path d="M6 6l12 12M18 6L6 18" />
            </svg>
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

function FieldError({ message }: { message?: string }) {
  if (!message) return null;
  return <p className="mt-1 text-xs text-red-600">{message}</p>;
}

function AddDeadlineForm({
  gcs,
  onCreated,
}: {
  gcs: GcWithVendor[];
  onCreated: (row: DeadlineRow) => void;
}) {
  const [title, setTitle] = useState('');
  const [deadlineType, setDeadlineType] = useState<DeadlineType>('other');
  const [date, setDate] = useState('');
  const [time, setTime] = useState('17:00');
  const [gcId, setGcId] = useState('');
  const [details, setDetails] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const nextErrors: Record<string, string> = {};
    if (!title.trim()) nextErrors.title = 'Give this deadline a title.';
    if (!date) nextErrors.due_at = 'Pick a due date.';
    const dueAt = date ? new Date(`${date}T${time || '17:00'}`) : null;
    if (date && (!dueAt || Number.isNaN(dueAt.getTime()))) nextErrors.due_at = 'Pick a valid date and time.';
    if (Object.keys(nextErrors).length > 0) {
      setFieldErrors(nextErrors);
      return;
    }
    setFieldErrors({});
    setFormError(null);
    setSubmitting(true);
    try {
      const created = await apiSend<DeadlineRow>('/api/deadlines', 'POST', {
        title: title.trim(),
        details: details.trim(),
        deadline_type: deadlineType,
        due_at: (dueAt as Date).toISOString(),
        gc_id: gcId || null,
      });
      onCreated(created);
    } catch (error) {
      if (error instanceof ApiError) {
        setFieldErrors(error.fields);
        setFormError(error.message);
      } else {
        setFormError('We hit a snag saving that deadline. Please try again.');
      }
      setSubmitting(false);
    }
  };

  return (
    <form onSubmit={submit} noValidate className="space-y-4">
      <div>
        <label htmlFor="dl-title" className="field-label">
          What is due?
        </label>
        <input
          id="dl-title"
          type="text"
          value={title}
          onChange={(event) => setTitle(event.target.value)}
          placeholder="COI renewal for the Main St job"
          className="field-input"
          maxLength={200}
        />
        <FieldError message={fieldErrors.title} />
      </div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor="dl-date" className="field-label">
            Due date
          </label>
          <input id="dl-date" type="date" value={date} onChange={(event) => setDate(event.target.value)} className="field-input" />
          <FieldError message={fieldErrors.due_at} />
        </div>
        <div>
          <label htmlFor="dl-time" className="field-label">
            Time
          </label>
          <input id="dl-time" type="time" value={time} onChange={(event) => setTime(event.target.value)} className="field-input" />
        </div>
      </div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor="dl-type" className="field-label">
            Type
          </label>
          <select id="dl-type" value={deadlineType} onChange={(event) => setDeadlineType(event.target.value as DeadlineType)} className="field-input">
            {DEADLINE_TYPES.map((typeOption) => (
              <option key={typeOption} value={typeOption}>
                {DEADLINE_TYPE_LABELS[typeOption]}
              </option>
            ))}
          </select>
          <FieldError message={fieldErrors.deadline_type} />
        </div>
        <div>
          <label htmlFor="dl-gc" className="field-label">
            GC (optional)
          </label>
          <select id="dl-gc" value={gcId} onChange={(event) => setGcId(event.target.value)} className="field-input">
            <option value="">No GC</option>
            {gcs.map((gc) => (
              <option key={gc.id} value={gc.id}>
                {gc.name}
              </option>
            ))}
          </select>
          <FieldError message={fieldErrors.gc_id} />
        </div>
      </div>
      <div>
        <label htmlFor="dl-details" className="field-label">
          Details (optional)
        </label>
        <textarea
          id="dl-details"
          value={details}
          onChange={(event) => setDetails(event.target.value)}
          rows={3}
          className="field-input"
          placeholder="Anything future you needs to know"
          maxLength={2000}
        />
        <FieldError message={fieldErrors.details} />
      </div>
      {formError && <p className="text-sm text-red-600">{formError}</p>}
      <button type="submit" disabled={submitting} className="btn-primary w-full">
        {submitting ? 'Saving...' : 'Put it on the calendar'}
      </button>
    </form>
  );
}

function StatCard({
  label,
  value,
  hint,
  tone = 'default',
  href,
}: {
  label: string;
  value: string | number;
  hint: string;
  tone?: 'default' | 'red';
  href?: string;
}) {
  const body = (
    <div className="card h-full p-4">
      <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">{label}</p>
      <p className={`mt-1 font-display text-2xl font-extrabold ${tone === 'red' ? 'text-red-600' : 'text-gray-900'}`}>{value}</p>
      <p className="mt-0.5 text-xs text-gray-500">{hint}</p>
    </div>
  );
  if (href) {
    return (
      <Link href={href} className="block transition-transform hover:-translate-y-0.5">
        {body}
      </Link>
    );
  }
  return body;
}

function FilterChip({ label, active, onClick, color }: { label: string; active: boolean; onClick: () => void; color?: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium transition-colors ${
        active ? 'border-gray-900 bg-gray-900 text-white' : 'border-gray-300 bg-white text-gray-700 hover:bg-gray-50'
      }`}
    >
      {color && <span aria-hidden="true" className="h-2 w-2 rounded-full" style={{ backgroundColor: color }} />}
      {label}
    </button>
  );
}

function DeadlineItem({
  deadline,
  busy,
  onComplete,
  onDismiss,
}: {
  deadline: DeadlineWithGc;
  busy: boolean;
  onComplete: () => void;
  onDismiss: () => void;
}) {
  const overdue = new Date(deadline.due_at).getTime() < Date.now();
  const confidence = formatConfidence(deadline.confidence);
  return (
    <li className="card animate-fade-up p-4">
      <div className="flex items-start gap-3">
        <span aria-hidden="true" className="mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: deadline.gc?.color ?? '#94a3b8' }} />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <p className="font-semibold text-gray-900">{deadline.title}</p>
            <span className={`badge ${DEADLINE_TYPE_BADGE_CLASSES[deadline.deadline_type]}`}>{DEADLINE_TYPE_LABELS[deadline.deadline_type]}</span>
            {deadline.source === 'ai_parsed' ? (
              <span className="badge bg-brand-50 text-brand-700 ring-brand-600/20">AI{confidence ? ` · ${confidence}` : ''}</span>
            ) : (
              <span className="badge bg-gray-100 text-gray-600 ring-gray-500/20">Added by you</span>
            )}
          </div>
          <p className="mt-1 text-sm text-gray-600">
            <span className={overdue ? 'font-semibold text-red-600' : 'font-medium text-gray-700'}>{dueLabel(deadline.due_at)}</span>
            <span className="text-gray-400"> · </span>
            {formatDueDate(deadline.due_at)}
            {deadline.gc && (
              <>
                <span className="text-gray-400"> · </span>
                {deadline.gc.name}
              </>
            )}
          </p>
          {deadline.details && <p className="mt-1 text-sm text-gray-500 line-clamp-2">{deadline.details}</p>}
          {deadline.email_id && (
            <Link href={`/emails/${deadline.email_id}`} className="mt-1 inline-block text-xs font-medium text-brand-600 hover:text-brand-700">
              View source email
            </Link>
          )}
        </div>
        <div className="flex shrink-0 flex-col gap-1.5 sm:flex-row">
          <button type="button" onClick={onComplete} disabled={busy} aria-label={`Mark ${deadline.title} done`} className="btn-secondary min-h-[44px] px-3 py-1.5 text-xs">
            {busy ? 'Saving' : 'Done'}
          </button>
          <button
            type="button"
            onClick={onDismiss}
            disabled={busy}
            aria-label={`Dismiss ${deadline.title}`}
            className="inline-flex min-h-[44px] items-center justify-center rounded-lg px-3 py-1.5 text-xs font-semibold text-gray-500 transition-colors hover:bg-gray-100 hover:text-gray-700 disabled:opacity-60"
          >
            Dismiss
          </button>
        </div>
      </div>
    </li>
  );
}

function Step({ n, title, body }: { n: number; title: string; body: string }) {
  return (
    <div>
      <div className="flex h-8 w-8 items-center justify-center rounded-full bg-brand-600 font-display text-sm font-bold text-white">{n}</div>
      <h3 className="mt-3 text-base font-semibold text-gray-900">{title}</h3>
      <p className="mt-1 text-sm text-gray-600">{body}</p>
    </div>
  );
}

function OnboardingHero({
  address,
  gcCount,
  onCopy,
  onAddManual,
}: {
  address: string;
  gcCount: number;
  onCopy: () => void;
  onAddManual: () => void;
}) {
  return (
    <section className="card overflow-hidden" aria-label="Getting started">
      <div className="border-b border-gray-100 bg-gradient-to-br from-brand-50 to-white p-6 text-center sm:p-10">
        <div className="flex justify-center">
          <span className="badge bg-brand-100 text-brand-700 ring-brand-600/20">Setup takes one forward</span>
        </div>
        <h2 className="mt-3 text-2xl sm:text-3xl">Forward one portal email. Watch it become a deadline.</h2>
        <p className="mx-auto mt-2 max-w-xl text-gray-600">
          GCPay, Oracle Textura, Procore, Buildbite: whatever each GC makes you use, the deadlines all land on this one calendar.
        </p>
        <div className="mx-auto mt-6 flex max-w-xl flex-col items-stretch gap-2 sm:flex-row">
          <code className="flex-1 truncate rounded-lg border border-brand-200 bg-white px-4 py-3 text-left font-mono text-sm text-gray-900">{address}</code>
          <button type="button" onClick={onCopy} className="btn-primary">
            <CopyIcon className="h-4 w-4" />
            Copy address
          </button>
        </div>
      </div>
      <div className="grid gap-6 p-6 sm:grid-cols-3 sm:p-8">
        <Step n={1} title="Copy your address" body="This address is yours alone. Anything sent to it lands in your PortalPulse inbox." />
        <Step n={2} title="Forward a portal email" body="Forward one by hand, or add an auto-forward rule for portal senders in Gmail or Outlook." />
        <Step n={3} title="Deadlines appear" body="AI reads the email and puts COI renewals, pay app windows, and lien waivers on your calendar in seconds." />
      </div>
      <div className="border-t border-gray-100 p-6 sm:px-8">
        <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">What a parsed deadline looks like</p>
        <div className="mt-3 rounded-xl border border-dashed border-gray-300 bg-gray-50 p-4">
          <div className="flex flex-wrap items-center gap-2">
            <span className="h-2.5 w-2.5 rounded-full bg-brand-600" aria-hidden="true" />
            <p className="font-semibold text-gray-900">Example: Pay app window closes for the Riverside project</p>
            <span className="badge bg-blue-50 text-blue-700 ring-blue-600/20">Pay app window</span>
            <span className="badge bg-brand-50 text-brand-700 ring-brand-600/20">AI · 93% match</span>
          </div>
          <p className="mt-1 text-sm text-gray-600">Due in 4 days · Pulled from a forwarded portal email</p>
        </div>
        <div className="mt-4 flex flex-wrap gap-3">
          <button type="button" onClick={onAddManual} className="btn-secondary">
            Add a deadline yourself
          </button>
          {gcCount === 0 && (
            <Link href="/gcs" className="btn-secondary">
              Add your GCs first
            </Link>
          )}
        </div>
      </div>
    </section>
  );
}

function DashboardSkeleton() {
  return (
    <div className="space-y-8" aria-hidden="true">
      <div className="space-y-2">
        <div className="skeleton h-8 w-64 max-w-full" />
        <div className="skeleton h-4 w-80 max-w-full" />
      </div>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="skeleton h-24" />
        ))}
      </div>
      <div className="skeleton h-16" />
      <div className="space-y-2">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="skeleton h-20" />
        ))}
      </div>
    </div>
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

export default function DashboardPage() {
  const { toasts, push, dismiss } = useToasts();
  const [me, setMe] = useState<MeResponse | null>(null);
  const [deadlines, setDeadlines] = useState<DeadlineWithGc[] | null>(null);
  const [gcs, setGcs] = useState<GcWithVendor[] | null>(null);
  const [failedEmailCount, setFailedEmailCount] = useState(0);
  const [handledTotal, setHandledTotal] = useState(0);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [gcFilter, setGcFilter] = useState<string>('all');
  const [busyIds, setBusyIds] = useState<Record<string, boolean>>({});
  const [showAdd, setShowAdd] = useState(false);

  const load = useCallback(async () => {
    setLoadError(null);
    try {
      const [meData, deadlineData, gcData] = await Promise.all([
        apiGet<MeResponse>('/api/me'),
        apiGet<Paginated<DeadlineWithGc>>('/api/deadlines?status=upcoming&order=asc&limit=100'),
        apiGet<Paginated<GcWithVendor>>('/api/gcs?limit=100'),
      ]);
      setMe(meData);
      setDeadlines(deadlineData.items);
      setGcs(gcData.items);
      // /api/me's usage type only declares gcs + parsed_emails_this_month; treat extras as optional.
      const usage = meData.usage as MeResponse['usage'] & { failed_email_count?: number; handled_total?: number };
      setFailedEmailCount(usage.failed_email_count ?? 0);
      setHandledTotal(usage.handled_total ?? 0);
    } catch (error) {
      if (isAuthError(error)) {
        window.location.assign('/login');
        return;
      }
      setLoadError(error instanceof Error ? error.message : 'We could not load your calendar. Please try again.');
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const setBusy = useCallback((id: string, busy: boolean) => {
    setBusyIds((current) => {
      const next = { ...current };
      if (busy) next[id] = true;
      else delete next[id];
      return next;
    });
  }, []);

  const restoreDeadline = useCallback(
    async (deadline: DeadlineWithGc, fromStatus: 'completed' | 'dismissed') => {
      try {
        await apiSend<DeadlineRow>(`/api/deadlines/${deadline.id}`, 'PATCH', { status: 'upcoming' });
        setDeadlines((list) => sortByDue([...(list ?? []), deadline]));
        if (fromStatus === 'completed') setHandledTotal((count) => Math.max(0, count - 1));
        push('Back on the calendar.', { tone: 'info' });
      } catch (error) {
        push(error instanceof ApiError ? error.message : 'We could not bring that deadline back. Refresh and try again.', { tone: 'error' });
      }
    },
    [push]
  );

  const updateStatus = useCallback(
    async (deadline: DeadlineWithGc, status: 'completed' | 'dismissed') => {
      setBusy(deadline.id, true);
      setDeadlines((list) => (list ?? []).filter((item) => item.id !== deadline.id));
      try {
        await apiSend<DeadlineRow>(`/api/deadlines/${deadline.id}`, 'PATCH', { status });
        if (status === 'completed') setHandledTotal((count) => count + 1);
        push(
          status === 'completed' ? `Done. "${deadline.title}" is off your plate.` : `Dismissed. "${deadline.title}" will not nag you again.`,
          {
            tone: 'success',
            actionLabel: 'Undo',
            onAction: () => {
              void restoreDeadline(deadline, status);
            },
          }
        );
      } catch (error) {
        setDeadlines((list) => sortByDue([...(list ?? []), deadline]));
        push(error instanceof ApiError ? error.message : 'We hit a snag saving that change. Please try again.', { tone: 'error' });
      } finally {
        setBusy(deadline.id, false);
      }
    },
    [push, restoreDeadline, setBusy]
  );

  const handleCreated = useCallback(
    (row: DeadlineRow) => {
      const gcMatch = row.gc_id ? (gcs ?? []).find((gc) => gc.id === row.gc_id) : undefined;
      const withGc: DeadlineWithGc = {
        ...row,
        gc: gcMatch ? { id: gcMatch.id, name: gcMatch.name, color: gcMatch.color } : null,
      };
      setDeadlines((list) => sortByDue([...(list ?? []), withGc]));
      setShowAdd(false);
      push('On the calendar. It stays in view until you mark it done.', { tone: 'success' });
    },
    [gcs, push]
  );

  const handleCopy = useCallback(async () => {
    if (!me) return;
    const copied = await copyText(me.forwarding_address);
    if (copied) push('Copied. Forward any GC portal email to this address.', { tone: 'success' });
    else push('Copy did not work here. Select the address and copy it manually.', { tone: 'error' });
  }, [me, push]);

  const allBuckets = useMemo(() => bucketize(deadlines ?? []), [deadlines]);
  const visible = useMemo(
    () => (deadlines ?? []).filter((item) => gcFilter === 'all' || item.gc_id === gcFilter),
    [deadlines, gcFilter]
  );
  const visibleBuckets = useMemo(() => bucketize(visible), [visible]);

  const loading = !loadError && (me === null || deadlines === null || gcs === null);
  const openCount = deadlines?.length ?? 0;
  const overdueCount = allBuckets.overdue.length;
  const dueSoonCount = allBuckets.today.length + allBuckets.week.length;
  const brandNew =
    !loading && me !== null && openCount === 0 && me.usage.parsed_emails_this_month === 0 && failedEmailCount === 0 && handledTotal === 0;

  const firstName = me?.profile.full_name?.trim().split(' ')[0] ?? '';
  const hourNow = new Date().getHours();
  const greeting = hourNow < 12 ? 'Morning' : hourNow < 17 ? 'Afternoon' : 'Evening';
  const subtitle =
    overdueCount > 0
      ? `${overdueCount} overdue, ${openCount - overdueCount} coming up. Start at the top.`
      : openCount > 0
        ? `${openCount} open ${pluralize(openCount, 'deadline')} across ${me?.usage.gcs ?? 0} ${pluralize(me?.usage.gcs ?? 0, 'GC')}. Nothing overdue.`
        : 'All clear. Nothing on the radar right now.';

  const emailCap = me?.limits.max_emails_per_month ?? null;
  const emailsUsed = me?.usage.parsed_emails_this_month ?? 0;
  const nearEmailLimit = emailCap !== null && emailsUsed >= emailCap * 0.8;

  return (
    <>
      <div className="space-y-8">
        {loadError ? (
          <ErrorPanel message={loadError} onRetry={() => void load()} />
        ) : loading ? (
          <DashboardSkeleton />
        ) : brandNew && me ? (
          <>
            <header>
              <h1 className="text-2xl sm:text-3xl">Welcome to PortalPulse{firstName ? `, ${firstName}` : ''}.</h1>
              <p className="mt-1 text-gray-600">One calendar for every GC portal. Here is how it starts.</p>
            </header>
            <OnboardingHero
              address={me.forwarding_address}
              gcCount={gcs?.length ?? 0}
              onCopy={() => void handleCopy()}
              onAddManual={() => setShowAdd(true)}
            />
          </>
        ) : me ? (
          <>
            <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <h1 className="text-2xl sm:text-3xl">
                  {greeting}
                  {firstName ? `, ${firstName}` : ''}.
                </h1>
                <p className="mt-1 text-gray-600">{subtitle}</p>
              </div>
              <button type="button" onClick={() => setShowAdd(true)} className="btn-primary self-start sm:self-auto">
                <PlusIcon className="h-4 w-4" />
                Add deadline
              </button>
            </header>

            {failedEmailCount > 0 && (
              <div className="flex flex-col gap-2 rounded-xl border border-amber-200 bg-amber-50 p-4 sm:flex-row sm:items-center sm:justify-between">
                <p className="text-sm text-amber-900">
                  {failedEmailCount} forwarded {pluralize(failedEmailCount, 'email')} could not be parsed automatically. Open{' '}
                  {failedEmailCount === 1 ? 'it' : 'them'} to retry or add the deadline yourself.
                </p>
                <Link href="/emails" className="btn-secondary min-h-[44px] self-start px-3 py-1.5 text-xs sm:self-auto">
                  Review emails
                </Link>
              </div>
            )}

            <section aria-label="Overview" className="grid grid-cols-2 gap-3 lg:grid-cols-4">
              <StatCard
                label="Overdue"
                value={overdueCount}
                hint={overdueCount > 0 ? 'Handle these first' : 'Nothing overdue'}
                tone={overdueCount > 0 ? 'red' : 'default'}
              />
              <StatCard label="Due in 7 days" value={dueSoonCount} hint="Today through next week" />
              <StatCard
                label="Parsed emails"
                value={emailCap === null ? emailsUsed : `${emailsUsed} / ${emailCap}`}
                hint={emailCap === null ? 'This month, no cap' : nearEmailLimit ? 'Close to your monthly cap' : 'This month'}
                href={nearEmailLimit ? '/billing' : '/emails'}
              />
              <StatCard label="Handled" value={handledTotal} hint="Marked done in PortalPulse" />
            </section>

            <section aria-label="Forwarding address" className="card flex flex-col gap-3 p-4 sm:flex-row sm:items-center">
              <div className="min-w-0 flex-1">
                <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Forward portal emails to</p>
                <p className="mt-0.5 truncate font-mono text-sm text-gray-900">{me.forwarding_address}</p>
              </div>
              <div className="flex gap-2">
                <button type="button" onClick={() => void handleCopy()} className="btn-secondary min-h-[44px] px-3 py-2 text-xs">
                  <CopyIcon className="h-4 w-4" />
                  Copy
                </button>
                <Link href="/settings" className="btn-secondary min-h-[44px] px-3 py-2 text-xs">
                  Manage
                </Link>
              </div>
            </section>

            {(gcs?.length ?? 0) > 1 && (
              <div className="flex flex-wrap items-center gap-2" role="group" aria-label="Filter deadlines by GC">
                <FilterChip label="All GCs" active={gcFilter === 'all'} onClick={() => setGcFilter('all')} />
                {(gcs ?? []).map((gc) => (
                  <FilterChip key={gc.id} label={gc.name} color={gc.color} active={gcFilter === gc.id} onClick={() => setGcFilter(gc.id)} />
                ))}
              </div>
            )}

            {openCount === 0 ? (
              <section className="card p-10 text-center">
                <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-emerald-50 text-emerald-600">
                  <CheckCircleIcon className="h-6 w-6" />
                </div>
                <h2 className="mt-4 text-xl">All clear.</h2>
                <p className="mx-auto mt-2 max-w-md text-sm text-gray-600">
                  Nothing is due. The next portal email you forward shows up here within seconds.
                </p>
                <button type="button" onClick={() => setShowAdd(true)} className="btn-secondary mt-4">
                  Add a deadline
                </button>
              </section>
            ) : visible.length === 0 ? (
              <section className="card p-8 text-center">
                <p className="text-sm text-gray-600">No open deadlines for this GC.</p>
                <button type="button" onClick={() => setGcFilter('all')} className="btn-secondary mt-3">
                  Show all GCs
                </button>
              </section>
            ) : (
              <div className="space-y-8">
                {SECTIONS.map((section) =>
                  visibleBuckets[section.key].length > 0 ? (
                    <section key={section.key} aria-label={section.title}>
                      <h2 className={`text-sm font-semibold uppercase tracking-wide ${section.tone}`}>
                        {section.title} <span className="font-normal text-gray-400">({visibleBuckets[section.key].length})</span>
                      </h2>
                      <ul className="mt-3 space-y-2">
                        {visibleBuckets[section.key].map((deadline) => (
                          <DeadlineItem
                            key={deadline.id}
                            deadline={deadline}
                            busy={Boolean(busyIds[deadline.id])}
                            onComplete={() => void updateStatus(deadline, 'completed')}
                            onDismiss={() => void updateStatus(deadline, 'dismissed')}
                          />
                        ))}
                      </ul>
                    </section>
                  ) : null
                )}
              </div>
            )}
          </>
        ) : null}
      </div>

      {showAdd && (
        <Modal title="Add a deadline" onClose={() => setShowAdd(false)}>
          <AddDeadlineForm gcs={gcs ?? []} onCreated={handleCreated} />
        </Modal>
      )}
      <ToastShelf toasts={toasts} onDismiss={dismiss} />
    </>
  );
}

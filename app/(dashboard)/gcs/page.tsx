'use client';

// CANONICAL GCs page for PortalPulse: the general contractors a sub works with,
// each mapped to the portal that GC mandates and a color for the calendar.
import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import type { FormEvent, ReactNode } from 'react';
import { ApiError, apiGet, apiSend, isAuthError, type MeResponse } from '@/lib/core/api';
import { ToastShelf, useToasts } from '@/lib/core/toast';
import type { GcRow, GcWithVendor, Paginated, PortalVendorRow } from '@/lib/db/types';

const COLOR_CHOICES = [
  { value: '#2563eb', name: 'Blue' },
  { value: '#16a34a', name: 'Green' },
  { value: '#ea580c', name: 'Orange' },
  { value: '#9333ea', name: 'Purple' },
  { value: '#dc2626', name: 'Red' },
  { value: '#0d9488', name: 'Teal' },
  { value: '#ca8a04', name: 'Gold' },
  { value: '#475569', name: 'Slate gray' },
];

function PlusIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" className={className} aria-hidden="true">
      <path d="M12 5v14M5 12h14" />
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

function GcForm({
  mode,
  gc,
  vendors,
  onSaved,
}: {
  mode: 'create' | 'edit';
  gc: GcWithVendor | null;
  vendors: PortalVendorRow[];
  onSaved: (row: GcRow, mode: 'create' | 'edit') => void;
}) {
  const [name, setName] = useState(gc?.name ?? '');
  const [vendorId, setVendorId] = useState(gc?.portal_vendor_id ?? '');
  const [contactEmail, setContactEmail] = useState(gc?.contact_email ?? '');
  const [color, setColor] = useState(gc?.color ?? COLOR_CHOICES[0].value);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!name.trim()) {
      setFieldErrors({ name: 'Give this GC a name so you can spot it on your calendar.' });
      return;
    }
    setFieldErrors({});
    setFormError(null);
    setSubmitting(true);
    const payload = {
      name: name.trim(),
      portal_vendor_id: vendorId || null,
      contact_email: contactEmail.trim() || null,
      color,
    };
    try {
      const saved =
        mode === 'create'
          ? await apiSend<GcRow>('/api/gcs', 'POST', payload)
          : await apiSend<GcRow>(`/api/gcs/${gc?.id}`, 'PATCH', payload);
      onSaved(saved, mode);
    } catch (error) {
      if (error instanceof ApiError) {
        setFieldErrors(error.fields);
        setFormError(error.message);
      } else {
        setFormError('We hit a snag saving that GC. Please try again.');
      }
      setSubmitting(false);
    }
  };

  return (
    <form onSubmit={submit} noValidate className="space-y-4">
      <div>
        <label htmlFor="gc-name" className="field-label">
          GC name
        </label>
        <input
          id="gc-name"
          type="text"
          value={name}
          onChange={(event) => setName(event.target.value)}
          placeholder="Turner Construction"
          className="field-input"
          maxLength={120}
        />
        <FieldError message={fieldErrors.name} />
      </div>
      <div>
        <label htmlFor="gc-vendor" className="field-label">
          Which portal do they make you use?
        </label>
        <select id="gc-vendor" value={vendorId} onChange={(event) => setVendorId(event.target.value)} className="field-input">
          <option value="">Pick later</option>
          {vendors.map((vendor) => (
            <option key={vendor.id} value={vendor.id}>
              {vendor.name}
            </option>
          ))}
        </select>
        <FieldError message={fieldErrors.portal_vendor_id} />
      </div>
      <div>
        <label htmlFor="gc-email" className="field-label">
          Contact email (optional)
        </label>
        <input
          id="gc-email"
          type="email"
          value={contactEmail}
          onChange={(event) => setContactEmail(event.target.value)}
          placeholder="pm@gcdomain.com"
          className="field-input"
          maxLength={320}
        />
        <p className="mt-1 text-xs text-gray-500">If this GC emails you from their own domain, we use it to tag their emails automatically.</p>
        <FieldError message={fieldErrors.contact_email} />
      </div>
      <div>
        <span className="field-label">Calendar color</span>
        <div role="radiogroup" aria-label="Calendar color" className="flex flex-wrap gap-2">
          {COLOR_CHOICES.map((choice) => (
            <button
              key={choice.value}
              type="button"
              role="radio"
              aria-checked={color === choice.value}
              aria-label={choice.name}
              onClick={() => setColor(choice.value)}
              className={`h-8 w-8 rounded-full ring-2 ring-offset-2 transition-all ${color === choice.value ? 'ring-gray-900' : 'ring-transparent hover:ring-gray-300'}`}
              style={{ backgroundColor: choice.value }}
            />
          ))}
        </div>
        <FieldError message={fieldErrors.color} />
      </div>
      {formError && <p className="text-sm text-red-600">{formError}</p>}
      <button type="submit" disabled={submitting} className="btn-primary w-full">
        {submitting ? 'Saving...' : mode === 'create' ? 'Add this GC' : 'Save changes'}
      </button>
    </form>
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

function GcsSkeleton() {
  return (
    <div className="space-y-6" aria-hidden="true">
      <div className="space-y-2">
        <div className="skeleton h-8 w-48 max-w-full" />
        <div className="skeleton h-4 w-72 max-w-full" />
      </div>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {[0, 1, 2].map((i) => (
          <div key={i} className="skeleton h-40" />
        ))}
      </div>
    </div>
  );
}

type ModalState = { mode: 'create' } | { mode: 'edit'; gc: GcWithVendor } | null;

export default function GcsPage() {
  const { toasts, push, dismiss } = useToasts();
  const [me, setMe] = useState<MeResponse | null>(null);
  const [gcs, setGcs] = useState<GcWithVendor[] | null>(null);
  const [vendors, setVendors] = useState<PortalVendorRow[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [modal, setModal] = useState<ModalState>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [busyIds, setBusyIds] = useState<Record<string, boolean>>({});

  const load = useCallback(async () => {
    setLoadError(null);
    try {
      const [meData, gcData, vendorData] = await Promise.all([
        apiGet<MeResponse>('/api/me'),
        apiGet<Paginated<GcWithVendor>>('/api/gcs?limit=100'),
        apiGet<Paginated<PortalVendorRow>>('/api/portal-vendors?limit=50'),
      ]);
      setMe(meData);
      setGcs(gcData.items);
      setVendors(vendorData.items);
    } catch (error) {
      if (isAuthError(error)) {
        window.location.assign('/login');
        return;
      }
      setLoadError(error instanceof Error ? error.message : 'We could not load your GCs. Please try again.');
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const handleSaved = useCallback(
    (row: GcRow, mode: 'create' | 'edit') => {
      const vendorMatch = row.portal_vendor_id ? vendors.find((vendor) => vendor.id === row.portal_vendor_id) : undefined;
      const withVendor: GcWithVendor = {
        ...row,
        portal_vendor: vendorMatch ? { id: vendorMatch.id, name: vendorMatch.name, slug: vendorMatch.slug } : null,
      };
      setGcs((list) => {
        const next = mode === 'create' ? [...(list ?? []), withVendor] : (list ?? []).map((item) => (item.id === row.id ? withVendor : item));
        return next.sort((a, b) => a.name.localeCompare(b.name));
      });
      setModal(null);
      if (mode === 'create') {
        setMe((current) => (current ? { ...current, usage: { ...current.usage, gcs: current.usage.gcs + 1 } } : current));
        push(`Added ${row.name}. Forwarded emails that match get tagged automatically.`, { tone: 'success' });
      } else {
        push('Saved.', { tone: 'success' });
      }
    },
    [push, vendors]
  );

  const removeGc = useCallback(
    async (gc: GcWithVendor) => {
      setBusyIds((current) => ({ ...current, [gc.id]: true }));
      try {
        await apiSend<{ deleted: boolean; id: string }>(`/api/gcs/${gc.id}`, 'DELETE');
        setGcs((list) => (list ?? []).filter((item) => item.id !== gc.id));
        setMe((current) => (current ? { ...current, usage: { ...current.usage, gcs: Math.max(0, current.usage.gcs - 1) } } : current));
        setDeleteId(null);
        push(`Removed ${gc.name}. Existing deadlines stay on your calendar.`, { tone: 'info' });
      } catch (error) {
        push(error instanceof ApiError ? error.message : 'We could not remove that GC. Please try again.', { tone: 'error' });
      } finally {
        setBusyIds((current) => {
          const next = { ...current };
          delete next[gc.id];
          return next;
        });
      }
    },
    [push]
  );

  const loading = !loadError && (me === null || gcs === null);
  const maxGcs = me?.limits.max_gcs ?? null;
  const atLimit = maxGcs !== null && (gcs?.length ?? 0) >= maxGcs;

  return (
    <>
      <div className="space-y-6">
        {loadError ? (
          <ErrorPanel message={loadError} onRetry={() => void load()} />
        ) : loading ? (
          <GcsSkeleton />
        ) : me && gcs ? (
          <>
            <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <h1 className="text-2xl sm:text-3xl">Your GCs</h1>
                <p className="mt-1 text-gray-600">
                  Every GC gets a color. Every email and deadline from them wears it.
                  {maxGcs !== null && ` You are tracking ${gcs.length} of ${maxGcs} on your plan.`}
                </p>
              </div>
              {atLimit ? (
                <Link href="/billing" className="btn-primary self-start sm:self-auto">
                  Go Pro for unlimited GCs
                </Link>
              ) : (
                <button type="button" onClick={() => setModal({ mode: 'create' })} className="btn-primary self-start sm:self-auto">
                  <PlusIcon className="h-4 w-4" />
                  Add GC
                </button>
              )}
            </header>

            {atLimit && (
              <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
                You are at your plan limit of {maxGcs} GCs. Pro removes the cap on GCs and parsed emails.
              </div>
            )}

            {gcs.length === 0 ? (
              <section className="card p-10 text-center">
                <h2 className="text-xl">Who do you work for?</h2>
                <p className="mx-auto mt-2 max-w-md text-sm text-gray-600">
                  Add the GCs you invoice. When their portal emails arrive, PortalPulse tags them automatically and color codes your calendar.
                </p>
                <button type="button" onClick={() => setModal({ mode: 'create' })} className="btn-primary mt-4">
                  <PlusIcon className="h-4 w-4" />
                  Add your first GC
                </button>
              </section>
            ) : (
              <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {gcs.map((gc) => (
                  <li key={gc.id} className="card flex animate-fade-up flex-col gap-3 p-5">
                    <div className="flex items-center gap-3">
                      <span className="h-3.5 w-3.5 shrink-0 rounded-full" style={{ backgroundColor: gc.color }} aria-hidden="true" />
                      <h3 className="truncate text-base font-semibold text-gray-900">{gc.name}</h3>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <span className="badge bg-gray-100 text-gray-700 ring-gray-500/20">{gc.portal_vendor?.name ?? 'Portal not set'}</span>
                    </div>
                    <p className="truncate text-sm text-gray-600">{gc.contact_email ?? 'No contact email'}</p>
                    <div className="mt-auto">
                      {deleteId === gc.id ? (
                        <div className="space-y-2">
                          <p className="text-xs text-gray-600">Remove {gc.name}? Their deadlines stay on your calendar.</p>
                          <div className="flex gap-2">
                            <button type="button" onClick={() => void removeGc(gc)} disabled={Boolean(busyIds[gc.id])} className="btn-danger px-3 py-1.5 text-xs">
                              {busyIds[gc.id] ? 'Removing...' : 'Remove'}
                            </button>
                            <button type="button" onClick={() => setDeleteId(null)} className="btn-secondary px-3 py-1.5 text-xs">
                              Keep
                            </button>
                          </div>
                        </div>
                      ) : (
                        <div className="flex gap-2">
                          <button type="button" onClick={() => setModal({ mode: 'edit', gc })} className="btn-secondary px-3 py-1.5 text-xs">
                            Edit
                          </button>
                          <button
                            type="button"
                            onClick={() => setDeleteId(gc.id)}
                            className="inline-flex items-center justify-center rounded-lg px-3 py-1.5 text-xs font-semibold text-gray-500 transition-colors hover:bg-gray-100 hover:text-gray-700"
                          >
                            Remove
                          </button>
                        </div>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </>
        ) : null}
      </div>

      {modal && (
        <Modal title={modal.mode === 'create' ? 'Add a GC' : `Edit ${modal.gc.name}`} onClose={() => setModal(null)}>
          <GcForm mode={modal.mode} gc={modal.mode === 'edit' ? modal.gc : null} vendors={vendors} onSaved={handleSaved} />
        </Modal>
      )}
      <ToastShelf toasts={toasts} onDismiss={dismiss} />
    </>
  );
}

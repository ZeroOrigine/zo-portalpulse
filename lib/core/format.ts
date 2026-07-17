// CANONICAL formatting and label helpers shared by PortalPulse dashboard pages.
// Pure functions and constant maps only. Safe to import anywhere.
import type { DeadlineType, ParseStatus } from '@/lib/db/types';

export const DEADLINE_TYPE_LABELS: Record<DeadlineType, string> = {
  coi_renewal: 'COI renewal',
  pay_app_window: 'Pay app window',
  lien_waiver: 'Lien waiver',
  compliance_doc: 'Compliance doc',
  other: 'Other',
};

export const DEADLINE_TYPE_BADGE_CLASSES: Record<DeadlineType, string> = {
  coi_renewal: 'bg-emerald-50 text-emerald-700 ring-emerald-600/20',
  pay_app_window: 'bg-blue-50 text-blue-700 ring-blue-600/20',
  lien_waiver: 'bg-purple-50 text-purple-700 ring-purple-600/20',
  compliance_doc: 'bg-amber-50 text-amber-800 ring-amber-600/20',
  other: 'bg-gray-100 text-gray-700 ring-gray-500/20',
};

export const PARSE_STATUS_LABELS: Record<ParseStatus, string> = {
  pending: 'Waiting to parse',
  processing: 'Reading email',
  parsed: 'Parsed',
  failed: 'Needs a look',
  ignored: 'Skipped',
};

export const PARSE_STATUS_BADGE_CLASSES: Record<ParseStatus, string> = {
  pending: 'bg-amber-50 text-amber-800 ring-amber-600/20',
  processing: 'bg-blue-50 text-blue-700 ring-blue-600/20',
  parsed: 'bg-emerald-50 text-emerald-700 ring-emerald-600/20',
  failed: 'bg-red-50 text-red-700 ring-red-600/20',
  ignored: 'bg-gray-100 text-gray-600 ring-gray-500/20',
};

export type DueBucket = 'overdue' | 'today' | 'week' | 'later';

export function daysUntil(iso: string): number {
  const now = new Date();
  const due = new Date(iso);
  const startToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const startDue = new Date(due.getFullYear(), due.getMonth(), due.getDate()).getTime();
  return Math.round((startDue - startToday) / 86400000);
}

export function dueBucket(iso: string): DueBucket {
  if (new Date(iso).getTime() < Date.now()) return 'overdue';
  const days = daysUntil(iso);
  if (days <= 0) return 'today';
  if (days <= 7) return 'week';
  return 'later';
}

export function dueLabel(iso: string): string {
  const days = daysUntil(iso);
  const overdue = new Date(iso).getTime() < Date.now();
  if (overdue) {
    if (days >= 0) return 'Due earlier today';
    return days === -1 ? 'Overdue by 1 day' : `Overdue by ${Math.abs(days)} days`;
  }
  if (days <= 0) return 'Due today';
  if (days === 1) return 'Due tomorrow';
  if (days <= 14) return `Due in ${days} days`;
  return `Due ${formatDateShort(iso)}`;
}

export function formatDueDate(iso: string): string {
  return new Date(iso).toLocaleString(undefined, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

export function formatDateShort(iso: string): string {
  const date = new Date(iso);
  const sameYear = date.getFullYear() === new Date().getFullYear();
  return date.toLocaleDateString(
    undefined,
    sameYear ? { month: 'short', day: 'numeric' } : { month: 'short', day: 'numeric', year: 'numeric' }
  );
}

export function formatReceivedAt(iso: string): string {
  const then = new Date(iso).getTime();
  const minutes = Math.round((Date.now() - then) / 60000);
  if (minutes < 1) return 'Just now';
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours} ${hours === 1 ? 'hr' : 'hrs'} ago`;
  const days = Math.round(hours / 24);
  if (days === 1) return 'Yesterday';
  if (days < 7) return `${days} days ago`;
  return formatDateShort(iso);
}

export function formatMoney(cents: number): string {
  const dollars = cents / 100;
  return Number.isInteger(dollars) ? `$${dollars}` : `$${dollars.toFixed(2)}`;
}

export function formatConfidence(confidence: number | null): string | null {
  if (confidence === null || confidence === undefined) return null;
  return `${Math.round(confidence * 100)}% match`;
}

export function pluralize(count: number, singular: string, plural?: string): string {
  return count === 1 ? singular : plural ?? `${singular}s`;
}

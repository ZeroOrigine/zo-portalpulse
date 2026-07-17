'use client';

// CANONICAL toast notifications for PortalPulse dashboard pages.
// One shared shape everywhere so success, error, and undo behavior never drift
// between pages. Usage: const { toasts, push, dismiss } = useToasts();
// then render <ToastShelf toasts={toasts} onDismiss={dismiss} /> once per page.
import { useCallback, useEffect, useRef, useState } from 'react';

export type ToastTone = 'success' | 'error' | 'info';

export interface ToastItem {
  id: number;
  message: string;
  tone: ToastTone;
  actionLabel?: string;
  onAction?: () => void;
}

export interface PushOptions {
  tone?: ToastTone;
  actionLabel?: string;
  onAction?: () => void;
}

export function useToasts() {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const nextId = useRef(1);
  const timers = useRef<Map<number, ReturnType<typeof setTimeout>>>(new Map());

  const dismiss = useCallback((id: number) => {
    setToasts((current) => current.filter((toast) => toast.id !== id));
    const timer = timers.current.get(id);
    if (timer) {
      clearTimeout(timer);
      timers.current.delete(id);
    }
  }, []);

  const push = useCallback(
    (message: string, options: PushOptions = {}) => {
      const id = nextId.current++;
      setToasts((current) => [
        ...current.slice(-2),
        { id, message, tone: options.tone ?? 'success', actionLabel: options.actionLabel, onAction: options.onAction },
      ]);
      timers.current.set(
        id,
        setTimeout(() => dismiss(id), options.actionLabel ? 8000 : 5000)
      );
      return id;
    },
    [dismiss]
  );

  useEffect(() => {
    const activeTimers = timers.current;
    return () => {
      activeTimers.forEach((timer) => clearTimeout(timer));
    };
  }, []);

  return { toasts, push, dismiss };
}

function toneClasses(tone: ToastTone): string {
  if (tone === 'success') return 'border-emerald-200 bg-emerald-50 text-emerald-900';
  if (tone === 'error') return 'border-red-200 bg-red-50 text-red-900';
  return 'border-gray-200 bg-white text-gray-900';
}

export function ToastShelf({ toasts, onDismiss }: { toasts: ToastItem[]; onDismiss: (id: number) => void }) {
  if (toasts.length === 0) return null;
  return (
    <div aria-live="polite" role="status" className="fixed bottom-4 right-0 z-[60] flex w-full max-w-sm flex-col gap-2 px-4 sm:right-4 sm:px-0">
      {toasts.map((toast) => (
        <div key={toast.id} className={`flex animate-fade-up items-start gap-3 rounded-xl border p-4 shadow-lg ${toneClasses(toast.tone)}`}>
          <p className="flex-1 text-sm font-medium">{toast.message}</p>
          {toast.actionLabel && toast.onAction && (
            <button
              type="button"
              onClick={() => {
                toast.onAction?.();
                onDismiss(toast.id);
              }}
              className="text-sm font-semibold underline underline-offset-2"
            >
              {toast.actionLabel}
            </button>
          )}
          <button
            type="button"
            aria-label="Dismiss notification"
            onClick={() => onDismiss(toast.id)}
            className="-m-1 rounded p-1 opacity-70 transition-opacity hover:opacity-100"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" className="h-4 w-4" aria-hidden="true">
              <path d="M6 6l12 12M18 6L6 18" />
            </svg>
          </button>
        </div>
      ))}
    </div>
  );
}

'use client';

// CANONICAL error boundary for the signed-in dashboard area of PortalPulse.
// Renders inside the dashboard shell from app/(dashboard)/layout.tsx.
import { useEffect } from 'react';
import Link from 'next/link';

export default function DashboardError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('[portalpulse/dashboard] boundary caught', error);
  }, [error]);

  return (
    <div className="mx-auto max-w-md py-16">
      <div className="card p-8 text-center">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-red-50 text-red-600">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} className="h-6 w-6" aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v4m0 4h.01M10.3 3.9L1.8 18a2 2 0 001.7 3h17a2 2 0 001.7-3L13.7 3.9a2 2 0 00-3.4 0z" />
          </svg>
        </div>
        <h1 className="mt-4 text-xl">This page hit a snag.</h1>
        <p className="mt-2 text-sm text-gray-600">Your deadlines are safe. Reload this page and it usually clears right up.</p>
        <div className="mt-6 flex flex-col justify-center gap-3 sm:flex-row">
          <button type="button" onClick={reset} className="btn-primary">
            Try again
          </button>
          <Link href="/dashboard" className="btn-secondary">
            Back to deadlines
          </Link>
        </div>
      </div>
    </div>
  );
}

'use client'

// CANONICAL: PortalPulse forgot-password page (/forgot-password). Sends a
// password reset email. The confirmation reads the same whether or not the
// address has an account, so the form never leaks who has signed up. No URL
// params are read here, so no Suspense wrapper is needed.
// Shared Spinner comes from components/ui — no local redefinition.

import { useState, type FormEvent } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { Spinner } from '@/components/ui'

const inputClasses =
  'mt-1.5 block w-full rounded-lg border border-slate-300 bg-white px-3.5 py-2.5 text-sm text-slate-900 placeholder-slate-400 shadow-sm transition-colors focus:border-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-600/20'

const primaryButtonClasses =
  'flex w-full items-center justify-center gap-2 rounded-lg bg-amber-500 px-4 py-2.5 text-sm font-semibold text-slate-900 shadow-sm transition-all hover:bg-amber-400 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-500 active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-60'

export default function ForgotPasswordPage() {
  const supabase = createClient()

  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [sentTo, setSentTo] = useState<string | null>(null)

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError(null)
    const cleanEmail = email.trim()
    if (!cleanEmail || !cleanEmail.includes('@')) {
      setError('That email does not look quite right. Mind checking it?')
      return
    }
    setLoading(true)
    const { error: resetError } = await supabase.auth.resetPasswordForEmail(cleanEmail, {
      redirectTo: `${window.location.origin}/auth/callback?next=/reset-password`,
    })
    setLoading(false)
    if (resetError) {
      const message = resetError.message.toLowerCase()
      if (message.includes('rate') || message.includes('too many')) {
        setError('A lot of reset requests in a row. Give it a minute, then try again.')
        return
      }
      // Any other outcome shows the same confirmation below: no account
      // enumeration through error differences.
    }
    setSentTo(cleanEmail)
  }

  if (sentTo) {
    return (
      <div className="w-full max-w-md">
        <div className="rounded-2xl border border-slate-200 bg-white p-8 text-center shadow-xl shadow-slate-200/60">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-emerald-100">
            <svg className="h-7 w-7 text-emerald-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 12.5l4.5 4.5L19 7.5" />
            </svg>
          </div>
          <h1 className="mt-4 text-2xl font-bold tracking-tight text-slate-900">Check your inbox</h1>
          <p className="mt-2 text-sm text-slate-600">
            If an account exists for <span className="font-semibold text-slate-900">{sentTo}</span>, a password reset link is on the way.
          </p>
          <p className="mt-4 text-xs text-slate-500">No email after a few minutes? Check your spam folder, then try again.</p>
          <Link
            href="/login"
            className="mt-6 inline-flex items-center justify-center rounded-lg border border-slate-300 bg-white px-5 py-2.5 text-sm font-semibold text-slate-700 shadow-sm transition-all hover:bg-slate-50"
          >
            Back to sign in
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="w-full max-w-md">
      <div className="rounded-2xl border border-slate-200 bg-white p-8 shadow-xl shadow-slate-200/60">
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">Reset your password</h1>
        <p className="mt-2 text-sm text-slate-600">Enter your email and we will send you a reset link.</p>

        <form onSubmit={handleSubmit} className="mt-6 space-y-4" noValidate>
          <div>
            <label htmlFor="email" className="block text-sm font-medium text-slate-700">
              Email
            </label>
            <input
              id="email"
              name="email"
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="you@yourcompany.com"
              className={inputClasses}
            />
          </div>

          {error && (
            <div role="alert" className="rounded-lg border border-red-200 bg-red-50 px-3.5 py-2.5 text-sm text-red-800">
              {error}
            </div>
          )}

          <button type="submit" disabled={loading} className={primaryButtonClasses}>
            {loading ? (
              <>
                <Spinner />
                Sending...
              </>
            ) : (
              'Send reset link'
            )}
          </button>
        </form>
      </div>

      <p className="mt-6 text-center text-sm text-slate-600">
        Remembered it?{' '}
        <Link href="/login" className="font-semibold text-blue-700 transition-colors hover:text-blue-800">
          Sign in
        </Link>
      </p>
    </div>
  )
}

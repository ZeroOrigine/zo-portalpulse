'use client'

// CANONICAL: PortalPulse reset-password page (/reset-password). The reset
// email lands here with a recovery session already set by /auth/confirm or
// /auth/callback; this page just saves the new password. No URL params are
// read, so no Suspense wrapper is needed.

import { useEffect, useState, type FormEvent } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

const inputClasses =
  'mt-1.5 block w-full rounded-lg border border-slate-300 bg-white px-3.5 py-2.5 text-sm text-slate-900 placeholder-slate-400 shadow-sm transition-colors focus:border-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-600/20'

const primaryButtonClasses =
  'flex w-full items-center justify-center gap-2 rounded-lg bg-amber-500 px-4 py-2.5 text-sm font-semibold text-slate-900 shadow-sm transition-all hover:bg-amber-400 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-500 active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-60'

function Spinner() {
  return (
    <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
    </svg>
  )
}

function EyeToggleIcon({ visible }: { visible: boolean }) {
  return visible ? (
    <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" d="M3 3l18 18M10.6 10.6a2.5 2.5 0 003.5 3.5M6.7 6.9C4.5 8.3 3 10.5 2.2 12c1.8 3.5 5.3 6.5 9.8 6.5 1.8 0 3.4-.5 4.8-1.2M9.9 4.8A10 10 0 0112 4.5c4.5 0 8 3 9.8 6.5-.5 1-1.2 2-2 2.9" />
    </svg>
  ) : (
    <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" d="M2.2 12C4 8.5 7.5 5.5 12 5.5s8 3 9.8 6.5c-1.8 3.5-5.3 6.5-9.8 6.5S4 15.5 2.2 12z" />
      <circle cx="12" cy="12" r="2.5" />
    </svg>
  )
}

export default function ResetPasswordPage() {
  const router = useRouter()

  const [sessionState, setSessionState] = useState<'checking' | 'ready' | 'missing'>('checking')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [done, setDone] = useState(false)

  useEffect(() => {
    const supabase = createClient()
    supabase.auth.getUser().then(({ data }) => {
      setSessionState(data.user ? 'ready' : 'missing')
    })
  }, [])

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError(null)
    if (password.length < 8) {
      setError('Use at least 8 characters for your new password.')
      return
    }
    if (password !== confirm) {
      setError('Those two passwords do not match. Retype them.')
      return
    }
    setLoading(true)
    const supabase = createClient()
    const { error: updateError } = await supabase.auth.updateUser({ password })
    if (updateError) {
      setLoading(false)
      const message = updateError.message.toLowerCase()
      if (message.includes('different')) {
        setError('Pick a password different from your old one.')
      } else if (message.includes('session')) {
        setSessionState('missing')
      } else {
        setError('We could not update the password just now. Wait a moment and try again.')
      }
      return
    }
    setDone(true)
    setTimeout(() => {
      router.push('/dashboard')
      router.refresh()
    }, 1400)
  }

  if (sessionState === 'checking') {
    return (
      <div className="w-full max-w-md">
        <div className="h-[320px] animate-pulse rounded-2xl border border-slate-200 bg-white shadow-xl shadow-slate-200/60" />
      </div>
    )
  }

  if (sessionState === 'missing') {
    return (
      <div className="w-full max-w-md">
        <div className="rounded-2xl border border-slate-200 bg-white p-8 text-center shadow-xl shadow-slate-200/60">
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">Link needed first</h1>
          <p className="mt-2 text-sm text-slate-600">
            This page only works right after you open a password reset link from your email.
          </p>
          <Link
            href="/forgot-password"
            className="mt-6 inline-flex items-center justify-center rounded-lg bg-amber-500 px-5 py-2.5 text-sm font-semibold text-slate-900 shadow-sm transition-all hover:bg-amber-400"
          >
            Request a fresh link
          </Link>
        </div>
      </div>
    )
  }

  if (done) {
    return (
      <div className="w-full max-w-md">
        <div className="rounded-2xl border border-slate-200 bg-white p-8 text-center shadow-xl shadow-slate-200/60">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-emerald-100">
            <svg className="h-7 w-7 text-emerald-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 12.5l4.5 4.5L19 7.5" />
            </svg>
          </div>
          <h1 className="mt-4 text-2xl font-bold tracking-tight text-slate-900">Password updated</h1>
          <p className="mt-2 text-sm text-slate-600">Taking you to your calendar...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="w-full max-w-md">
      <div className="rounded-2xl border border-slate-200 bg-white p-8 shadow-xl shadow-slate-200/60">
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">Choose a new password</h1>
        <p className="mt-2 text-sm text-slate-600">Make it at least 8 characters. You will stay signed in after saving it.</p>

        <form onSubmit={handleSubmit} className="mt-6 space-y-4" noValidate>
          <div>
            <label htmlFor="password" className="block text-sm font-medium text-slate-700">
              New password
            </label>
            <div className="relative">
              <input
                id="password"
                name="password"
                type={showPassword ? 'text' : 'password'}
                autoComplete="new-password"
                required
                minLength={8}
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                placeholder="At least 8 characters"
                className={`${inputClasses} pr-11`}
              />
              <button
                type="button"
                onClick={() => setShowPassword((value) => !value)}
                aria-label={showPassword ? 'Hide password' : 'Show password'}
                className="absolute inset-y-0 right-0 flex items-center pr-3 text-slate-400 transition-colors hover:text-slate-600"
              >
                <EyeToggleIcon visible={showPassword} />
              </button>
            </div>
          </div>

          <div>
            <label htmlFor="confirm" className="block text-sm font-medium text-slate-700">
              Type it again
            </label>
            <input
              id="confirm"
              name="confirm"
              type={showPassword ? 'text' : 'password'}
              autoComplete="new-password"
              required
              minLength={8}
              value={confirm}
              onChange={(event) => setConfirm(event.target.value)}
              placeholder="Same password"
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
                Saving...
              </>
            ) : (
              'Save new password'
            )}
          </button>
        </form>
      </div>
    </div>
  )
}

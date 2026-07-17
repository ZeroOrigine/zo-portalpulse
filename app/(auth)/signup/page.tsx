'use client'

// CANONICAL: PortalPulse signup page (/signup). Registration with email
// confirmation plus Google and GitHub OAuth, everything inline. The default
// export wraps the form in <Suspense> because it reads ?redirect via
// useSearchParams (Next.js 14 App Router rule). No segment config export
// lives here; it would be inert on a 'use client' file, so the Suspense
// wrapper alone satisfies the rule, matching the login page (QA-035).
//
// Plan copy below mirrors the portalpulse_plans seed exactly:
// free = 2 GCs and 10 parsed portal emails a month; Pro = unlimited.

import { Suspense, useState, type FormEvent } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

const inputClasses =
  'mt-1.5 block w-full rounded-lg border border-slate-300 bg-white px-3.5 py-2.5 text-sm text-slate-900 placeholder-slate-400 shadow-sm transition-colors focus:border-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-600/20'

const primaryButtonClasses =
  'flex w-full items-center justify-center gap-2 rounded-lg bg-amber-500 px-4 py-2.5 text-sm font-semibold text-slate-900 shadow-sm transition-all hover:bg-amber-400 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-500 active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-60'

const oauthButtonClasses =
  'inline-flex w-full items-center justify-center gap-2 rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 shadow-sm transition-all hover:bg-slate-50 active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-60'

function safeInternalPath(path: string | null, fallback = '/dashboard'): string {
  if (!path || !path.startsWith('/') || path.startsWith('//')) return fallback
  return path
}

function Spinner() {
  return (
    <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
    </svg>
  )
}

function GoogleIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" aria-hidden="true">
      <path fill="#4285F4" d="M23.49 12.27c0-.79-.07-1.54-.19-2.27H12v4.51h6.47c-.29 1.48-1.14 2.73-2.4 3.58v3h3.86c2.26-2.09 3.56-5.17 3.56-8.82z" />
      <path fill="#34A853" d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.86-3c-1.08.72-2.45 1.16-4.07 1.16-3.13 0-5.78-2.11-6.73-4.96H1.29v3.09C3.26 21.3 7.31 24 12 24z" />
      <path fill="#FBBC05" d="M5.27 14.29c-.25-.72-.38-1.49-.38-2.29s.14-1.57.38-2.29V6.62H1.29C.47 8.24 0 10.06 0 12s.47 3.76 1.29 5.38l3.98-3.09z" />
      <path fill="#EA4335" d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.31 0 3.26 2.7 1.29 6.62l3.98 3.09C6.22 6.86 8.87 4.75 12 4.75z" />
    </svg>
  )
}

function GitHubIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="currentColor" aria-hidden="true">
      <path fillRule="evenodd" clipRule="evenodd" d="M12 0C5.37 0 0 5.37 0 12c0 5.3 3.44 9.8 8.21 11.39.6.11.82-.26.82-.58 0-.29-.01-1.04-.02-2.04-3.34.73-4.04-1.61-4.04-1.61-.55-1.39-1.34-1.76-1.34-1.76-1.09-.75.08-.73.08-.73 1.21.09 1.84 1.24 1.84 1.24 1.07 1.84 2.81 1.31 3.5 1 .11-.78.42-1.31.76-1.61-2.67-.3-5.47-1.33-5.47-5.93 0-1.31.47-2.38 1.24-3.22-.12-.3-.54-1.52.12-3.18 0 0 1.01-.32 3.3 1.23a11.5 11.5 0 016 0c2.29-1.55 3.3-1.23 3.3-1.23.66 1.66.24 2.88.12 3.18.77.84 1.24 1.91 1.24 3.22 0 4.61-2.81 5.62-5.48 5.92.43.37.81 1.1.81 2.22 0 1.61-.01 2.9-.01 3.29 0 .32.21.7.82.58C20.56 21.8 24 17.3 24 12c0-6.63-5.37-12-12-12z" />
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

function SignupForm() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const redirectTo = safeInternalPath(searchParams.get('redirect'))
  const loginHref =
    redirectTo === '/dashboard' ? '/login' : `/login?redirect=${encodeURIComponent(redirectTo)}`

  const supabase = createClient()

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [oauthLoading, setOauthLoading] = useState<'google' | 'github' | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [sentTo, setSentTo] = useState<string | null>(null)

  const busy = loading || oauthLoading !== null

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError(null)
    const cleanEmail = email.trim()
    if (!cleanEmail || !cleanEmail.includes('@')) {
      setError('That email does not look quite right. Mind checking it?')
      return
    }
    if (password.length < 8) {
      setError('Use at least 8 characters for your password.')
      return
    }
    setLoading(true)
    const { data, error: signUpError } = await supabase.auth.signUp({
      email: cleanEmail,
      password,
      options: {
        emailRedirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(redirectTo)}`,
      },
    })
    if (signUpError) {
      setLoading(false)
      const message = signUpError.message.toLowerCase()
      if (message.includes('already registered')) {
        setError('You already have an account with that email. Sign in instead.')
      } else if (message.includes('password')) {
        setError(signUpError.message)
      } else if (message.includes('rate') || message.includes('too many')) {
        setError('A lot of signups in a row from here. Give it a minute, then try again.')
      } else {
        setError('Signup hit a snag on our side. Wait a moment and try again.')
      }
      return
    }
    if (data.session) {
      // Email confirmations are off in this environment: straight in.
      router.push(redirectTo)
      router.refresh()
      return
    }
    if (data.user && (data.user.identities?.length ?? 0) === 0) {
      // Supabase returns an identity-free user when the email already exists.
      setLoading(false)
      setError('You already have an account with that email. Sign in instead, or reset your password.')
      return
    }
    setLoading(false)
    setSentTo(cleanEmail)
  }

  async function handleOAuth(provider: 'google' | 'github') {
    setError(null)
    setOauthLoading(provider)
    const { error: oauthError } = await supabase.auth.signInWithOAuth({
      provider,
      options: {
        redirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(redirectTo)}`,
      },
    })
    if (oauthError) {
      setOauthLoading(null)
      const label = provider === 'google' ? 'Google' : 'GitHub'
      setError(`${label} signup is not available right now. Email and password still work.`)
    }
  }

  if (sentTo) {
    return (
      <div className="w-full max-w-md">
        <div className="rounded-2xl border border-slate-200 bg-white p-8 text-center shadow-xl shadow-slate-200/60">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-amber-100">
            <svg className="h-7 w-7 text-amber-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
              <path d="M3 6.5A2.5 2.5 0 015.5 4h13A2.5 2.5 0 0121 6.5v11a2.5 2.5 0 01-2.5 2.5h-13A2.5 2.5 0 013 17.5v-11z" />
              <path d="M3.5 7l7.6 5.4a1.5 1.5 0 001.8 0L20.5 7" strokeLinecap="round" />
            </svg>
          </div>
          <h1 className="mt-4 text-2xl font-bold tracking-tight text-slate-900">Check your inbox</h1>
          <p className="mt-2 text-sm text-slate-600">
            We sent a confirmation link to <span className="font-semibold text-slate-900">{sentTo}</span>. Open it and your calendar is ready.
          </p>
          <div className="mt-5 rounded-lg bg-slate-50 px-4 py-3 text-left text-sm text-slate-600">
            Once you confirm, you get a dedicated forwarding address. Forward any GC portal email to it and the deadline lands on your calendar.
          </div>
          <p className="mt-5 text-xs text-slate-500">
            No email after a few minutes? Check spam, or{' '}
            <button
              type="button"
              onClick={() => setSentTo(null)}
              className="font-semibold text-blue-700 underline underline-offset-2 transition-colors hover:text-blue-800"
            >
              try a different address
            </button>
            .
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="w-full max-w-md">
      <div className="rounded-2xl border border-slate-200 bg-white p-8 shadow-xl shadow-slate-200/60">
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">Create your account</h1>
        <p className="mt-2 text-sm text-slate-600">One calendar for every GC deadline. Free to start, no card needed.</p>

        <div className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-2">
          <button type="button" onClick={() => handleOAuth('google')} disabled={busy} className={oauthButtonClasses}>
            {oauthLoading === 'google' ? <Spinner /> : <GoogleIcon />}
            Google
          </button>
          <button type="button" onClick={() => handleOAuth('github')} disabled={busy} className={oauthButtonClasses}>
            {oauthLoading === 'github' ? <Spinner /> : <GitHubIcon />}
            GitHub
          </button>
        </div>

        <div className="mt-6 flex items-center gap-3" aria-hidden="true">
          <div className="h-px flex-1 bg-slate-200" />
          <span className="text-xs font-medium uppercase tracking-wide text-slate-400">or with email</span>
          <div className="h-px flex-1 bg-slate-200" />
        </div>

        <form onSubmit={handleSubmit} className="mt-6 space-y-4" noValidate>
          <div>
            <label htmlFor="email" className="block text-sm font-medium text-slate-700">
              Work email
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

          <div>
            <label htmlFor="password" className="block text-sm font-medium text-slate-700">
              Password
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
            <p className="mt-1.5 text-xs text-slate-500">At least 8 characters.</p>
          </div>

          {error && (
            <div role="alert" className="rounded-lg border border-red-200 bg-red-50 px-3.5 py-2.5 text-sm text-red-800">
              {error}
            </div>
          )}

          <button type="submit" disabled={busy} className={primaryButtonClasses}>
            {loading ? (
              <>
                <Spinner />
                Setting things up...
              </>
            ) : (
              'Create free account'
            )}
          </button>

          <p className="text-center text-xs text-slate-500">
            Free plan: 2 GCs and 10 parsed portal emails a month. Upgrade to Pro when you need more.
          </p>
        </form>
      </div>

      <p className="mt-6 text-center text-sm text-slate-600">
        Already have an account?{' '}
        <Link href={loginHref} className="font-semibold text-blue-700 transition-colors hover:text-blue-800">
          Sign in
        </Link>
      </p>
    </div>
  )
}

export default function SignupPage() {
  return (
    <Suspense
      fallback={
        <div className="w-full max-w-md">
          <div className="h-[470px] animate-pulse rounded-2xl border border-slate-200 bg-white shadow-xl shadow-slate-200/60" />
        </div>
      }
    >
      <SignupForm />
    </Suspense>
  )
}

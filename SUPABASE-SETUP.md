# PortalPulse: Supabase auth and payments setup

Read by the Deploy Mind. Product slug: `portalpulse`. Production URL: `https://portalpulse.zeroorigine.com`.

## 1. Auth URL configuration (Supabase dashboard or Management API)

- Site URL: `https://portalpulse.zeroorigine.com`
- Redirect URLs:
  - `https://portalpulse.zeroorigine.com/**`
  - `http://localhost:3000/**` (development)

## 2. Email templates (sender must read PortalPulse, never "Supabase")

- Sender name: `PortalPulse`
- Confirm signup link:
  `{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=signup&next=/dashboard`
- Reset password link:
  `{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=recovery&next=/reset-password`
- Magic link (only if ever enabled):
  `{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=magiclink&next=/dashboard`

Code-style links (`?code=`) are also handled at `/auth/callback`, so `{{ .ConfirmationURL }}` templates keep working during the transition.

## 3. Providers

- Email/password: enabled. Email confirmations ON. Minimum password length: 8 (the UI validates 8 as well).
- Google OAuth: enable. Authorized redirect URI: `https://<project-ref>.supabase.co/auth/v1/callback`
- GitHub OAuth: enable. Callback URL: `https://<project-ref>.supabase.co/auth/v1/callback`
- The app routes OAuth returns through `/auth/callback` (PKCE code exchange).

## 4. Environment variables (set on Netlify as non-secret, before first build)

| Name | Purpose | Exposure |
| --- | --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL (zo_config.supabase_url) | Client-safe |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase anon key (zo_config.supabase_anon_key) | Client-safe |
| `SUPABASE_SERVICE_ROLE_KEY` | Service role key for the api layer and inbound email webhook | Server-only |
| `NEXT_PUBLIC_APP_URL` | `https://portalpulse.zeroorigine.com` | Client-safe |
| `PAYMENTS_URL` | Central ZeroOrigine payments proxy endpoint | Server-only |
| `PAYMENTS_PROXY_TOKEN` | Bearer token for the payments proxy | Server-only |
| `STRIPE_PRICE_ID_PRO_MONTHLY` | Optional fallback; canonical value lives in `portalpulse_plans.stripe_price_id_monthly` | Server-only |
| `STRIPE_PRICE_ID_PRO_YEARLY` | Optional fallback; canonical value lives in `portalpulse_plans.stripe_price_id_yearly` | Server-only |

## 5. Central payments notes

- No Stripe SDK, no Stripe key and no webhook handler ship in this product. The central payments service owns the one Stripe key and the one webhook.
- Deploy layer creates the Stripe prices for Pro ($29 monthly, $290 yearly, matching `portalpulse_plans` seed cents exactly) and writes the price ids into `portalpulse_plans.stripe_price_id_monthly` and `stripe_price_id_yearly`.
- The central webhook writes `portalpulse_subscriptions` and `portalpulse_payments`. This app only reads them (owner read-only RLS).
- Plans are exactly the two seeded rows: `free` (2 GCs, 10 parsed emails per month) and `pro` (unlimited). Marketing copy must match these numbers.

## 6. Post-deploy auth smoke test (run on production URL)

1. Open `https://portalpulse.zeroorigine.com/signup`
2. Sign up with a test email and an 8+ character password
3. Confirm the email arrives from PortalPulse
4. Click the link; it must land on `https://portalpulse.zeroorigine.com/dashboard` (never localhost)
5. Sign out via POST `/api/auth/signout`
6. Sign back in at `/login`; dashboard loads with no redirect loop
7. Run the forgot-password flow; the link must land on `/reset-password` and saving a new password must work
8. While signed in, POST `/api/checkout` with `{"plan":"pro","interval":"monthly"}` and confirm a Stripe-hosted URL comes back (test mode first)
9. Confirm `GET /api/billing/status` returns the free plan with limits 2 GCs and 10 emails per month for a fresh account

-- ============================================================================
-- PortalPulse: one deadline calendar for trade subs across every GC portal.
-- Subs forward GC portal notification emails to a dedicated address. An AI
-- parser extracts deadlines (COI renewals, pay app windows, lien waiver
-- requests) into one unified calendar, regardless of which portal each GC uses.
--
-- Shared ZeroOrigine Postgres: every object is prefixed portalpulse_.
-- This file applies top to bottom in ONE pass on a fresh Supabase project.
--
-- Tables:
--   portalpulse_portal_vendors  reference: known portal vendors (seeded)
--   portalpulse_plans           reference: billing plans (seeded)
--   portalpulse_profiles        extends auth.users; holds inbound email token
--   portalpulse_gcs             general contractors a sub works with
--   portalpulse_emails          forwarded portal notification emails
--   portalpulse_deadlines       extracted deadline items (the unified calendar)
--   portalpulse_subscriptions   Stripe subscription state, one row per user
--   portalpulse_payments        one-time Stripe charges
--   portalpulse_stripe_events   webhook idempotency ledger (service role only)
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. ENUMS
-- ----------------------------------------------------------------------------
CREATE TYPE portalpulse_user_role AS ENUM ('user', 'admin');

CREATE TYPE portalpulse_parse_status AS ENUM (
  'pending', 'processing', 'parsed', 'failed', 'ignored'
);

CREATE TYPE portalpulse_deadline_type AS ENUM (
  'coi_renewal', 'pay_app_window', 'lien_waiver', 'compliance_doc', 'other'
);

CREATE TYPE portalpulse_deadline_status AS ENUM (
  'upcoming', 'completed', 'missed', 'dismissed'
);

CREATE TYPE portalpulse_deadline_source AS ENUM ('ai_parsed', 'manual');

CREATE TYPE portalpulse_subscription_status AS ENUM (
  'trialing', 'active', 'past_due', 'canceled',
  'incomplete', 'incomplete_expired', 'unpaid', 'paused'
);

CREATE TYPE portalpulse_payment_status AS ENUM (
  'pending', 'succeeded', 'failed', 'refunded'
);

-- ----------------------------------------------------------------------------
-- 2. TABLES
-- ----------------------------------------------------------------------------

-- Reference: known portal vendors. email_domains are sender-domain hints the
-- parser uses to auto-detect which portal an email came from. Editable by
-- service role only; readable by all signed-in users.
CREATE TABLE portalpulse_portal_vendors (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug          text NOT NULL UNIQUE,
  name          text NOT NULL,
  email_domains text[] NOT NULL DEFAULT '{}',
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);

-- Reference: billing plans. NULL limit means unlimited. stripe price ids are
-- filled by the Deploy layer after Stripe products are created.
CREATE TABLE portalpulse_plans (
  id                      uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug                    text NOT NULL UNIQUE,
  name                    text NOT NULL,
  description             text NOT NULL DEFAULT '',
  price_monthly_cents     integer NOT NULL DEFAULT 0 CHECK (price_monthly_cents >= 0),
  price_yearly_cents      integer NOT NULL DEFAULT 0 CHECK (price_yearly_cents >= 0),
  stripe_price_id_monthly text,
  stripe_price_id_yearly  text,
  max_gcs                 integer CHECK (max_gcs IS NULL OR max_gcs > 0),
  max_emails_per_month    integer CHECK (max_emails_per_month IS NULL OR max_emails_per_month > 0),
  is_active               boolean NOT NULL DEFAULT true,
  created_at              timestamptz NOT NULL DEFAULT now(),
  updated_at              timestamptz NOT NULL DEFAULT now()
);

-- Profiles: extends auth.users. inbound_token is the local part of the user's
-- dedicated forwarding address (for example u_<token>@in.portalpulse domain);
-- the inbound email webhook maps token to user before inserting emails.
CREATE TABLE portalpulse_profiles (
  id            uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  product_id    text NOT NULL DEFAULT 'portalpulse',
  email         text,
  full_name     text NOT NULL DEFAULT '',
  company_name  text NOT NULL DEFAULT '',
  trade         text NOT NULL DEFAULT '',
  timezone      text NOT NULL DEFAULT 'America/New_York',
  role          portalpulse_user_role NOT NULL DEFAULT 'user',
  inbound_token text NOT NULL UNIQUE DEFAULT replace(gen_random_uuid()::text, '-', ''),
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);

-- GCs: the general contractors a sub works with. color drives per-GC
-- color coding on the unified calendar.
CREATE TABLE portalpulse_gcs (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id          uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  product_id       text NOT NULL DEFAULT 'portalpulse',
  name             text NOT NULL,
  portal_vendor_id uuid REFERENCES portalpulse_portal_vendors(id) ON DELETE SET NULL,
  contact_email    text,
  color            text NOT NULL DEFAULT '#2563eb',
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now()
);

-- Emails: forwarded portal notifications. Inserted by the inbound webhook
-- (service role). message_id dedupes double-forwards per user.
CREATE TABLE portalpulse_emails (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id          uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  product_id       text NOT NULL DEFAULT 'portalpulse',
  gc_id            uuid REFERENCES portalpulse_gcs(id) ON DELETE SET NULL,
  portal_vendor_id uuid REFERENCES portalpulse_portal_vendors(id) ON DELETE SET NULL,
  message_id       text,
  from_address     text NOT NULL DEFAULT '',
  to_address       text NOT NULL DEFAULT '',
  subject          text NOT NULL DEFAULT '',
  body_text        text NOT NULL DEFAULT '',
  received_at      timestamptz NOT NULL DEFAULT now(),
  parse_status     portalpulse_parse_status NOT NULL DEFAULT 'pending',
  parse_error      text,
  parsed_at        timestamptz,
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now()
);

-- Deadlines: the kernel. One row per extracted or manually added deadline.
-- confidence is the AI extraction confidence (0 to 1), NULL for manual rows.
CREATE TABLE portalpulse_deadlines (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  product_id    text NOT NULL DEFAULT 'portalpulse',
  email_id      uuid REFERENCES portalpulse_emails(id) ON DELETE SET NULL,
  gc_id         uuid REFERENCES portalpulse_gcs(id) ON DELETE SET NULL,
  title         text NOT NULL,
  details       text NOT NULL DEFAULT '',
  deadline_type portalpulse_deadline_type NOT NULL DEFAULT 'other',
  status        portalpulse_deadline_status NOT NULL DEFAULT 'upcoming',
  source        portalpulse_deadline_source NOT NULL DEFAULT 'manual',
  confidence    numeric(3,2) CHECK (confidence IS NULL OR (confidence >= 0 AND confidence <= 1)),
  due_at        timestamptz NOT NULL,
  completed_at  timestamptz,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);

-- Subscriptions: Stripe billing state, one row per user, created by the
-- new-user trigger on the free plan. Written ONLY by the service role
-- (webhook); users get read-only access via RLS below.
CREATE TABLE portalpulse_subscriptions (
  id                     uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id                uuid NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  product_id             text NOT NULL DEFAULT 'portalpulse',
  plan                   text NOT NULL DEFAULT 'free' REFERENCES portalpulse_plans(slug),
  status                 portalpulse_subscription_status NOT NULL DEFAULT 'active',
  stripe_customer_id     text,
  stripe_subscription_id text,
  current_period_end     timestamptz,
  cancel_at_period_end   boolean NOT NULL DEFAULT false,
  created_at             timestamptz NOT NULL DEFAULT now(),
  updated_at             timestamptz NOT NULL DEFAULT now()
);

-- Payments: one-time Stripe charges. Written only by the service role.
CREATE TABLE portalpulse_payments (
  id                         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id                    uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  product_id                 text NOT NULL DEFAULT 'portalpulse',
  stripe_payment_intent_id   text,
  stripe_checkout_session_id text,
  amount_cents               integer NOT NULL CHECK (amount_cents >= 0),
  currency                   text NOT NULL DEFAULT 'usd',
  status                     portalpulse_payment_status NOT NULL DEFAULT 'pending',
  description                text NOT NULL DEFAULT '',
  created_at                 timestamptz NOT NULL DEFAULT now(),
  updated_at                 timestamptz NOT NULL DEFAULT now()
);

-- Stripe events: webhook idempotency ledger. Service role only, no policies.
CREATE TABLE portalpulse_stripe_events (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id     text NOT NULL UNIQUE,
  event_type   text NOT NULL,
  payload      jsonb NOT NULL DEFAULT '{}'::jsonb,
  processed_at timestamptz,
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE portalpulse_gcs IS 'General contractors a sub works with, each mapped to the portal vendor that GC mandates.';
COMMENT ON TABLE portalpulse_emails IS 'Forwarded GC portal notification emails, inserted by the inbound webhook and parsed by AI.';
COMMENT ON TABLE portalpulse_deadlines IS 'Extracted or manual deadline items; the rows behind the unified calendar.';
COMMENT ON COLUMN portalpulse_profiles.inbound_token IS 'Local part of the user''s dedicated forwarding address; maps inbound email to user.';

-- ----------------------------------------------------------------------------
-- 3. FUNCTIONS
-- ----------------------------------------------------------------------------

-- Keeps updated_at fresh on every UPDATE.
CREATE OR REPLACE FUNCTION portalpulse_set_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

-- SECURITY DEFINER admin check. Avoids recursive RLS when profile policies
-- need to consult the profiles table itself.
CREATE OR REPLACE FUNCTION portalpulse_is_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.portalpulse_profiles
    WHERE id = auth.uid() AND role = 'admin'
  );
$$;

-- Stamps completed_at when a deadline is marked completed, clears it otherwise.
CREATE OR REPLACE FUNCTION portalpulse_set_deadline_completed_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.status = 'completed' AND OLD.status IS DISTINCT FROM 'completed' THEN
    NEW.completed_at := now();
  ELSIF NEW.status <> 'completed' THEN
    NEW.completed_at := NULL;
  END IF;
  RETURN NEW;
END;
$$;

-- Auto-creates a profile plus a free-plan subscription row on signup.
-- The exception guard means a failure here can never block signups for
-- other products sharing this auth pool.
CREATE OR REPLACE FUNCTION portalpulse_handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.portalpulse_profiles (id, email, full_name)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data ->> 'full_name', NEW.raw_user_meta_data ->> 'name', '')
  )
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO public.portalpulse_subscriptions (user_id, plan, status)
  VALUES (NEW.id, 'free', 'active')
  ON CONFLICT (user_id) DO NOTHING;

  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RETURN NEW;
END;
$$;

-- ----------------------------------------------------------------------------
-- 4. TRIGGERS
-- ----------------------------------------------------------------------------
CREATE TRIGGER portalpulse_portal_vendors_set_updated_at
  BEFORE UPDATE ON portalpulse_portal_vendors
  FOR EACH ROW EXECUTE FUNCTION portalpulse_set_updated_at();

CREATE TRIGGER portalpulse_plans_set_updated_at
  BEFORE UPDATE ON portalpulse_plans
  FOR EACH ROW EXECUTE FUNCTION portalpulse_set_updated_at();

CREATE TRIGGER portalpulse_profiles_set_updated_at
  BEFORE UPDATE ON portalpulse_profiles
  FOR EACH ROW EXECUTE FUNCTION portalpulse_set_updated_at();

CREATE TRIGGER portalpulse_gcs_set_updated_at
  BEFORE UPDATE ON portalpulse_gcs
  FOR EACH ROW EXECUTE FUNCTION portalpulse_set_updated_at();

CREATE TRIGGER portalpulse_emails_set_updated_at
  BEFORE UPDATE ON portalpulse_emails
  FOR EACH ROW EXECUTE FUNCTION portalpulse_set_updated_at();

CREATE TRIGGER portalpulse_deadlines_set_updated_at
  BEFORE UPDATE ON portalpulse_deadlines
  FOR EACH ROW EXECUTE FUNCTION portalpulse_set_updated_at();

CREATE TRIGGER portalpulse_deadlines_set_completed_at
  BEFORE UPDATE ON portalpulse_deadlines
  FOR EACH ROW EXECUTE FUNCTION portalpulse_set_deadline_completed_at();

CREATE TRIGGER portalpulse_subscriptions_set_updated_at
  BEFORE UPDATE ON portalpulse_subscriptions
  FOR EACH ROW EXECUTE FUNCTION portalpulse_set_updated_at();

CREATE TRIGGER portalpulse_payments_set_updated_at
  BEFORE UPDATE ON portalpulse_payments
  FOR EACH ROW EXECUTE FUNCTION portalpulse_set_updated_at();

CREATE TRIGGER portalpulse_stripe_events_set_updated_at
  BEFORE UPDATE ON portalpulse_stripe_events
  FOR EACH ROW EXECUTE FUNCTION portalpulse_set_updated_at();

DROP TRIGGER IF EXISTS portalpulse_on_auth_user_created ON auth.users;
CREATE TRIGGER portalpulse_on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION portalpulse_handle_new_user();

-- ----------------------------------------------------------------------------
-- 5. INDEXES
-- All predicates and expressions are IMMUTABLE: plain columns, IS NOT NULL,
-- enum constants, and lower(). No timestamp functions, no CONCURRENTLY.
-- ----------------------------------------------------------------------------
CREATE UNIQUE INDEX portalpulse_profiles_email_lower_idx
  ON portalpulse_profiles (lower(email));

CREATE INDEX portalpulse_gcs_user_id_idx
  ON portalpulse_gcs (user_id);

CREATE INDEX portalpulse_gcs_portal_vendor_id_idx
  ON portalpulse_gcs (portal_vendor_id);

CREATE INDEX portalpulse_emails_user_received_idx
  ON portalpulse_emails (user_id, received_at DESC);

CREATE INDEX portalpulse_emails_gc_id_idx
  ON portalpulse_emails (gc_id);

CREATE INDEX portalpulse_emails_portal_vendor_id_idx
  ON portalpulse_emails (portal_vendor_id);

-- Worker queue: oldest unparsed emails first.
CREATE INDEX portalpulse_emails_pending_queue_idx
  ON portalpulse_emails (created_at)
  WHERE parse_status = 'pending';

-- Dedupe double-forwarded emails per user.
CREATE UNIQUE INDEX portalpulse_emails_user_message_id_uniq
  ON portalpulse_emails (user_id, message_id)
  WHERE message_id IS NOT NULL;

CREATE INDEX portalpulse_deadlines_user_due_idx
  ON portalpulse_deadlines (user_id, due_at);

-- Calendar hot path: a user's open deadlines in date order.
CREATE INDEX portalpulse_deadlines_user_upcoming_idx
  ON portalpulse_deadlines (user_id, due_at)
  WHERE status = 'upcoming';

CREATE INDEX portalpulse_deadlines_email_id_idx
  ON portalpulse_deadlines (email_id);

CREATE INDEX portalpulse_deadlines_gc_id_idx
  ON portalpulse_deadlines (gc_id);

CREATE INDEX portalpulse_subscriptions_plan_idx
  ON portalpulse_subscriptions (plan);

-- Webhook lookups by Stripe customer.
CREATE INDEX portalpulse_subscriptions_customer_idx
  ON portalpulse_subscriptions (stripe_customer_id)
  WHERE stripe_customer_id IS NOT NULL;

-- Nullable unique key: partial unique index, no COALESCE casts.
CREATE UNIQUE INDEX portalpulse_subscriptions_stripe_sub_uniq
  ON portalpulse_subscriptions (stripe_subscription_id)
  WHERE stripe_subscription_id IS NOT NULL;

CREATE INDEX portalpulse_payments_user_created_idx
  ON portalpulse_payments (user_id, created_at DESC);

CREATE UNIQUE INDEX portalpulse_payments_intent_uniq
  ON portalpulse_payments (stripe_payment_intent_id)
  WHERE stripe_payment_intent_id IS NOT NULL;

-- ----------------------------------------------------------------------------
-- 6. ROW LEVEL SECURITY
-- ----------------------------------------------------------------------------
ALTER TABLE portalpulse_portal_vendors ENABLE ROW LEVEL SECURITY;
ALTER TABLE portalpulse_plans          ENABLE ROW LEVEL SECURITY;
ALTER TABLE portalpulse_profiles       ENABLE ROW LEVEL SECURITY;
ALTER TABLE portalpulse_gcs            ENABLE ROW LEVEL SECURITY;
ALTER TABLE portalpulse_emails         ENABLE ROW LEVEL SECURITY;
ALTER TABLE portalpulse_deadlines      ENABLE ROW LEVEL SECURITY;
ALTER TABLE portalpulse_subscriptions  ENABLE ROW LEVEL SECURITY;
ALTER TABLE portalpulse_payments       ENABLE ROW LEVEL SECURITY;
ALTER TABLE portalpulse_stripe_events  ENABLE ROW LEVEL SECURITY;

-- Reference tables: readable by signed-in users, written by service role only.
CREATE POLICY "portalpulse_portal_vendors_read" ON portalpulse_portal_vendors
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "portalpulse_plans_read" ON portalpulse_plans
  FOR SELECT TO authenticated USING (true);

-- Profiles: keyed by auth uid.
CREATE POLICY "portalpulse_profiles_owner" ON portalpulse_profiles
  FOR ALL TO authenticated
  USING (id = auth.uid())
  WITH CHECK (id = auth.uid());

CREATE POLICY "portalpulse_profiles_admin_read" ON portalpulse_profiles
  FOR SELECT TO authenticated USING (portalpulse_is_admin());

-- User-owned tables: canonical owner policy, tenant isolated by uid + product.
CREATE POLICY "portalpulse_gcs_owner" ON portalpulse_gcs
  FOR ALL TO authenticated
  USING (user_id = auth.uid() AND product_id = 'portalpulse')
  WITH CHECK (user_id = auth.uid() AND product_id = 'portalpulse');

CREATE POLICY "portalpulse_emails_owner" ON portalpulse_emails
  FOR ALL TO authenticated
  USING (user_id = auth.uid() AND product_id = 'portalpulse')
  WITH CHECK (user_id = auth.uid() AND product_id = 'portalpulse');

CREATE POLICY "portalpulse_deadlines_owner" ON portalpulse_deadlines
  FOR ALL TO authenticated
  USING (user_id = auth.uid() AND product_id = 'portalpulse')
  WITH CHECK (user_id = auth.uid() AND product_id = 'portalpulse');

-- Billing tables are deliberately READ ONLY for owners. Writes come from the
-- Stripe webhook via service role, which bypasses RLS. A FOR ALL policy here
-- would let any signed-in user set their own plan to pro without paying.
CREATE POLICY "portalpulse_subscriptions_owner_read" ON portalpulse_subscriptions
  FOR SELECT TO authenticated
  USING (user_id = auth.uid() AND product_id = 'portalpulse');

CREATE POLICY "portalpulse_subscriptions_admin_read" ON portalpulse_subscriptions
  FOR SELECT TO authenticated USING (portalpulse_is_admin());

CREATE POLICY "portalpulse_payments_owner_read" ON portalpulse_payments
  FOR SELECT TO authenticated
  USING (user_id = auth.uid() AND product_id = 'portalpulse');

-- portalpulse_stripe_events: RLS enabled with NO policies on purpose.
-- Only the service role (webhook) can touch it.

-- Grant hardening. Anon never touches product tables; RLS already denies,
-- these revokes add defense in depth.
REVOKE ALL ON portalpulse_portal_vendors, portalpulse_plans, portalpulse_profiles,
  portalpulse_gcs, portalpulse_emails, portalpulse_deadlines,
  portalpulse_subscriptions, portalpulse_payments, portalpulse_stripe_events
FROM anon;

REVOKE ALL ON portalpulse_stripe_events FROM authenticated;

-- Profiles column hardening: users may edit display fields only. role and
-- inbound_token stay server-managed, so nobody can self-promote to admin or
-- hijack a forwarding address. Rows are created by the signup trigger.
REVOKE INSERT, UPDATE, DELETE ON portalpulse_profiles FROM authenticated;
GRANT UPDATE (full_name, company_name, trade, timezone)
  ON portalpulse_profiles TO authenticated;

-- ----------------------------------------------------------------------------
-- 7. SEED DATA
-- ----------------------------------------------------------------------------
INSERT INTO portalpulse_portal_vendors (slug, name, email_domains) VALUES
  ('gcpay',     'GCPay',          ARRAY['gcpay.com']),
  ('textura',   'Oracle Textura', ARRAY['texturacorp.com']),
  ('procore',   'Procore',        ARRAY['procore.com']),
  ('buildbite', 'Buildbite',      ARRAY['buildbite.com']),
  ('other',     'Other portal',   ARRAY[]::text[])
ON CONFLICT (slug) DO NOTHING;

-- Plan limits are the single source of truth for gating and marketing copy.
-- NULL means unlimited: Pro is unlimited GCs and unlimited parsed emails.
INSERT INTO portalpulse_plans
  (slug, name, description, price_monthly_cents, price_yearly_cents, max_gcs, max_emails_per_month)
VALUES
  ('free', 'Free',
   'Track deadlines from up to 2 GCs with 10 parsed portal emails per month.',
   0, 0, 2, 10),
  ('pro', 'Pro',
   'Unlimited GCs and unlimited parsed portal emails every month.',
   2900, 29000, NULL, NULL)
ON CONFLICT (slug) DO NOTHING;

-- Self-validation patches
-- No schema changes required.
-- Re-verified in this pass: RLS enabled on all 9 portalpulse_ tables with owner
-- policies (billing tables owner-READ-only; portalpulse_stripe_events has RLS
-- enabled and zero policies on purpose — service role only). Indexes cover every
-- FK and hot path (user_id+due_at, user_id+received_at DESC, pending-parse queue,
-- partial uniques for Stripe ids and message_id dedupe). Column grants keep role
-- and inbound_token server-managed. Seed limits (free: 2 GCs / 10 emails per
-- month; pro: unlimited at 2900/29000 cents) are the single source of truth the
-- patched marketing pages now mirror exactly.
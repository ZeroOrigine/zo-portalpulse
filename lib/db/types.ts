// CANONICAL shared row types and explicit column lists for PortalPulse.
// Column lists keep every query explicit: no select('*') anywhere in this product.

export const DEADLINE_TYPES = ['coi_renewal', 'pay_app_window', 'lien_waiver', 'compliance_doc', 'other'] as const;
export type DeadlineType = (typeof DEADLINE_TYPES)[number];

export const DEADLINE_STATUSES = ['upcoming', 'completed', 'missed', 'dismissed'] as const;
export type DeadlineStatus = (typeof DEADLINE_STATUSES)[number];

export const PARSE_STATUSES = ['pending', 'processing', 'parsed', 'failed', 'ignored'] as const;
export type ParseStatus = (typeof PARSE_STATUSES)[number];

export type DeadlineSource = 'ai_parsed' | 'manual';

export type SubscriptionStatus =
  | 'trialing'
  | 'active'
  | 'past_due'
  | 'canceled'
  | 'incomplete'
  | 'incomplete_expired'
  | 'unpaid'
  | 'paused';

export interface GcRow {
  id: string;
  name: string;
  portal_vendor_id: string | null;
  contact_email: string | null;
  color: string;
  created_at: string;
  updated_at: string;
}

export interface DeadlineRow {
  id: string;
  email_id: string | null;
  gc_id: string | null;
  title: string;
  details: string;
  deadline_type: DeadlineType;
  status: DeadlineStatus;
  source: DeadlineSource;
  confidence: number | null;
  due_at: string;
  completed_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface EmailListRow {
  id: string;
  gc_id: string | null;
  portal_vendor_id: string | null;
  message_id: string | null;
  from_address: string;
  subject: string;
  received_at: string;
  parse_status: ParseStatus;
  parse_error: string | null;
  parsed_at: string | null;
  created_at: string;
}

export interface EmailDetailRow extends EmailListRow {
  to_address: string;
  body_text: string;
}

export interface ProfileRow {
  id: string;
  email: string | null;
  full_name: string;
  company_name: string;
  trade: string;
  timezone: string;
  role: 'user' | 'admin';
  inbound_token: string;
  created_at: string;
}

export interface SubscriptionRow {
  plan: string;
  status: SubscriptionStatus;
  current_period_end: string | null;
  cancel_at_period_end: boolean;
}

export interface PlanRow {
  slug: string;
  name: string;
  description: string;
  price_monthly_cents: number;
  price_yearly_cents: number;
  max_gcs: number | null;
  max_emails_per_month: number | null;
  is_active: boolean;
}

export interface PortalVendorRow {
  id: string;
  slug: string;
  name: string;
  email_domains: string[];
}

export interface PortalVendorSummary {
  id: string;
  name: string;
  slug: string;
}

export interface GcSummary {
  id: string;
  name: string;
  color: string;
}

export interface GcWithVendor extends GcRow {
  portal_vendor: PortalVendorSummary | null;
}

export interface DeadlineWithGc extends DeadlineRow {
  gc: GcSummary | null;
}

export interface EmailWithRelations extends EmailListRow {
  gc: GcSummary | null;
  portal_vendor: PortalVendorSummary | null;
}

export interface EmailDetailWithRelations extends EmailDetailRow {
  gc: GcSummary | null;
  portal_vendor: PortalVendorSummary | null;
}

export interface Paginated<T> {
  items: T[];
  page: number;
  limit: number;
  total: number;
}

export const GC_COLUMNS = 'id, name, portal_vendor_id, contact_email, color, created_at, updated_at';
export const DEADLINE_COLUMNS =
  'id, email_id, gc_id, title, details, deadline_type, status, source, confidence, due_at, completed_at, created_at, updated_at';
export const EMAIL_LIST_COLUMNS =
  'id, gc_id, portal_vendor_id, message_id, from_address, subject, received_at, parse_status, parse_error, parsed_at, created_at';
export const EMAIL_DETAIL_COLUMNS =
  'id, gc_id, portal_vendor_id, message_id, from_address, to_address, subject, body_text, received_at, parse_status, parse_error, parsed_at, created_at';
export const PROFILE_COLUMNS = 'id, email, full_name, company_name, trade, timezone, role, inbound_token, created_at';
export const SUBSCRIPTION_COLUMNS = 'plan, status, current_period_end, cancel_at_period_end';
export const PLAN_COLUMNS =
  'slug, name, description, price_monthly_cents, price_yearly_cents, max_gcs, max_emails_per_month, is_active';
export const PORTAL_VENDOR_COLUMNS = 'id, slug, name, email_domains';

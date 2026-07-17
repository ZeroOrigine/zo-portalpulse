// CANONICAL inbound forwarding-address helpers for PortalPulse.
// The forwarding address format is u_<token>@<inbound domain>. The token is the
// inbound_token column on portalpulse_profiles, server managed only.

export function inboundEmailDomain(): string {
  return (
    process.env.INBOUND_EMAIL_DOMAIN ??
    process.env.NEXT_PUBLIC_INBOUND_EMAIL_DOMAIN ??
    'in.portalpulse.zeroorigine.com'
  );
}

export function forwardingAddressForToken(token: string): string {
  return `u_${token}@${inboundEmailDomain()}`;
}

// Accepts "Name <u_abc@domain>", "u_abc@domain", comma lists, and plus tags.
export function extractInboundToken(recipient: string): string | null {
  const first = (recipient.split(',')[0] ?? '').trim().toLowerCase();
  const angleMatch = first.match(/<([^>]+)>/);
  const address = angleMatch ? angleMatch[1] : first;
  const localPart = address.split('@')[0] ?? '';
  const withoutTag = localPart.split('+')[0] ?? '';
  const token = withoutTag.startsWith('u_') ? withoutTag.slice(2) : withoutTag;
  return /^[a-z0-9]{8,64}$/.test(token) ? token : null;
}

export function emailDomainOf(address: string): string | null {
  const match = address.toLowerCase().match(/@([a-z0-9.-]+)/);
  return match ? match[1] : null;
}

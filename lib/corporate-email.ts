export const DEFAULT_BLOCKED_DOMAINS: ReadonlySet<string> = new Set([
  "gmail.com",
  "googlemail.com",
  "hotmail.com",
  "hotmail.com.br",
  "outlook.com",
  "outlook.com.br",
  "live.com",
  "yahoo.com",
  "yahoo.com.br",
  "icloud.com",
  "me.com",
  "aol.com",
  "proton.me",
  "protonmail.com",
  "mail.com",
  "gmx.com",
  "zoho.com",
  "yandex.com",
  "bol.com.br",
  "uol.com.br",
  "terra.com.br",
  "ig.com.br",
  "r7.com",
  "msn.com",
  "fastmail.com",
  "tutanota.com",
]);

export const DEFAULT_DISPOSABLE_DOMAINS: ReadonlySet<string> = new Set([
  "mailinator.com",
  "tempmail.com",
  "10minutemail.com",
  "guerrillamail.com",
  "throwawaymail.com",
  "yopmail.com",
  "trashmail.com",
  "getairmail.com",
  "sharklasers.com",
]);

const EMAIL_RE =
  /^[A-Za-z0-9._%+-]+@[A-Za-z0-9](?:[A-Za-z0-9-]{0,61}[A-Za-z0-9])?(?:\.[A-Za-z0-9](?:[A-Za-z0-9-]{0,61}[A-Za-z0-9])?)+$/;

export type EmailValidationReason =
  | "invalid_format"
  | "blocked_domain"
  | "disposable"
  | "no_mx_record"
  | "mx_lookup_failed";

export interface EmailValidationOptions {
  corporateOnly?: boolean;
  blockedDomains?: Iterable<string>;
  disposableDomains?: Iterable<string>;
}

export function extractDomain(email: string): string | null {
  const at = email.lastIndexOf("@");
  if (at < 1 || at === email.length - 1) return null;
  return email.slice(at + 1).toLowerCase();
}

export function validateEmail(
  email: string,
  opts: EmailValidationOptions = {},
): { ok: true } | { ok: false; reason: EmailValidationReason } {
  if (!EMAIL_RE.test(email)) {
    return { ok: false, reason: "invalid_format" };
  }
  const domain = extractDomain(email);
  if (!domain) return { ok: false, reason: "invalid_format" };

  const disposable = opts.disposableDomains
    ? new Set(opts.disposableDomains)
    : DEFAULT_DISPOSABLE_DOMAINS;
  if (disposable.has(domain)) {
    return { ok: false, reason: "disposable" };
  }

  if (opts.corporateOnly) {
    const blocked = opts.blockedDomains
      ? new Set(opts.blockedDomains)
      : DEFAULT_BLOCKED_DOMAINS;
    if (blocked.has(domain)) {
      return { ok: false, reason: "blocked_domain" };
    }
  }

  return { ok: true };
}

/**
 * Parses the BLOCKED_EMAIL_DOMAINS env var as a CSV. Empty/missing
 * returns null so callers fall back to DEFAULT_BLOCKED_DOMAINS.
 * Server-side use only.
 */
export function getBlockedDomainsFromEnv(): Set<string> | null {
  const raw = process.env.BLOCKED_EMAIL_DOMAINS;
  if (!raw) return null;
  const domains = raw
    .split(",")
    .map((d) => d.trim().toLowerCase())
    .filter((d) => d.length > 0);
  return domains.length > 0 ? new Set(domains) : null;
}

/**
 * Resolved blocklist for server-side checks: env override OR default.
 */
export function getEffectiveBlockedDomains(): Set<string> {
  return getBlockedDomainsFromEnv() ?? new Set(DEFAULT_BLOCKED_DOMAINS);
}


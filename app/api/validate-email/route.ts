import { z } from "zod";

import {
  DEFAULT_DISPOSABLE_DOMAINS,
  extractDomain,
  getEffectiveBlockedDomains,
  validateEmail,
  type EmailValidationReason,
} from "@/lib/corporate-email";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const BodySchema = z.object({
  email: z.string().min(3).max(320),
  corporateOnly: z.boolean().optional(),
});

interface Verdict {
  ok: boolean;
  reason?: EmailValidationReason;
}

const MX_CACHE_TTL_MS = 1000 * 60 * 60 * 24; // 24h
const MX_CACHE_NEG_TTL_MS = 1000 * 60 * 60; // negative TTL: 1h
const mxCache = new Map<string, { hasMx: boolean; expiresAt: number }>();

const MX_LOOKUP_ENABLED = process.env.EMAIL_VALIDATION_MX === "1";

async function hasMxRecord(domain: string): Promise<boolean | null> {
  const cached = mxCache.get(domain);
  if (cached && cached.expiresAt > Date.now()) return cached.hasMx;

  try {
    const dns = await import("node:dns/promises");
    const records = await dns.resolveMx(domain);
    const hasMx = records.length > 0;
    mxCache.set(domain, {
      hasMx,
      expiresAt: Date.now() + (hasMx ? MX_CACHE_TTL_MS : MX_CACHE_NEG_TTL_MS),
    });
    return hasMx;
  } catch (err) {
    const code = (err as NodeJS.ErrnoException).code ?? "";
    // ENODATA / ENOTFOUND mean the domain has no MX record (or doesn't exist)
    if (code === "ENODATA" || code === "ENOTFOUND") {
      mxCache.set(domain, {
        hasMx: false,
        expiresAt: Date.now() + MX_CACHE_NEG_TTL_MS,
      });
      return false;
    }
    // SERVFAIL / TIMEOUT: don't cache, signal lookup error
    return null;
  }
}

function buildVerdict({
  email,
  corporateOnly,
  blocked,
}: {
  email: string;
  corporateOnly: boolean;
  blocked: Set<string>;
}): Verdict {
  return validateEmail(email, {
    corporateOnly,
    blockedDomains: blocked,
    disposableDomains: DEFAULT_DISPOSABLE_DOMAINS,
  });
}

export async function POST(req: Request) {
  let json: unknown;
  try {
    json = await req.json();
  } catch {
    return Response.json(
      { ok: false, reason: "invalid_format" },
      { status: 400 },
    );
  }

  const parsed = BodySchema.safeParse(json);
  if (!parsed.success) {
    return Response.json(
      { ok: false, reason: "invalid_format" },
      { status: 400 },
    );
  }

  const email = parsed.data.email.trim().toLowerCase();
  const corporateOnly = parsed.data.corporateOnly ?? false;
  const blocked = getEffectiveBlockedDomains();

  const localVerdict = buildVerdict({ email, corporateOnly, blocked });
  if (!localVerdict.ok) {
    return Response.json(localVerdict);
  }

  if (!MX_LOOKUP_ENABLED) {
    return Response.json({ ok: true });
  }

  const domain = extractDomain(email);
  if (!domain) {
    return Response.json({ ok: false, reason: "invalid_format" });
  }

  const mx = await hasMxRecord(domain);
  if (mx === false) {
    return Response.json({ ok: false, reason: "no_mx_record" });
  }
  // mx === null means lookup failed transiently — let the lead through
  // (do not punish the user for our DNS hiccup).
  return Response.json({ ok: true });
}

export async function GET() {
  return Response.json(
    {
      ok: true,
      mxEnabled: MX_LOOKUP_ENABLED,
      blockedCount: getEffectiveBlockedDomains().size,
    },
    { headers: { "cache-control": "no-store" } },
  );
}

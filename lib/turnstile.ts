const VERIFY_URL = "https://challenges.cloudflare.com/turnstile/v0/siteverify";
const TIMEOUT_MS = 5_000;

export function isTurnstileEnabled(): boolean {
  return Boolean(process.env.TURNSTILE_SECRET_KEY);
}

export interface TurnstileResult {
  ok: boolean;
  error?: string;
}

/**
 * Verifies a Turnstile token with Cloudflare. No-op (ok:true) when
 * TURNSTILE_SECRET_KEY is unset, so local dev / unconfigured deploys
 * remain functional. Returns ok:false only when the secret IS set and
 * Cloudflare explicitly rejects the token.
 */
export async function verifyTurnstile(
  token: string | undefined,
  ip: string,
): Promise<TurnstileResult> {
  if (!isTurnstileEnabled()) return { ok: true };
  if (!token) return { ok: false, error: "missing_token" };

  const body = new URLSearchParams({
    secret: process.env.TURNSTILE_SECRET_KEY!,
    response: token,
    remoteip: ip,
  });

  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(VERIFY_URL, {
      method: "POST",
      body,
      signal: ctrl.signal,
      headers: { "content-type": "application/x-www-form-urlencoded" },
    });
    const data = (await res.json()) as { success?: boolean };
    return data.success === true
      ? { ok: true }
      : { ok: false, error: "verify_failed" };
  } catch {
    // Network/timeout: fail open so we don't lose leads on Cloudflare hiccup.
    return { ok: true, error: "verify_unavailable" };
  } finally {
    clearTimeout(t);
  }
}

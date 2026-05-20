"use client";

import type { EmailValidationReason } from "@/lib/corporate-email";

interface Verdict {
  ok: boolean;
  reason?: EmailValidationReason;
}

const inflight = new Map<string, Promise<Verdict>>();
const resultCache = new Map<string, { verdict: Verdict; expiresAt: number }>();
const CACHE_TTL_MS = 1000 * 60 * 10; // 10 min client-side

/**
 * Calls /api/validate-email with the trimmed email and corporateOnly flag.
 * Dedupes concurrent requests for the same payload and caches verdicts
 * for 10 minutes so re-typing the same value doesn't refetch.
 * Returns ok:true on network/server errors so we never punish a lead
 * because of our infrastructure.
 */
export async function validateEmailRemote(
  email: string,
  corporateOnly: boolean,
  signal?: AbortSignal,
): Promise<Verdict> {
  const key = `${email}|${corporateOnly ? 1 : 0}`;

  const cached = resultCache.get(key);
  if (cached && cached.expiresAt > Date.now()) return cached.verdict;

  const existing = inflight.get(key);
  if (existing) return existing;

  const promise = (async (): Promise<Verdict> => {
    try {
      const res = await fetch("/api/validate-email", {
        method: "POST",
        signal,
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email, corporateOnly }),
      });
      if (!res.ok && res.status !== 400) {
        return { ok: true };
      }
      const data = (await res.json()) as Verdict;
      resultCache.set(key, {
        verdict: data,
        expiresAt: Date.now() + CACHE_TTL_MS,
      });
      return data;
    } catch {
      return { ok: true };
    } finally {
      inflight.delete(key);
    }
  })();

  inflight.set(key, promise);
  return promise;
}

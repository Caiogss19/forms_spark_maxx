// In-memory per-IP rate limiter for the /api/submit edge boundary.
// Sliding window over 60s. Not durable across cold starts, but it
// raises the bar enough for a lead-capture endpoint; swap for Redis/Upstash
// when traffic warrants it.

const WINDOW_MS = 60_000;
const DEFAULT_LIMIT = 10;

interface Bucket {
  hits: number[];
}

const buckets = new Map<string, Bucket>();

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  retryAfterMs: number;
}

export function getRateLimitFromEnv(): number {
  const raw = process.env.RATE_LIMIT_PER_MIN;
  if (!raw) return DEFAULT_LIMIT;
  const n = Number(raw);
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : DEFAULT_LIMIT;
}

export function consumeRateLimit(
  ip: string,
  limit = getRateLimitFromEnv(),
): RateLimitResult {
  const now = Date.now();
  const bucket = buckets.get(ip) ?? { hits: [] };

  bucket.hits = bucket.hits.filter((t) => now - t < WINDOW_MS);

  if (bucket.hits.length >= limit) {
    const oldest = bucket.hits[0];
    buckets.set(ip, bucket);
    return {
      allowed: false,
      remaining: 0,
      retryAfterMs: Math.max(0, WINDOW_MS - (now - oldest)),
    };
  }

  bucket.hits.push(now);
  buckets.set(ip, bucket);
  return {
    allowed: true,
    remaining: Math.max(0, limit - bucket.hits.length),
    retryAfterMs: 0,
  };
}

export function ipFromRequest(req: Request): string {
  const xff = req.headers.get("x-forwarded-for");
  if (xff) return xff.split(",")[0].trim();
  const real = req.headers.get("x-real-ip");
  if (real) return real.trim();
  return "0.0.0.0";
}

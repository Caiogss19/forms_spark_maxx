const TIMEOUT_MS = 8_000;
const RETRY_DELAYS_MS = [1_000, 3_000, 9_000]; // backoff between attempts

export interface WebhookResult {
  ok: boolean;
  status: number;
  attempts: number;
  error?: string;
}

interface WebhookOptions {
  url: string;
  payload: unknown;
  authHeader?: string;
  timeoutMs?: number;
  retryDelaysMs?: number[];
}

async function attempt(
  url: string,
  payload: unknown,
  authHeader: string | undefined,
  timeoutMs: number,
): Promise<{ ok: boolean; status: number; error?: string }> {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      method: "POST",
      signal: ctrl.signal,
      headers: {
        "content-type": "application/json",
        ...(authHeader ? { authorization: authHeader } : {}),
      },
      body: JSON.stringify(payload),
    });
    return { ok: res.ok, status: res.status };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return { ok: false, status: 0, error: message };
  } finally {
    clearTimeout(t);
  }
}

function sleep(ms: number) {
  return new Promise<void>((r) => setTimeout(r, ms));
}

/**
 * POSTs payload to the configured webhook with exponential retries.
 * Retries on network errors (status 0) and 5xx. 4xx responses are treated
 * as terminal — they signal a bad request, not a transient failure.
 */
export async function sendWebhook(
  opts: WebhookOptions,
): Promise<WebhookResult> {
  const delays = opts.retryDelaysMs ?? RETRY_DELAYS_MS;
  const timeoutMs = opts.timeoutMs ?? TIMEOUT_MS;
  const maxAttempts = delays.length + 1;

  let lastError: string | undefined;
  let lastStatus = 0;

  for (let i = 0; i < maxAttempts; i++) {
    const result = await attempt(
      opts.url,
      opts.payload,
      opts.authHeader,
      timeoutMs,
    );
    if (result.ok) {
      return { ok: true, status: result.status, attempts: i + 1 };
    }
    lastStatus = result.status;
    lastError = result.error;

    const isTerminal = result.status >= 400 && result.status < 500;
    if (isTerminal) {
      return {
        ok: false,
        status: result.status,
        attempts: i + 1,
        error: result.error ?? `http_${result.status}`,
      };
    }

    if (i < delays.length) await sleep(delays[i]);
  }

  return {
    ok: false,
    status: lastStatus,
    attempts: maxAttempts,
    error: lastError ?? `http_${lastStatus}`,
  };
}

// Thin REST wrapper for Supabase to avoid pulling the @supabase/* SDK
// into the bundle. We only need INSERT on a single table for the
// failed-submissions fallback, so this stays minimal.

interface SupabaseEnv {
  url: string;
  serviceKey: string;
}

export function isSupabaseConfigured(): boolean {
  return Boolean(process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_KEY);
}

function readEnv(): SupabaseEnv | null {
  const url = process.env.SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_KEY;
  if (!url || !serviceKey) return null;
  return { url: url.replace(/\/+$/, ""), serviceKey };
}

export interface FailedSubmissionRecord {
  form_slug: string;
  payload: Record<string, unknown>;
  webhook_status: "failed";
  webhook_attempts: number;
  webhook_last_error: string;
  ip?: string;
}

/**
 * Inserts into form_submissions when the webhook chain exhausts retries.
 * Silently no-ops when Supabase isn't configured. Never throws — the
 * caller should treat this as best-effort.
 */
export async function saveFailedSubmission(
  record: FailedSubmissionRecord,
): Promise<{ ok: boolean; id?: string; error?: string }> {
  const env = readEnv();
  if (!env) return { ok: false, error: "supabase_not_configured" };

  try {
    const res = await fetch(`${env.url}/rest/v1/form_submissions`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        apikey: env.serviceKey,
        authorization: `Bearer ${env.serviceKey}`,
        prefer: "return=representation",
      },
      body: JSON.stringify(record),
    });
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      return { ok: false, error: `supabase_${res.status}: ${text.slice(0, 200)}` };
    }
    const data = (await res.json().catch(() => null)) as
      | Array<{ id?: string }>
      | null;
    return { ok: true, id: data?.[0]?.id };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "unknown" };
  }
}

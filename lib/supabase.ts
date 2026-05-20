// Thin REST wrapper for Supabase to avoid pulling the @supabase/* SDK
// into the bundle. We use it for two things:
//   1. failed-submission fallback when the n8n webhook is unhappy
//   2. live-editable form definitions (admin editor writes here, the
//      runner reads here-then-filesystem on every request)

import "server-only";

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

function authHeaders(env: SupabaseEnv) {
  return {
    apikey: env.serviceKey,
    authorization: `Bearer ${env.serviceKey}`,
  };
}

export interface FailedSubmissionRecord {
  form_slug: string;
  payload: Record<string, unknown>;
  webhook_status: "failed";
  webhook_attempts: number;
  webhook_last_error: string;
  ip?: string;
}

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
        prefer: "return=representation",
        ...authHeaders(env),
      },
      body: JSON.stringify(record),
    });
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      return {
        ok: false,
        error: `supabase_${res.status}: ${text.slice(0, 200)}`,
      };
    }
    const data = (await res.json().catch(() => null)) as
      | Array<{ id?: string }>
      | null;
    return { ok: true, id: data?.[0]?.id };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "unknown" };
  }
}

// ─── Forms table ─────────────────────────────────────────────────────

export interface FormRow {
  slug: string;
  schema: unknown;
  active: boolean;
  updated_at: string;
}

export async function listFormRows(): Promise<FormRow[] | null> {
  const env = readEnv();
  if (!env) return null;
  try {
    const res = await fetch(
      `${env.url}/rest/v1/forms?select=slug,schema,active,updated_at&order=updated_at.desc`,
      { headers: authHeaders(env), cache: "no-store" },
    );
    if (!res.ok) return null;
    return (await res.json()) as FormRow[];
  } catch {
    return null;
  }
}

export async function getFormRow(slug: string): Promise<FormRow | null> {
  const env = readEnv();
  if (!env) return null;
  try {
    const res = await fetch(
      `${env.url}/rest/v1/forms?slug=eq.${encodeURIComponent(slug)}&select=slug,schema,active,updated_at&limit=1`,
      { headers: authHeaders(env), cache: "no-store" },
    );
    if (!res.ok) return null;
    const rows = (await res.json()) as FormRow[];
    return rows[0] ?? null;
  } catch {
    return null;
  }
}

export async function upsertFormRow(
  slug: string,
  schema: unknown,
  active = true,
): Promise<{ ok: boolean; error?: string }> {
  const env = readEnv();
  if (!env) return { ok: false, error: "supabase_not_configured" };
  try {
    const res = await fetch(
      `${env.url}/rest/v1/forms?on_conflict=slug`,
      {
        method: "POST",
        headers: {
          "content-type": "application/json",
          prefer: "resolution=merge-duplicates,return=representation",
          ...authHeaders(env),
        },
        body: JSON.stringify({
          slug,
          schema,
          active,
          updated_at: new Date().toISOString(),
        }),
      },
    );
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      return { ok: false, error: `supabase_${res.status}: ${text.slice(0, 200)}` };
    }
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "unknown" };
  }
}

export async function deleteFormRow(
  slug: string,
): Promise<{ ok: boolean; error?: string }> {
  const env = readEnv();
  if (!env) return { ok: false, error: "supabase_not_configured" };
  try {
    const res = await fetch(
      `${env.url}/rest/v1/forms?slug=eq.${encodeURIComponent(slug)}`,
      { method: "DELETE", headers: authHeaders(env) },
    );
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      return {
        ok: false,
        error: `supabase_${res.status}: ${text.slice(0, 200)}`,
      };
    }
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "unknown" };
  }
}

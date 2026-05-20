import type { FormDefinition } from "@/lib/schema";

export interface BuildPayloadInput {
  form: FormDefinition;
  answers: Record<string, unknown>;
  hiddenFields: Record<string, string>;
  tracking: Record<string, unknown>;
  submissionId: string;
}

/**
 * Builds the JSON payload sent to the n8n webhook. Keys follow the
 * "Processar dados da LP" node contract: produto, conversion_identifier,
 * tags, plus arbitrary answer keys (already keyed by step.mapTo or
 * step.id), plus the tracking snapshot, plus Spark-prefixed meta.
 *
 * Precedence (later wins on collision):
 *   1. form.product / conversion_identifier / tags
 *   2. tracking (utm_*, gclid, fbp, etc.)
 *   3. hiddenFields (so an explicit ?campaign= overrides utm_campaign)
 *   4. answers (lead's own answers always win)
 *   5. _source / _form_slug / _submission_id / _timestamp (never overwritten)
 */
export function buildN8nPayload({
  form,
  answers,
  hiddenFields,
  tracking,
  submissionId,
}: BuildPayloadInput): Record<string, unknown> {
  return {
    produto: form.product,
    conversion_identifier: form.conversionIdentifier,
    tags: form.tags,
    ...stripUndefined(tracking),
    ...hiddenFields,
    ...stripUndefined(answers),
    _source: "spark-forms",
    _form_slug: form.slug,
    _submission_id: submissionId,
    _timestamp: new Date().toISOString(),
  };
}

function stripUndefined(
  obj: Record<string, unknown>,
): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(obj)) {
    if (v === undefined || v === null) continue;
    if (typeof v === "string" && v === "") continue;
    out[k] = v;
  }
  return out;
}

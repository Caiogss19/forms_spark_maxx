import { randomUUID } from "node:crypto";

import { z } from "zod";

import {
  DEFAULT_DISPOSABLE_DOMAINS,
  getEffectiveBlockedDomains,
  validateEmail,
} from "@/lib/corporate-email";
import { getFormBySlug, FormNotFoundError } from "@/lib/forms";
import { consumeRateLimit, ipFromRequest } from "@/lib/rate-limit";
import { buildN8nPayload } from "@/lib/submission";
import { saveFailedSubmission } from "@/lib/supabase";
import { isTurnstileEnabled, verifyTurnstile } from "@/lib/turnstile";
import { sendWebhook } from "@/lib/webhook";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const BodySchema = z.object({
  slug: z.string().regex(/^[a-z0-9-]+$/),
  answers: z.record(z.string(), z.unknown()),
  hiddenFields: z.record(z.string(), z.string()).optional(),
  tracking: z.record(z.string(), z.unknown()).optional(),
  turnstileToken: z.string().optional(),
  hp: z.string().optional(),
});

interface SuccessResponse {
  ok: true;
  submissionId: string;
  webhook: "ok" | "queued";
}
interface ErrorResponse {
  ok: false;
  code:
    | "rate_limited"
    | "turnstile_failed"
    | "form_not_found"
    | "invalid_body"
    | "email_rejected"
    | "internal";
  message: string;
}

type Json = SuccessResponse | ErrorResponse;

function json(body: Json, init?: ResponseInit) {
  return Response.json(body, init);
}

export async function POST(req: Request) {
  const ip = ipFromRequest(req);

  // 1. Rate limit
  const limit = consumeRateLimit(ip);
  if (!limit.allowed) {
    return json(
      {
        ok: false,
        code: "rate_limited",
        message: "Muitas tentativas em pouco tempo. Tente em 1 minuto.",
      },
      {
        status: 429,
        headers: {
          "retry-after": String(Math.ceil(limit.retryAfterMs / 1000)),
        },
      },
    );
  }

  // 2. Parse body
  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    return json(
      { ok: false, code: "invalid_body", message: "Body must be JSON." },
      { status: 400 },
    );
  }
  const parsed = BodySchema.safeParse(raw);
  if (!parsed.success) {
    return json(
      { ok: false, code: "invalid_body", message: "Body inválido." },
      { status: 400 },
    );
  }
  const { slug, answers, hiddenFields = {}, tracking = {}, turnstileToken, hp } =
    parsed.data;

  // 3. Honeypot: bots fill hidden inputs. We swallow these and pretend
  //    success so they don't probe further.
  if (hp && hp.trim().length > 0) {
    return json({ ok: true, submissionId: randomUUID(), webhook: "ok" });
  }

  // 4. Turnstile (only when configured)
  if (isTurnstileEnabled()) {
    const verify = await verifyTurnstile(turnstileToken, ip);
    if (!verify.ok && verify.error !== "verify_unavailable") {
      return json(
        {
          ok: false,
          code: "turnstile_failed",
          message: "Verificação de segurança falhou. Recarregue a página.",
        },
        { status: 403 },
      );
    }
  }

  // 5. Load form
  let form;
  try {
    form = await getFormBySlug(slug);
  } catch (err) {
    if (err instanceof FormNotFoundError) {
      return json(
        { ok: false, code: "form_not_found", message: "Formulário não existe." },
        { status: 404 },
      );
    }
    throw err;
  }

  // 6. Server-side email re-validation (defense in depth)
  const emailStep = form.steps.find(
    (s) => s.type === "email" && s.validation?.corporateOnly,
  );
  if (emailStep) {
    const emailKey = emailStep.mapTo ?? emailStep.id;
    const emailValue = answers[emailKey];
    if (typeof emailValue === "string" && emailValue.length > 0) {
      const verdict = validateEmail(emailValue.toLowerCase(), {
        corporateOnly: true,
        blockedDomains: getEffectiveBlockedDomains(),
        disposableDomains: DEFAULT_DISPOSABLE_DOMAINS,
      });
      if (!verdict.ok) {
        return json(
          {
            ok: false,
            code: "email_rejected",
            message:
              emailStep.messages?.blockedDomain ??
              "Use seu e-mail corporativo.",
          },
          { status: 400 },
        );
      }
    }
  }

  // 7. Build payload + dispatch
  const submissionId = randomUUID();
  const webhookUrl = form.webhookUrl ?? process.env.N8N_WEBHOOK_URL;
  const authHeader = form.webhookAuth ?? process.env.N8N_WEBHOOK_AUTH;

  if (!webhookUrl) {
    return json(
      {
        ok: false,
        code: "internal",
        message: "Webhook URL not configured (env N8N_WEBHOOK_URL).",
      },
      { status: 500 },
    );
  }

  const payload = buildN8nPayload({
    form,
    answers: answers as Record<string, unknown>,
    hiddenFields,
    tracking: tracking as Record<string, unknown>,
    submissionId,
  });

  const result = await sendWebhook({
    url: webhookUrl,
    payload,
    authHeader,
  });

  // 8. On failure → Supabase fallback (best-effort), still return success
  if (!result.ok) {
    await saveFailedSubmission({
      form_slug: form.slug,
      payload,
      webhook_status: "failed",
      webhook_attempts: result.attempts,
      webhook_last_error: result.error ?? `http_${result.status}`,
      ip,
    });
    return json({ ok: true, submissionId, webhook: "queued" });
  }

  return json({ ok: true, submissionId, webhook: "ok" });
}

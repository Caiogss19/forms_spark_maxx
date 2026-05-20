// File upload endpoint. Three execution modes, picked at runtime:
//
// 1. Vercel Blob (when BLOB_READ_WRITE_TOKEN is set) — uploads and returns
//    a public URL. Recommended for production.
// 2. Data URL (default fallback) — encodes the file as base64 inline. Hard
//    capped at 1MB so we don't blow up the n8n payload.
// 3. Disabled (set UPLOAD_DISABLED=1) — returns 503 immediately.
//
// In all modes we validate MIME and size against the per-step rules,
// passed in as multipart fields.

import { consumeRateLimit, ipFromRequest } from "@/lib/rate-limit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const DEFAULT_MAX_MB = 10;
const DATA_URL_MAX_BYTES = 1_000_000;

interface SuccessBody {
  ok: true;
  url: string;
  name: string;
  size: number;
  type: string;
  storage: "vercel-blob" | "data-url";
}
interface ErrorBody {
  ok: false;
  code:
    | "rate_limited"
    | "disabled"
    | "no_file"
    | "too_large"
    | "bad_mime"
    | "internal";
  message: string;
}

function json(body: SuccessBody | ErrorBody, init?: ResponseInit) {
  return Response.json(body, init);
}

export async function POST(req: Request) {
  if (process.env.UPLOAD_DISABLED === "1") {
    return json(
      { ok: false, code: "disabled", message: "Uploads desativados." },
      { status: 503 },
    );
  }

  const ip = ipFromRequest(req);
  const limit = consumeRateLimit(ip);
  if (!limit.allowed) {
    return json(
      {
        ok: false,
        code: "rate_limited",
        message: "Muitas tentativas. Aguarde 1 minuto.",
      },
      {
        status: 429,
        headers: { "retry-after": String(Math.ceil(limit.retryAfterMs / 1000)) },
      },
    );
  }

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return json(
      { ok: false, code: "internal", message: "Body inválido." },
      { status: 400 },
    );
  }

  const file = form.get("file");
  if (!(file instanceof File)) {
    return json(
      { ok: false, code: "no_file", message: "Nenhum arquivo enviado." },
      { status: 400 },
    );
  }

  const maxMB =
    Number(form.get("maxFileSizeMB") ?? DEFAULT_MAX_MB) || DEFAULT_MAX_MB;
  const maxBytes = maxMB * 1024 * 1024;
  if (file.size > maxBytes) {
    return json(
      {
        ok: false,
        code: "too_large",
        message: `Arquivo acima de ${maxMB}MB.`,
      },
      { status: 413 },
    );
  }

  const acceptedRaw = form.get("acceptedMimeTypes");
  if (typeof acceptedRaw === "string" && acceptedRaw.length > 0) {
    const accepted = acceptedRaw.split(",").map((m) => m.trim());
    if (!accepted.includes(file.type)) {
      return json(
        {
          ok: false,
          code: "bad_mime",
          message: `Formato não permitido. Aceitos: ${accepted.join(", ")}.`,
        },
        { status: 415 },
      );
    }
  }

  const token = process.env.BLOB_READ_WRITE_TOKEN;
  if (token) {
    try {
      const { put } = await import("@vercel/blob");
      const result = await put(`spark-forms/${Date.now()}-${file.name}`, file, {
        access: "public",
        token,
      });
      return json({
        ok: true,
        url: result.url,
        name: file.name,
        size: file.size,
        type: file.type,
        storage: "vercel-blob",
      });
    } catch (err) {
      // Fall through to data URL if blob fails — best-effort.
      console.error("[upload] vercel-blob failed", err);
    }
  }

  if (file.size > DATA_URL_MAX_BYTES) {
    return json(
      {
        ok: false,
        code: "too_large",
        message: `Sem storage configurado: limite ${Math.round(DATA_URL_MAX_BYTES / 1024)}KB. Compartilhe via link.`,
      },
      { status: 413 },
    );
  }

  const buf = Buffer.from(await file.arrayBuffer());
  const dataUrl = `data:${file.type};base64,${buf.toString("base64")}`;
  return json({
    ok: true,
    url: dataUrl,
    name: file.name,
    size: file.size,
    type: file.type,
    storage: "data-url",
  });
}

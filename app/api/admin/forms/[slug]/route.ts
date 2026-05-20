import { z } from "zod";

import { isAdmin } from "@/lib/admin-auth";
import { FormSchema } from "@/lib/schema";
import {
  deleteFormRow,
  isSupabaseConfigured,
  upsertFormRow,
} from "@/lib/supabase";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const BodySchema = z.object({
  schema: z.unknown(),
  active: z.boolean().optional(),
});

interface RouteParams {
  params: Promise<{ slug: string }>;
}

export async function PUT(req: Request, { params }: RouteParams) {
  if (!(await isAdmin())) {
    return Response.json({ ok: false, message: "Não autorizado." }, { status: 401 });
  }
  if (!isSupabaseConfigured()) {
    return Response.json(
      { ok: false, message: "Supabase não configurado (SUPABASE_URL + SUPABASE_SERVICE_KEY)." },
      { status: 503 },
    );
  }

  const { slug } = await params;
  if (!/^[a-z0-9-]+$/.test(slug)) {
    return Response.json({ ok: false, message: "Slug inválido." }, { status: 400 });
  }

  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    return Response.json({ ok: false, message: "Body inválido." }, { status: 400 });
  }
  const parsed = BodySchema.safeParse(raw);
  if (!parsed.success) {
    return Response.json({ ok: false, message: "Body inválido." }, { status: 400 });
  }

  // Validate the schema against FormSchema before persisting.
  const schemaCheck = FormSchema.safeParse(parsed.data.schema);
  if (!schemaCheck.success) {
    return Response.json(
      {
        ok: false,
        message: "Schema do form inválido.",
        issues: schemaCheck.error.issues,
      },
      { status: 400 },
    );
  }
  if (schemaCheck.data.slug !== slug) {
    return Response.json(
      {
        ok: false,
        message: `Slug do schema (${schemaCheck.data.slug}) não bate com a URL (${slug}).`,
      },
      { status: 400 },
    );
  }

  const result = await upsertFormRow(slug, schemaCheck.data, parsed.data.active ?? true);
  if (!result.ok) {
    return Response.json(
      { ok: false, message: result.error ?? "Falha ao salvar." },
      { status: 500 },
    );
  }
  return Response.json({ ok: true });
}

export async function DELETE(_req: Request, { params }: RouteParams) {
  if (!(await isAdmin())) {
    return Response.json({ ok: false, message: "Não autorizado." }, { status: 401 });
  }
  if (!isSupabaseConfigured()) {
    return Response.json(
      { ok: false, message: "Supabase não configurado." },
      { status: 503 },
    );
  }
  const { slug } = await params;
  const result = await deleteFormRow(slug);
  if (!result.ok) {
    return Response.json(
      { ok: false, message: result.error ?? "Falha ao remover." },
      { status: 500 },
    );
  }
  return Response.json({ ok: true });
}

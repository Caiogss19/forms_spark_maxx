import { revalidatePath } from "next/cache";
import { z } from "zod";

import { FormSchema } from "@/lib/schema";
import {
  deleteFormRow,
  isSupabaseConfigured,
  upsertFormRow,
} from "@/lib/supabase";

function revalidateFormRoutes(slug: string) {
  // /f/[slug] and /embed/[slug] are ISR-cached; bust both so the next
  // public visit re-renders with the freshly saved schema.
  revalidatePath(`/f/${slug}`);
  revalidatePath(`/embed/${slug}`);
}

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
  revalidateFormRoutes(slug);
  return Response.json({ ok: true });
}

export async function DELETE(_req: Request, { params }: RouteParams) {
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
  revalidateFormRoutes(slug);
  return Response.json({ ok: true });
}

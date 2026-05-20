import { z } from "zod";

import { ADMIN_COOKIE_NAME, expectedToken } from "@/lib/admin-auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const BodySchema = z.object({ password: z.string().min(1).max(200) });

export async function POST(req: Request) {
  const expected = expectedToken();
  if (!expected) {
    return Response.json(
      { ok: false, message: "ADMIN_PASSWORD não configurado no servidor." },
      { status: 503 },
    );
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

  const pwd = process.env.ADMIN_PASSWORD!;
  if (parsed.data.password !== pwd) {
    // Constant-ish delay to discourage trivial brute force.
    await new Promise((r) => setTimeout(r, 250));
    return Response.json(
      { ok: false, message: "Senha incorreta." },
      { status: 401 },
    );
  }

  const res = Response.json({ ok: true });
  res.headers.append(
    "set-cookie",
    `${ADMIN_COOKIE_NAME}=${expected}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${60 * 60 * 24 * 7}${process.env.NODE_ENV === "production" ? "; Secure" : ""}`,
  );
  return res;
}

export async function DELETE() {
  const res = Response.json({ ok: true });
  res.headers.append(
    "set-cookie",
    `${ADMIN_COOKIE_NAME}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0`,
  );
  return res;
}

import { ArrowUpRight, Pencil } from "lucide-react";
import Link from "next/link";

import { getFormBySlug, getFormSlugs } from "@/lib/forms";

export const dynamic = "force-dynamic";

export default async function AdminHome() {
  const slugs = await getFormSlugs();
  const forms = await Promise.all(
    slugs.map(async (slug) => {
      try {
        const def = await getFormBySlug(slug);
        return {
          slug,
          title: def.title,
          steps: def.steps.length,
          layout: def.layout,
        };
      } catch {
        return { slug, title: slug, steps: 0, layout: "stepped", broken: true };
      }
    }),
  );

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border">
        <div className="mx-auto flex max-w-3xl items-center justify-between px-6 py-4">
          <Link
            href="/"
            className="text-xs font-medium uppercase tracking-widest text-muted-foreground hover:text-foreground"
          >
            Spark Forms
          </Link>
        </div>
      </header>

      <main className="mx-auto w-full max-w-3xl px-6 py-10">
        <div className="mb-8">
          <h1 className="text-3xl font-semibold tracking-tight">Painel</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Edite forms ao vivo. Salva no Supabase, aparece em
            <code className="mx-1 rounded bg-muted px-1 py-0.5">/f/[slug]</code>
            em segundos.
          </p>
        </div>

        {forms.length === 0 ? (
          <p className="rounded-2xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
            Nenhum form ainda. Adicione um JSON em{" "}
            <code className="rounded bg-muted px-1 py-0.5">/forms</code>{" "}
            e ele aparece aqui pra edição.
          </p>
        ) : (
          <ul className="divide-y divide-border rounded-2xl border border-border bg-muted/20">
            {forms.map((f) => (
              <li
                key={f.slug}
                className="flex items-center justify-between gap-4 px-5 py-4"
              >
                <div className="min-w-0">
                  <p className="truncate text-base font-medium">{f.title}</p>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    <code>{f.slug}</code> · {f.steps} campos · layout{" "}
                    <code>{f.layout}</code>
                    {"broken" in f && f.broken ? " · schema inválido" : ""}
                  </p>
                </div>
                <div className="flex shrink-0 gap-2 text-sm">
                  <Link
                    href={`/admin/forms/${f.slug}`}
                    className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-primary px-3 font-medium text-primary-foreground transition-opacity hover:opacity-90"
                  >
                    <Pencil className="h-3.5 w-3.5" aria-hidden />
                    Editar
                  </Link>
                  <Link
                    href={`/f/${f.slug}`}
                    target="_blank"
                    className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-border px-3 font-medium transition-colors hover:bg-muted"
                  >
                    Abrir
                    <ArrowUpRight className="h-3.5 w-3.5" aria-hidden />
                  </Link>
                </div>
              </li>
            ))}
          </ul>
        )}

        <p className="mt-6 text-xs text-muted-foreground">
          Os forms abaixo vêm do filesystem (JSONs em{" "}
          <code>/forms</code>) e do Supabase. Edições aqui salvam no Supabase e
          sobrescrevem o JSON original em runtime — sem redeploy.
        </p>
      </main>
    </div>
  );
}

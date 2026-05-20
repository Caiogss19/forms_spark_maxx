import Link from "next/link";

import { getFormSlugs, getFormBySlug } from "@/lib/forms";

export const dynamic = "force-static";

export default async function Home() {
  const slugs = await getFormSlugs();
  const forms = await Promise.all(
    slugs.map(async (slug) => {
      try {
        const def = await getFormBySlug(slug);
        return { slug, title: def.title, steps: def.steps.length };
      } catch {
        return { slug, title: slug, steps: 0, broken: true };
      }
    }),
  );

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-2xl flex-col justify-center gap-10 px-6 py-20">
      <header className="space-y-3">
        <p className="text-xs font-medium uppercase tracking-widest text-muted-foreground">
          Spark Forms
        </p>
        <h1 className="text-4xl font-semibold tracking-tight md:text-5xl">
          Formulários multi-step, white-label, embedáveis.
        </h1>
        <p className="text-base leading-relaxed text-muted-foreground">
          Substitui Typeform pra captura de leads no site da Spark. 100%
          editável via JSON schema. Captura UTMs, valida e-mail corporativo,
          envia pro n8n com retry.
        </p>
      </header>

      <section className="space-y-3">
        <h2 className="text-sm font-medium text-muted-foreground">
          Forms disponíveis
        </h2>
        {forms.length === 0 ? (
          <p className="rounded-2xl border border-dashed border-border p-6 text-sm text-muted-foreground">
            Nenhum JSON em <code>/forms</code> ainda.
          </p>
        ) : (
          <ul className="divide-y divide-border rounded-2xl border border-border">
            {forms.map((f) => (
              <li
                key={f.slug}
                className="flex items-center justify-between gap-4 px-5 py-4"
              >
                <div className="min-w-0">
                  <p className="truncate font-medium">{f.title}</p>
                  <p className="text-xs text-muted-foreground">
                    <code>{f.slug}</code> · {f.steps} steps
                    {"broken" in f && f.broken ? " · schema inválido" : ""}
                  </p>
                </div>
                <div className="flex shrink-0 gap-2 text-sm">
                  <Link
                    href={`/f/${f.slug}`}
                    className="rounded-lg bg-primary px-3 py-1.5 font-medium text-primary-foreground transition-opacity hover:opacity-90"
                  >
                    Abrir →
                  </Link>
                  <Link
                    href={`/embed/${f.slug}`}
                    className="rounded-lg border border-border px-3 py-1.5 font-medium transition-colors hover:bg-muted"
                  >
                    Embed
                  </Link>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <Link
        href="/admin"
        className="inline-flex items-center gap-2 self-start rounded-lg border border-border px-3 py-2 text-sm font-medium transition-colors hover:bg-muted"
      >
        Editor →
      </Link>

      <section className="grid gap-3 rounded-2xl border border-border p-6 text-sm">
        <h2 className="font-medium text-muted-foreground">Como adicionar um form</h2>
        <ol className="list-decimal space-y-1 pl-5 text-foreground">
          <li>
            Crie <code className="rounded bg-muted px-1 py-0.5">forms/[slug].json</code>{" "}
            seguindo o tipo <code>FormSchema</code>.
          </li>
          <li>
            Rode <code className="rounded bg-muted px-1 py-0.5">pnpm validate:forms</code>{" "}
            pra checar o schema.
          </li>
          <li>
            Acesse <code className="rounded bg-muted px-1 py-0.5">/f/[slug]</code> ou
            embeda <code className="rounded bg-muted px-1 py-0.5">/embed/[slug]</code>.
          </li>
        </ol>
      </section>
    </main>
  );
}

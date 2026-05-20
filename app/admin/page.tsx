import Link from "next/link";
import { redirect } from "next/navigation";

import { isAdmin, isAdminEnabled } from "@/lib/admin-auth";
import { getFormBySlug, getFormSlugs } from "@/lib/forms";

export const dynamic = "force-dynamic";

export default async function AdminHome() {
  if (!isAdminEnabled()) {
    return (
      <main className="mx-auto flex min-h-screen w-full max-w-md flex-col justify-center px-6 py-20 text-sm">
        <h1 className="mb-2 text-2xl font-semibold tracking-tight">
          Editor desativado
        </h1>
        <p className="text-muted-foreground">
          Defina <code className="rounded bg-muted px-1 py-0.5">ADMIN_PASSWORD</code>{" "}
          no projeto pra ativar.
        </p>
      </main>
    );
  }
  if (!(await isAdmin())) {
    redirect("/admin/login?next=/admin");
  }

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
    <main className="mx-auto w-full max-w-3xl px-6 py-12">
      <header className="mb-8 flex items-end justify-between">
        <div>
          <p className="text-xs font-medium uppercase tracking-widest text-muted-foreground">
            Spark Forms
          </p>
          <h1 className="text-3xl font-semibold tracking-tight">Editor</h1>
        </div>
        <form action="/api/admin/login" method="post" className="hidden">
          {/* placeholder for logout in future */}
        </form>
      </header>

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
                href={`/admin/forms/${f.slug}`}
                className="rounded-lg bg-primary px-3 py-1.5 font-medium text-primary-foreground transition-opacity hover:opacity-90"
              >
                Editar
              </Link>
              <Link
                href={`/f/${f.slug}`}
                target="_blank"
                className="rounded-lg border border-border px-3 py-1.5 font-medium transition-colors hover:bg-muted"
              >
                Abrir ↗
              </Link>
            </div>
          </li>
        ))}
      </ul>

      <p className="mt-6 text-xs text-muted-foreground">
        Forms vêm do filesystem (<code>/forms/*.json</code>) e do Supabase. Edições aqui salvam no
        Supabase e ficam disponíveis em segundos sem redeploy.
      </p>
    </main>
  );
}

import Link from "next/link";

export default function Home() {
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

      <section className="grid gap-3 rounded-2xl border border-border p-6">
        <h2 className="text-sm font-medium text-muted-foreground">Como usar</h2>
        <ul className="space-y-2 text-sm">
          <li>
            <span className="text-muted-foreground">Form público:</span>{" "}
            <code className="rounded bg-muted px-1.5 py-0.5 text-xs">
              /f/[slug]
            </code>
          </li>
          <li>
            <span className="text-muted-foreground">Versão pra iframe:</span>{" "}
            <code className="rounded bg-muted px-1.5 py-0.5 text-xs">
              /embed/[slug]
            </code>
          </li>
          <li>
            <span className="text-muted-foreground">Schemas:</span>{" "}
            <code className="rounded bg-muted px-1.5 py-0.5 text-xs">
              /forms/*.json
            </code>
          </li>
        </ul>
      </section>

      <div className="flex flex-wrap gap-3 text-sm">
        <Link
          href="/f/demo-spark"
          className="rounded-lg bg-primary px-4 py-2.5 font-medium text-primary-foreground transition-opacity hover:opacity-90"
        >
          Abrir demo →
        </Link>
        <Link
          href="/embed/demo-spark"
          className="rounded-lg border border-border px-4 py-2.5 font-medium transition-colors hover:bg-muted"
        >
          Versão embed
        </Link>
      </div>
    </main>
  );
}

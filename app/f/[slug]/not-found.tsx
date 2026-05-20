import Link from "next/link";

export default function NotFound() {
  return (
    <main className="mx-auto flex min-h-screen w-full max-w-md flex-col items-start justify-center gap-4 px-6 py-20">
      <p className="text-xs font-medium uppercase tracking-widest text-muted-foreground">
        Spark Forms
      </p>
      <h1 className="text-3xl font-semibold tracking-tight">
        Formulário não encontrado.
      </h1>
      <p className="text-sm text-muted-foreground">
        Esse slug não existe. Cheque se há um JSON correspondente em{" "}
        <code className="rounded bg-muted px-1 py-0.5">/forms</code>.
      </p>
      <Link
        href="/"
        className="rounded-lg border border-border px-3 py-1.5 text-sm font-medium transition-colors hover:bg-muted"
      >
        ← Voltar
      </Link>
    </main>
  );
}

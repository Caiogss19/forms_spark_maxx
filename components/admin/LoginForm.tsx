"use client";

import { Lock } from "lucide-react";
import Link from "next/link";
import { useState } from "react";

import { Input } from "@/components/ui/input";

export function LoginForm({ nextHref }: { nextHref: string }) {
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/login", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ password }),
      });
      const data = (await res.json()) as { ok: boolean; message?: string };
      if (!res.ok || !data.ok) {
        setError(data.message ?? "Falha no login.");
        return;
      }
      window.location.href = nextHref;
    } catch {
      setError("Erro de rede.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="grid min-h-screen place-items-center bg-background px-6 py-12">
      <div className="w-full max-w-sm">
        <Link
          href="/"
          className="mb-8 inline-block text-xs font-medium uppercase tracking-widest text-muted-foreground transition-colors hover:text-foreground"
        >
          ← Spark Forms
        </Link>

        <div className="rounded-2xl border border-border bg-muted/30 p-7">
          <div className="mb-5 inline-flex h-10 w-10 items-center justify-center rounded-xl bg-primary text-primary-foreground">
            <Lock className="h-4 w-4" aria-hidden />
          </div>

          <h1 className="mb-1 text-2xl font-semibold tracking-tight">
            Acessar o painel
          </h1>
          <p className="mb-6 text-sm text-muted-foreground">
            Senha definida no env <code className="rounded bg-muted px-1 py-0.5">ADMIN_PASSWORD</code>.
          </p>

          <form onSubmit={onSubmit} className="space-y-3">
            <label className="block">
              <span className="sr-only">Senha</span>
              <Input
                type="password"
                autoFocus
                placeholder="Senha do painel"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                aria-invalid={error ? true : undefined}
                autoComplete="current-password"
              />
            </label>

            {error ? (
              <p
                role="alert"
                className="rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive"
              >
                {error}
              </p>
            ) : null}

            <button
              type="submit"
              disabled={loading || !password}
              className="inline-flex h-11 w-full items-center justify-center rounded-lg bg-primary px-4 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-50"
            >
              {loading ? "Entrando…" : "Entrar"}
            </button>
          </form>

          <details className="mt-5 group">
            <summary className="cursor-pointer text-xs text-muted-foreground transition-colors hover:text-foreground">
              Esqueci a senha
            </summary>
            <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
              A senha está como variável de ambiente no Vercel.
              Abra <strong>Settings → Environment Variables</strong> do projeto, edite{" "}
              <code className="rounded bg-muted px-1 py-0.5">ADMIN_PASSWORD</code> e
              faça um Redeploy.
            </p>
          </details>
        </div>

        <p className="mt-5 text-center text-xs text-muted-foreground">
          O cookie de sessão dura 7 dias.
        </p>
      </div>
    </main>
  );
}

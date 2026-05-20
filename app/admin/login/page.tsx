import { redirect } from "next/navigation";

import { LoginForm } from "@/components/admin/LoginForm";
import { isAdmin, isAdminEnabled } from "@/lib/admin-auth";

export const dynamic = "force-dynamic";

interface PageProps {
  searchParams: Promise<{ next?: string }>;
}

export default async function LoginPage({ searchParams }: PageProps) {
  if (!isAdminEnabled()) {
    return (
      <main className="mx-auto flex min-h-screen w-full max-w-md flex-col justify-center px-6 py-20 text-sm">
        <h1 className="mb-2 text-2xl font-semibold tracking-tight">
          Editor desativado
        </h1>
        <p className="text-muted-foreground">
          Defina <code className="rounded bg-muted px-1 py-0.5">ADMIN_PASSWORD</code>{" "}
          nas envs do projeto pra ativar o editor.
        </p>
      </main>
    );
  }
  const sp = await searchParams;
  const already = await isAdmin();
  if (already) redirect(sp.next ?? "/admin");
  return <LoginForm nextHref={sp.next ?? "/admin"} />;
}

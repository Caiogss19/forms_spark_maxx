import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { Runner } from "@/components/form-runner";
import { FormNotFoundError, getFormBySlug, getFormSlugs } from "@/lib/forms";

interface RouteParams {
  slug: string;
}

interface PageProps {
  params: Promise<RouteParams>;
}

export async function generateStaticParams() {
  const slugs = await getFormSlugs();
  return slugs.map((slug) => ({ slug }));
}

// Render per-request so admin edits saved to Supabase show up on the
// public page without redeploying. Without this, generateStaticParams
// above bakes a snapshot of the theme into the build output.
export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: PageProps): Promise<Metadata> {
  const { slug } = await params;
  try {
    const form = await getFormBySlug(slug);
    return {
      title: form.title,
      description: form.description,
      robots: { index: false, follow: false },
    };
  } catch {
    return { title: "Formulário não encontrado" };
  }
}

export default async function FormPage({ params }: PageProps) {
  const { slug } = await params;
  const form = await getFormBySlug(slug).catch((err) => {
    if (err instanceof FormNotFoundError) notFound();
    throw err;
  });
  return <Runner form={form} />;
}

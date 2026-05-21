import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { Runner } from "@/components/form-runner";
import { FormNotFoundError, getFormBySlug, getFormSlugs } from "@/lib/forms";

interface PageProps {
  params: Promise<{ slug: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export async function generateStaticParams() {
  const slugs = await getFormSlugs();
  return slugs.map((slug) => ({ slug }));
}

// Cached static between admin saves. The admin PUT/DELETE handlers
// call revalidatePath('/embed/[slug]') to invalidate immediately when
// the schema changes, so the embed stays in sync with the editor
// without paying a Supabase round-trip on every public request.
export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

export default async function EmbedPage({ params, searchParams }: PageProps) {
  const { slug } = await params;
  const sp = await searchParams;
  const form = await getFormBySlug(slug).catch((err) => {
    if (err instanceof FormNotFoundError) notFound();
    throw err;
  });
  const transparent = sp.transparent === "1";
  return (
    <div data-spark-embed style={transparent ? { background: "transparent" } : undefined}>
      <Runner form={form} embedded />
    </div>
  );
}

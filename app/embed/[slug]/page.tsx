import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { FormRunner } from "@/components/form-runner/FormRunner";
import { FormNotFoundError, getFormBySlug, getFormSlugs } from "@/lib/forms";

interface PageProps {
  params: Promise<{ slug: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export async function generateStaticParams() {
  const slugs = await getFormSlugs();
  return slugs.map((slug) => ({ slug }));
}

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
      <FormRunner form={form} embedded />
    </div>
  );
}

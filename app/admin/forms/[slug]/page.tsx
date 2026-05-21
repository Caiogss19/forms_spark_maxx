import { notFound } from "next/navigation";

import { FormEditor } from "@/components/admin/FormEditor";
import { FormNotFoundError, getFormBySlug } from "@/lib/forms";

export const dynamic = "force-dynamic";

interface PageProps {
  params: Promise<{ slug: string }>;
}

export default async function EditFormPage({ params }: PageProps) {
  const { slug } = await params;
  const form = await getFormBySlug(slug).catch((err) => {
    if (err instanceof FormNotFoundError) notFound();
    throw err;
  });
  return <FormEditor initialForm={form} />;
}

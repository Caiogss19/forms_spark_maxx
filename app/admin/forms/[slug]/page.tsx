import { notFound, redirect } from "next/navigation";

import { FormEditor } from "@/components/admin/FormEditor";
import { isAdmin, isAdminEnabled } from "@/lib/admin-auth";
import { FormNotFoundError, getFormBySlug } from "@/lib/forms";

export const dynamic = "force-dynamic";

interface PageProps {
  params: Promise<{ slug: string }>;
}

export default async function EditFormPage({ params }: PageProps) {
  if (!isAdminEnabled()) {
    redirect("/admin");
  }
  if (!(await isAdmin())) {
    const { slug } = await params;
    redirect(`/admin/login?next=/admin/forms/${slug}`);
  }

  const { slug } = await params;
  const form = await getFormBySlug(slug).catch((err) => {
    if (err instanceof FormNotFoundError) notFound();
    throw err;
  });
  return <FormEditor initialForm={form} />;
}

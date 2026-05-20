"use client";

import type { FormDefinition } from "@/lib/schema";

import { FormRunner } from "./FormRunner";
import { SinglePageRunner } from "./SinglePageRunner";

interface Props {
  form: FormDefinition;
  embedded?: boolean;
}

/**
 * Dispatcher: picks the stepped (Typeform-like) runner or the single-page
 * (classic form) runner based on form.layout. Defaults to stepped for
 * backward compatibility with the original schema.
 */
export function Runner({ form, embedded = false }: Props) {
  if (form.layout === "single_page") {
    return <SinglePageRunner form={form} embedded={embedded} />;
  }
  return <FormRunner form={form} embedded={embedded} />;
}

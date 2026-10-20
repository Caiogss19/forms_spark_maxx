"use client";

import type { FormDefinition } from "@/lib/schema";

import { ChatRunner } from "./ChatRunner";
import { FormRunner } from "./FormRunner";
import { SinglePageRunner } from "./SinglePageRunner";

interface Props {
  form: FormDefinition;
  embedded?: boolean;
}

/**
 * Dispatcher: picks the stepped (Typeform-like), single-page (classic
 * form) or chat (conversation) runner based on form.layout. Defaults to stepped for
 * backward compatibility with the original schema.
 */
export function Runner({ form, embedded = false }: Props) {
  if (form.layout === "chat") {
    return <ChatRunner form={form} embedded={embedded} />;
  }
  if (form.layout === "single_page") {
    return <SinglePageRunner form={form} embedded={embedded} />;
  }
  return <FormRunner form={form} embedded={embedded} />;
}

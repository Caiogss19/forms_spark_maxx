"use client";

import { useEffect } from "react";

import { resolveTheme, type DisqualifyConfig, type FormDefinition } from "@/lib/schema";

interface UseDisqualifierBridgeArgs {
  form: FormDefinition;
  embedded: boolean;
  disqualifier:
    | {
        config: DisqualifyConfig;
        stepId: string;
        optionValue: string;
      }
    | null;
  onDismissFromParent: () => void;
}

/**
 * Wires the iframe-side runner to the parent page (embed.js) so the
 * disqualifier modal can render over the entire host site, not just the
 * iframe viewport. When `embedded` is false this is a no-op and the
 * runner shows its own in-page modal.
 *
 * Messages emitted (iframe → parent):
 *  - spark-forms:disqualifier-show { slug, config, theme }
 *  - spark-forms:disqualifier-hide { slug }
 *
 * Messages handled (parent → iframe):
 *  - spark-forms:disqualifier-dismissed { slug }
 */
export function useDisqualifierBridge({
  form,
  embedded,
  disqualifier,
  onDismissFromParent,
}: UseDisqualifierBridgeArgs) {
  useEffect(() => {
    if (!embedded || typeof window === "undefined") return;
    if (!window.parent || window.parent === window) return;

    if (disqualifier) {
      const t = resolveTheme(form.theme);
      const o = form.theme ?? {};
      window.parent.postMessage(
        {
          type: "spark-forms:disqualifier-show",
          slug: form.slug,
          config: disqualifier.config,
          theme: {
            background: t.background,
            foreground: t.foreground,
            primary: t.primary,
            primaryForeground: o.primaryForeground ?? "#FFFFFF",
            radius: o.cardBorderRadius ?? "1rem",
          },
        },
        "*",
      );
    } else {
      window.parent.postMessage(
        { type: "spark-forms:disqualifier-hide", slug: form.slug },
        "*",
      );
    }
  }, [embedded, disqualifier, form]);

  useEffect(() => {
    if (!embedded || typeof window === "undefined") return;
    function onMessage(e: MessageEvent) {
      const data = e.data;
      if (!data || typeof data !== "object") return;
      if (
        data.type === "spark-forms:disqualifier-dismissed" &&
        (!data.slug || data.slug === form.slug)
      ) {
        onDismissFromParent();
      }
    }
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, [embedded, form.slug, onDismissFromParent]);
}

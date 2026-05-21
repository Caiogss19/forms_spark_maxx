"use client";

import { useEffect, useState } from "react";

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
 * iframe viewport.
 *
 * Returns `hostReady`: true once the parent's embed.js has acknowledged
 * the handshake. The runner uses this to suppress the in-iframe
 * fallback modal (which otherwise looks cramped inside a 390px form).
 *
 * Messages emitted (iframe → parent):
 *  - spark-forms:iframe-ready { slug }            on mount
 *  - spark-forms:disqualifier-show { slug, config, theme }
 *  - spark-forms:disqualifier-hide { slug }
 *
 * Messages handled (parent → iframe):
 *  - spark-forms:host-ready { version, slug }
 *  - spark-forms:disqualifier-dismissed { slug }
 */
export function useDisqualifierBridge({
  form,
  embedded,
  disqualifier,
  onDismissFromParent,
}: UseDisqualifierBridgeArgs): { hostReady: boolean } {
  const [hostReady, setHostReady] = useState(false);

  // Announce we're listening as soon as the React tree mounts. The host
  // replies with `host-ready` which we record. This sidesteps the race
  // where the host's iframe.load fires before the iframe's listener is
  // registered.
  useEffect(() => {
    if (!embedded || typeof window === "undefined") return;
    if (!window.parent || window.parent === window) return;
    window.parent.postMessage(
      { type: "spark-forms:iframe-ready", slug: form.slug },
      "*",
    );
  }, [embedded, form.slug]);

  useEffect(() => {
    if (!embedded || typeof window === "undefined") return;
    function onMessage(e: MessageEvent) {
      const data = e.data;
      if (!data || typeof data !== "object") return;
      if (data.type === "spark-forms:host-ready") {
        setHostReady(true);
        return;
      }
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

  return { hostReady };
}

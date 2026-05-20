"use client";

import { useEffect } from "react";

import type { FormDefinition } from "@/lib/schema";
import { useFormStore } from "@/lib/store";
import {
  captureTracking,
  sanitizeIncomingTracking,
} from "@/lib/tracking";

const PARENT_TRACKING_MSG = "spark-forms:tracking";

/**
 * Captures UTMs/clickIDs/cookies/device on mount, persists to
 * sessionStorage, and listens for parent-window postMessage updates
 * (used when the form is embedded in an iframe).
 *
 * Also seeds hidden fields from the URL querystring.
 */
export function useTrackingCapture(form: FormDefinition) {
  const setTracking = useFormStore((s) => s.setTracking);
  const setHiddenFields = useFormStore((s) => s.setHiddenFields);

  useEffect(() => {
    const snapshot = captureTracking();
    setTracking(snapshot);

    // Hidden fields: schema defaults + querystring overrides
    if (typeof window !== "undefined") {
      const url = new URL(window.location.href);
      const values: Record<string, string> = {};
      for (const def of form.hiddenFields) {
        const fromUrl = url.searchParams.get(def.key);
        if (fromUrl !== null) values[def.key] = fromUrl;
        else if (def.default !== undefined) values[def.key] = def.default;
      }
      if (Object.keys(values).length > 0) setHiddenFields(values);
    }
  }, [form, setTracking, setHiddenFields]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    function onMessage(event: MessageEvent) {
      const data = event.data;
      if (!data || typeof data !== "object") return;
      if ((data as { type?: unknown }).type !== PARENT_TRACKING_MSG) return;
      const sanitized = sanitizeIncomingTracking(
        (data as { payload?: unknown }).payload,
      );
      if (sanitized) setTracking(sanitized);
    }
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, [setTracking]);
}

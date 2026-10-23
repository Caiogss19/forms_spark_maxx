import type { Scheduling } from "@/lib/schema";
import type { Answers } from "@/lib/store";
import { UTM_KEYS, type TrackingData } from "@/lib/tracking";

/**
 * Booking-page URL with the lead's answers prefilled. Calendly reads
 * `name`, `email`, `a1`..`a10` (custom questions, in order) and the
 * utm_* params, which land on the booked event.
 *
 * Select-type questions only prefill when the value is the exact choice
 * text, so the chat steps feeding them use that text as option value.
 *
 * With `embedDomain`, adds Calendly's inline-embed params: the widget
 * drops its own chrome and posts `calendly.*` events to the parent.
 */
export function buildSchedulingUrl(
  scheduling: Scheduling,
  answers: Answers,
  tracking: TrackingData,
  embedDomain?: string,
): string {
  const url = new URL(scheduling.url);
  for (const [param, key] of Object.entries(scheduling.prefill)) {
    const value = answers[key];
    if (value == null || value === "") continue;
    url.searchParams.set(
      param,
      Array.isArray(value) ? value.join(", ") : String(value),
    );
  }
  for (const key of UTM_KEYS) {
    const value = tracking[key];
    if (value && !url.searchParams.has(key)) url.searchParams.set(key, value);
  }
  if (embedDomain) {
    url.searchParams.set("embed_domain", embedDomain);
    url.searchParams.set("embed_type", "Inline");
    url.searchParams.set("hide_event_type_details", "1");
    url.searchParams.set("hide_gdpr_banner", "1");
    const { background, text, primary } = scheduling.colors;
    if (background) url.searchParams.set("background_color", background);
    if (text) url.searchParams.set("text_color", text);
    if (primary) url.searchParams.set("primary_color", primary);
  }
  return url.toString();
}

/** Calendly's postMessage events (`calendly.event_scheduled`, …). */
export function calendlyEvent(event: MessageEvent): string | null {
  if (!/^https:\/\/([a-z0-9-]+\.)?calendly\.com$/.test(event.origin)) return null;
  const data = event.data as { event?: unknown } | null;
  return typeof data?.event === "string" && data.event.startsWith("calendly.")
    ? data.event
    : null;
}

/** The invitee URI in Calendly's `calendly.event_scheduled` payload. */
export function scheduledInvitee(event: MessageEvent): string | null {
  const data = event.data as { payload?: { invitee?: { uri?: unknown } } } | null;
  const uri = data?.payload?.invitee?.uri;
  return typeof uri === "string" && uri.startsWith("https://api.calendly.com/") ? uri : null;
}

/**
 * Fire-and-forget notice of a fresh booking. A text/plain no-cors POST is a
 * simple request (no preflight) and `keepalive` survives the tab closing.
 */
export function notifyBooking(url: string, inviteeUri: string): void {
  void fetch(url, {
    method: "POST",
    mode: "no-cors",
    keepalive: true,
    headers: { "Content-Type": "text/plain" },
    body: JSON.stringify({ invitee_uri: inviteeUri }),
  }).catch(() => {});
}

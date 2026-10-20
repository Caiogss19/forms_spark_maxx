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
 */
export function buildSchedulingUrl(
  scheduling: Scheduling,
  answers: Answers,
  tracking: TrackingData,
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
  return url.toString();
}

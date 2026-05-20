"use client";

import { nanoid } from "nanoid";

import {
  STORAGE_KEYS,
  readJSON,
  safeGetLocal,
  safeGetSession,
  safeSetLocal,
  safeSetSession,
} from "@/lib/storage";

export type Device = "mobile" | "tablet" | "desktop";

export interface TrackingData {
  utm_source?: string;
  utm_medium?: string;
  utm_campaign?: string;
  utm_term?: string;
  utm_content?: string;
  gclid?: string;
  fbclid?: string;
  ttclid?: string;
  msclkid?: string;
  referrer?: string;
  landing_page?: string;
  page_url?: string;
  user_agent?: string;
  device?: Device;
  language?: string;
  screen?: string;
  timezone?: string;
  first_touch_at?: string;
  last_touch_at?: string;
  session_id?: string;
  rdtrk?: string;
  fbp?: string;
  ga_client_id?: string;
}

export const UTM_KEYS = [
  "utm_source",
  "utm_medium",
  "utm_campaign",
  "utm_term",
  "utm_content",
] as const;

export const CLICK_ID_KEYS = [
  "gclid",
  "fbclid",
  "ttclid",
  "msclkid",
] as const;

const TRACKED_QUERY_KEYS: readonly string[] = [...UTM_KEYS, ...CLICK_ID_KEYS];

function detectDevice(ua: string): Device {
  if (/iPad|Tablet/i.test(ua)) return "tablet";
  if (/Mobi|Android|iPhone/i.test(ua)) return "mobile";
  return "desktop";
}

function readCookie(name: string): string | undefined {
  if (typeof document === "undefined") return undefined;
  const target = `${name}=`;
  for (const part of document.cookie.split(";")) {
    const trimmed = part.trim();
    if (trimmed.startsWith(target)) {
      return decodeURIComponent(trimmed.slice(target.length));
    }
  }
  return undefined;
}

function extractGaClientId(): string | undefined {
  // _ga cookie format: GA1.1.<client_id_int>.<timestamp>
  // client_id reported to GA is the last two parts joined: <int>.<timestamp>
  const raw = readCookie("_ga");
  if (!raw) return undefined;
  const parts = raw.split(".");
  if (parts.length < 4) return undefined;
  return `${parts[parts.length - 2]}.${parts[parts.length - 1]}`;
}

function nowIso(): string {
  return new Date().toISOString();
}

/**
 * Builds a TrackingData snapshot from window.location, document, navigator
 * and cookies. Pure client-side. Returns {} on the server.
 */
export function captureTracking(): TrackingData {
  if (typeof window === "undefined") return {};

  const url = new URL(window.location.href);
  const params = url.searchParams;

  const fromQuery: Record<string, string> = {};
  for (const key of TRACKED_QUERY_KEYS) {
    const v = params.get(key);
    if (v) fromQuery[key] = v;
  }

  // First-touch persistence (cross-session, cross-tab via localStorage)
  let firstTouchAt = safeGetLocal(STORAGE_KEYS.firstTouchAt);
  if (!firstTouchAt) {
    firstTouchAt = nowIso();
    safeSetLocal(STORAGE_KEYS.firstTouchAt, firstTouchAt);
  }

  // Session id (per-tab)
  let sessionId = safeGetSession(STORAGE_KEYS.sessionId);
  if (!sessionId) {
    sessionId = nanoid();
    safeSetSession(STORAGE_KEYS.sessionId, sessionId);
  }

  const ua = navigator.userAgent;
  const screenSize =
    typeof window.screen?.width === "number"
      ? `${window.screen.width}x${window.screen.height}`
      : undefined;
  const timezone =
    Intl.DateTimeFormat().resolvedOptions().timeZone || undefined;

  const snapshot: TrackingData = {
    ...fromQuery,
    referrer: document.referrer || undefined,
    landing_page: window.location.href,
    page_url: window.location.href,
    user_agent: ua,
    device: detectDevice(ua),
    language: navigator.language,
    screen: screenSize,
    timezone,
    first_touch_at: firstTouchAt,
    last_touch_at: nowIso(),
    session_id: sessionId,
    rdtrk: readCookie("rdtrk"),
    fbp: readCookie("_fbp"),
    ga_client_id: extractGaClientId(),
  };

  // Persist so subsequent reloads on the same tab keep the UTMs even
  // after navigation strips the querystring.
  const stored = readJSON<TrackingData>(
    safeGetSession(STORAGE_KEYS.tracking),
  );
  const merged = mergeTracking(stored, snapshot);
  safeSetSession(STORAGE_KEYS.tracking, JSON.stringify(merged));
  return merged;
}

/**
 * Merge new tracking data over an existing snapshot. Stored UTMs win
 * over absent new values; new non-empty values overwrite stored.
 * `last_touch_at` always advances; `first_touch_at` only sticks once.
 */
export function mergeTracking(
  base: TrackingData | null,
  incoming: TrackingData,
): TrackingData {
  const out: TrackingData = { ...(base ?? {}) };
  for (const [k, v] of Object.entries(incoming) as [
    keyof TrackingData,
    string | undefined,
  ][]) {
    if (v === undefined || v === null || v === "") continue;
    if (k === "first_touch_at" && out.first_touch_at) continue;
    (out as Record<string, string>)[k] = v;
  }
  if (!out.first_touch_at && incoming.first_touch_at) {
    out.first_touch_at = incoming.first_touch_at;
  }
  return out;
}

/**
 * Read a previously-captured tracking snapshot from sessionStorage,
 * without recapturing (useful to forward to webhook on submit).
 */
export function readStoredTracking(): TrackingData | null {
  return readJSON<TrackingData>(safeGetSession(STORAGE_KEYS.tracking));
}

/**
 * Validates an inbound postMessage payload as a TrackingData fragment.
 * Returns null if shape is wrong.
 */
export function sanitizeIncomingTracking(
  payload: unknown,
): TrackingData | null {
  if (!payload || typeof payload !== "object") return null;
  const result: TrackingData = {};
  for (const [k, v] of Object.entries(payload as Record<string, unknown>)) {
    if (typeof v !== "string") continue;
    if (v.length > 2048) continue;
    (result as Record<string, string>)[k] = v;
  }
  return Object.keys(result).length > 0 ? result : null;
}

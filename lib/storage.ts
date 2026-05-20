"use client";

const isBrowser = typeof window !== "undefined";

export function safeGetLocal(key: string): string | null {
  if (!isBrowser) return null;
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

export function safeSetLocal(key: string, value: string): void {
  if (!isBrowser) return;
  try {
    window.localStorage.setItem(key, value);
  } catch {
    /* private mode / quota */
  }
}

export function safeRemoveLocal(key: string): void {
  if (!isBrowser) return;
  try {
    window.localStorage.removeItem(key);
  } catch {
    /* ignore */
  }
}

export function safeGetSession(key: string): string | null {
  if (!isBrowser) return null;
  try {
    return window.sessionStorage.getItem(key);
  } catch {
    return null;
  }
}

export function safeSetSession(key: string, value: string): void {
  if (!isBrowser) return;
  try {
    window.sessionStorage.setItem(key, value);
  } catch {
    /* ignore */
  }
}

export function readJSON<T>(raw: string | null): T | null {
  if (!raw) return null;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

export const STORAGE_KEYS = {
  firstTouchAt: "spark-forms:first_touch_at",
  sessionId: "spark-forms:session_id",
  tracking: "spark-forms:tracking",
  answers: (slug: string) => `spark-forms:answers:${slug}`,
  currentStep: (slug: string) => `spark-forms:step:${slug}`,
} as const;

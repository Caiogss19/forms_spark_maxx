import { create } from "zustand";

import type { FormDefinition, Step } from "@/lib/schema";
import {
  STORAGE_KEYS,
  readJSON,
  safeGetLocal,
  safeRemoveLocal,
  safeSetLocal,
} from "@/lib/storage";
import {
  mergeTracking,
  type TrackingData,
} from "@/lib/tracking";

export type AnswerValue =
  | string
  | string[]
  | number
  | boolean
  | null
  | undefined;

export type Answers = Record<string, AnswerValue>;

export type RunnerStatus =
  | "idle"
  | "running"
  | "submitting"
  | "submitted"
  | "error";

interface FormStore {
  form: FormDefinition | null;
  steps: Step[];
  currentStepId: string | null;
  history: string[];
  answers: Answers;
  status: RunnerStatus;
  errorMessage: string | null;
  tracking: TrackingData;
  hiddenFields: Record<string, string>;

  setForm: (form: FormDefinition, initialAnswers?: Answers) => void;
  setAnswer: (id: string, value: AnswerValue) => void;
  setTracking: (incoming: TrackingData) => void;
  setHiddenFields: (values: Record<string, string>) => void;
  goTo: (stepId: string) => void;
  goNext: (resolveNext: (state: SnapshotState) => string | null) => void;
  goPrev: () => void;
  setStatus: (status: RunnerStatus, errorMessage?: string | null) => void;
  clearPersistedAnswers: () => void;
  reset: () => void;
}

export type SnapshotState = {
  currentStepId: string;
  steps: Step[];
  answers: Answers;
};

interface PersistedAnswers {
  answers: Answers;
  currentStepId: string | null;
  history: string[];
  savedAt: string;
  schemaVersion: number;
}

const ANSWERS_SCHEMA_VERSION = 1;
const ANSWERS_MAX_AGE_MS = 1000 * 60 * 60 * 24 * 7; // 7 days

function loadPersistedAnswers(slug: string): PersistedAnswers | null {
  const raw = safeGetLocal(STORAGE_KEYS.answers(slug));
  const parsed = readJSON<PersistedAnswers>(raw);
  if (!parsed || parsed.schemaVersion !== ANSWERS_SCHEMA_VERSION) {
    return null;
  }
  const age = Date.now() - new Date(parsed.savedAt).getTime();
  if (Number.isNaN(age) || age > ANSWERS_MAX_AGE_MS) return null;
  return parsed;
}

function persistAnswers(
  slug: string,
  answers: Answers,
  currentStepId: string | null,
  history: string[],
) {
  const payload: PersistedAnswers = {
    answers,
    currentStepId,
    history,
    savedAt: new Date().toISOString(),
    schemaVersion: ANSWERS_SCHEMA_VERSION,
  };
  try {
    safeSetLocal(STORAGE_KEYS.answers(slug), JSON.stringify(payload));
  } catch {
    /* ignore */
  }
}

export const useFormStore = create<FormStore>((set, get) => ({
  form: null,
  steps: [],
  currentStepId: null,
  history: [],
  answers: {},
  status: "idle",
  errorMessage: null,
  tracking: {},
  hiddenFields: {},

  setForm: (form, initialAnswers = {}) => {
    const persisted = loadPersistedAnswers(form.slug);
    const stepIds = new Set(form.steps.map((s) => s.id));
    const validHistory =
      persisted?.history.filter((id) => stepIds.has(id)) ?? [];
    const resumeStepId =
      persisted?.currentStepId && stepIds.has(persisted.currentStepId)
        ? persisted.currentStepId
        : (form.steps[0]?.id ?? null);

    set({
      form,
      steps: form.steps,
      currentStepId: resumeStepId,
      history: validHistory,
      answers: { ...(persisted?.answers ?? {}), ...initialAnswers },
      status: "running",
      errorMessage: null,
    });
  },

  setAnswer: (id, value) => {
    set((state) => {
      const nextAnswers = { ...state.answers, [id]: value };
      if (state.form) {
        persistAnswers(
          state.form.slug,
          nextAnswers,
          state.currentStepId,
          state.history,
        );
      }
      return { answers: nextAnswers };
    });
  },

  setTracking: (incoming) => {
    set((state) => ({ tracking: mergeTracking(state.tracking, incoming) }));
  },

  setHiddenFields: (values) => {
    set((state) => ({
      hiddenFields: { ...state.hiddenFields, ...values },
    }));
  },

  goTo: (stepId) => {
    const state = get();
    if (!state.steps.find((s) => s.id === stepId)) return;
    if (stepId === state.currentStepId) return;
    const nextHistory = state.currentStepId
      ? [...state.history, state.currentStepId]
      : state.history;
    set({ history: nextHistory, currentStepId: stepId });
    if (state.form) {
      persistAnswers(state.form.slug, state.answers, stepId, nextHistory);
    }
  },

  goNext: (resolveNext) => {
    const state = get();
    if (!state.currentStepId) return;
    const next = resolveNext({
      currentStepId: state.currentStepId,
      steps: state.steps,
      answers: state.answers,
    });
    if (!next) return;
    const nextHistory = [...state.history, state.currentStepId];
    set({ history: nextHistory, currentStepId: next });
    if (state.form) {
      persistAnswers(state.form.slug, state.answers, next, nextHistory);
    }
  },

  goPrev: () => {
    const state = get();
    if (state.history.length === 0) return;
    const prev = state.history[state.history.length - 1];
    const nextHistory = state.history.slice(0, -1);
    set({ currentStepId: prev, history: nextHistory });
    if (state.form) {
      persistAnswers(state.form.slug, state.answers, prev, nextHistory);
    }
  },

  setStatus: (status, errorMessage = null) => set({ status, errorMessage }),

  clearPersistedAnswers: () => {
    const state = get();
    if (state.form) safeRemoveLocal(STORAGE_KEYS.answers(state.form.slug));
  },

  reset: () => {
    const state = get();
    if (state.form) safeRemoveLocal(STORAGE_KEYS.answers(state.form.slug));
    set({
      form: null,
      steps: [],
      currentStepId: null,
      history: [],
      answers: {},
      status: "idle",
      errorMessage: null,
      tracking: {},
      hiddenFields: {},
    });
  },
}));

export function findStep(steps: Step[], id: string | null) {
  if (!id) return null;
  return steps.find((s) => s.id === id) ?? null;
}

export function defaultLinearNext({
  currentStepId,
  steps,
}: SnapshotState): string | null {
  const idx = steps.findIndex((s) => s.id === currentStepId);
  if (idx === -1 || idx === steps.length - 1) return null;
  return steps[idx + 1].id;
}

import { create } from "zustand";

import type { FormDefinition, Step } from "@/lib/schema";

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

  setForm: (form: FormDefinition, initialAnswers?: Answers) => void;
  setAnswer: (id: string, value: AnswerValue) => void;
  goTo: (stepId: string) => void;
  goNext: (resolveNext: (state: SnapshotState) => string | null) => void;
  goPrev: () => void;
  setStatus: (status: RunnerStatus, errorMessage?: string | null) => void;
  reset: () => void;
}

export type SnapshotState = {
  currentStepId: string;
  steps: Step[];
  answers: Answers;
};

export const useFormStore = create<FormStore>((set, get) => ({
  form: null,
  steps: [],
  currentStepId: null,
  history: [],
  answers: {},
  status: "idle",
  errorMessage: null,

  setForm: (form, initialAnswers = {}) =>
    set({
      form,
      steps: form.steps,
      currentStepId: form.steps[0]?.id ?? null,
      history: [],
      answers: initialAnswers,
      status: "running",
      errorMessage: null,
    }),

  setAnswer: (id, value) =>
    set((state) => ({ answers: { ...state.answers, [id]: value } })),

  goTo: (stepId) =>
    set((state) => {
      if (!state.steps.find((s) => s.id === stepId)) return state;
      if (stepId === state.currentStepId) return state;
      return {
        history: state.currentStepId
          ? [...state.history, state.currentStepId]
          : state.history,
        currentStepId: stepId,
      };
    }),

  goNext: (resolveNext) => {
    const state = get();
    if (!state.currentStepId) return;
    const next = resolveNext({
      currentStepId: state.currentStepId,
      steps: state.steps,
      answers: state.answers,
    });
    if (!next) return;
    set({
      history: [...state.history, state.currentStepId],
      currentStepId: next,
    });
  },

  goPrev: () =>
    set((state) => {
      if (state.history.length === 0) return state;
      const prev = state.history[state.history.length - 1];
      return {
        currentStepId: prev,
        history: state.history.slice(0, -1),
      };
    }),

  setStatus: (status, errorMessage = null) => set({ status, errorMessage }),

  reset: () =>
    set({
      form: null,
      steps: [],
      currentStepId: null,
      history: [],
      answers: {},
      status: "idle",
      errorMessage: null,
    }),
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

"use client";

import { AnimatePresence, motion } from "framer-motion";
import { ArrowLeft } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { interpolate } from "@/lib/interpolate";
import {
  resolveTheme,
  type FormDefinition,
  type Step,
} from "@/lib/schema";
import {
  defaultLinearNext,
  findStep,
  useFormStore,
  type AnswerValue,
} from "@/lib/store";
import { useFormSubmit } from "@/lib/use-form-submit";
import { useTrackingCapture } from "@/lib/use-tracking-capture";

import { KeyboardHints } from "./KeyboardHints";
import { ProgressBar } from "./ProgressBar";
import { StepRenderer } from "./StepRenderer";
import { StepShell } from "./StepShell";

interface Props {
  form: FormDefinition;
  embedded?: boolean;
}

export function FormRunner({ form, embedded = false }: Props) {
  const setForm = useFormStore((s) => s.setForm);
  const currentStepId = useFormStore((s) => s.currentStepId);
  const answers = useFormStore((s) => s.answers);
  const setAnswer = useFormStore((s) => s.setAnswer);
  const goNext = useFormStore((s) => s.goNext);
  const goPrev = useFormStore((s) => s.goPrev);
  const history = useFormStore((s) => s.history);
  const status = useFormStore((s) => s.status);
  const clearPersistedAnswers = useFormStore((s) => s.clearPersistedAnswers);

  useEffect(() => {
    setForm(form);
  }, [form, setForm]);

  useTrackingCapture(form);

  const honeypotRef = useRef<HTMLInputElement | null>(null);
  const { submit } = useFormSubmit({
    form,
    honeypotRef,
    onSuccess: (submissionId) => {
      clearPersistedAnswers();
      if (typeof window !== "undefined") {
        window.parent?.postMessage(
          { type: "spark-forms:submitted", submissionId, slug: form.slug },
          "*",
        );
      }
      if (form.redirectOnSuccess) {
        setTimeout(() => {
          window.location.href = form.redirectOnSuccess!;
        }, 1500);
      }
    },
  });

  const step = findStep(form.steps, currentStepId);

  /**
   * Intercepts advance BEFORE the linear next-step jump. Returns false to
   * abort navigation (validation/submit failed). Submits when the upcoming
   * step is a thank_you or when there is no next step.
   */
  const onBeforeAdvance = useCallback(async (): Promise<boolean> => {
    const state = useFormStore.getState();
    if (!state.currentStepId) return true;
    const nextId = defaultLinearNext({
      currentStepId: state.currentStepId,
      steps: state.steps,
      answers: state.answers,
    });
    const nextStep = nextId ? state.steps.find((s) => s.id === nextId) : null;
    const shouldSubmit = !nextStep || nextStep.type === "thank_you";
    if (!shouldSubmit) return true;
    const result = await submit();
    return result.ok;
  }, [submit]);

  const themeVars = useMemo(() => {
    const t = resolveTheme(form.theme);
    return {
      "--form-primary": t.primary,
      "--form-primary-foreground": "#FFFFFF",
      "--form-background": t.background,
      "--form-foreground": t.foreground,
    } as React.CSSProperties;
  }, [form.theme]);

  return (
    <div
      style={themeVars}
      className="flex min-h-screen flex-col bg-[var(--form-background,var(--background))] text-[var(--form-foreground,var(--foreground))]"
    >
      {step && step.type !== "thank_you" ? (
        <ProgressBar
          current={form.steps.findIndex((s) => s.id === step.id) + 1}
          total={form.steps.length}
        />
      ) : null}

      {!embedded ? (
        <header className="flex items-center justify-between px-6 py-4">
          {form.theme?.logoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={form.theme.logoUrl}
              alt={form.title}
              className="h-6 w-auto"
            />
          ) : (
            <span className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
              {form.title}
            </span>
          )}
          {form.estimatedMinutes ? (
            <span className="text-xs text-muted-foreground">
              ~ {form.estimatedMinutes} min
            </span>
          ) : null}
        </header>
      ) : null}

      {/* Honeypot — bots fill, humans don't see it. Read by useFormSubmit. */}
      <input
        ref={honeypotRef}
        type="text"
        name="company_website_url"
        tabIndex={-1}
        autoComplete="off"
        aria-hidden="true"
        style={{
          position: "absolute",
          left: "-9999px",
          width: "1px",
          height: "1px",
          opacity: 0,
        }}
      />

      <main className="flex flex-1 items-start justify-center">
        {!step ? (
          <div className="grid min-h-[60vh] place-items-center text-sm text-muted-foreground">
            Carregando…
          </div>
        ) : (
          <AnimatePresence mode="wait" initial={false}>
            <motion.div
              key={step.id}
              initial={{ opacity: 0, y: 24 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -24 }}
              transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
              className="w-full"
            >
              <StepView
                key={step.id}
                step={step}
                form={form}
                answers={answers}
                setAnswer={setAnswer}
                goPrev={goPrev}
                goNext={goNext}
                onBeforeAdvance={onBeforeAdvance}
                history={history}
                status={status}
              />
            </motion.div>
          </AnimatePresence>
        )}
      </main>
    </div>
  );
}

interface StepViewProps {
  step: Step;
  form: FormDefinition;
  answers: Record<string, AnswerValue>;
  setAnswer: (id: string, value: AnswerValue) => void;
  goPrev: () => void;
  goNext: (
    resolveNext: Parameters<
      ReturnType<typeof useFormStore.getState>["goNext"]
    >[0],
  ) => void;
  onBeforeAdvance: () => Promise<boolean>;
  history: string[];
  status: string;
}

function StepView({
  step,
  form,
  answers,
  setAnswer,
  goPrev,
  goNext,
  onBeforeAdvance,
  history,
  status,
}: StepViewProps) {
  const [error, setError] = useState<string | null>(null);
  const submitHandlerRef = useRef<
    null | (() => boolean | Promise<boolean>)
  >(null);

  const registerSubmit = useCallback(
    (handler: () => boolean | Promise<boolean>) => {
      submitHandlerRef.current = handler;
    },
    [],
  );

  const advance = useCallback(async () => {
    if (status === "submitting") return;
    const handler = submitHandlerRef.current;
    if (handler) {
      const ok = await handler();
      if (!ok) return;
    }
    const cleared = await onBeforeAdvance();
    if (!cleared) {
      // Submission errored — surface a generic message until the store
      // exposes a per-field error from the server response.
      const stateErr = useFormStore.getState().errorMessage;
      if (stateErr) setError(stateErr);
      return;
    }
    goNext(defaultLinearNext);
  }, [goNext, onBeforeAdvance, status]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const tag = (e.target as HTMLElement | null)?.tagName?.toLowerCase();
      const inEditable =
        tag === "input" || tag === "textarea" || tag === "select";

      if (e.key === "Tab" && e.shiftKey) {
        if (history.length > 0) {
          e.preventDefault();
          goPrev();
        }
        return;
      }
      if (e.key === "Enter" && !inEditable) {
        if (step.type === "thank_you") return;
        e.preventDefault();
        void advance();
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [advance, goPrev, history.length, step.type]);

  const stepIndex = form.steps.findIndex((s) => s.id === step.id);
  const title = interpolate(step.title, answers);
  const subtitle = step.subtitle
    ? interpolate(step.subtitle, answers)
    : undefined;
  const value = answers[step.mapTo ?? step.id];
  const isStatement = step.type === "statement";
  const isThankYou = step.type === "thank_you";
  const ctaLabel = step.cta ?? (isStatement ? "Continuar" : "OK");
  const isSubmitting = status === "submitting";

  return (
    <StepShell
      step={step}
      index={stepIndex}
      total={form.steps.length}
      title={title}
      subtitle={subtitle}
      helperText={step.helperText}
      errorMessage={error}
    >
      <StepRenderer
        step={step}
        value={value}
        setValue={(v) => setAnswer(step.mapTo ?? step.id, v)}
        advance={() => void advance()}
        registerSubmit={registerSubmit}
        error={error}
        setError={setError}
        redirectUrl={form.redirectOnSuccess}
      />

      {!isThankYou ? (
        <div className="mt-6 flex flex-wrap items-center justify-between gap-3">
          {history.length > 0 ? (
            <button
              type="button"
              onClick={() => goPrev()}
              disabled={isSubmitting}
              className="inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground disabled:cursor-not-allowed disabled:opacity-40"
            >
              <ArrowLeft className="h-3.5 w-3.5" aria-hidden />
              Voltar
            </button>
          ) : (
            <span />
          )}
          {step.type !== "single_choice" ? (
            <KeyboardHints
              ctaLabel={isSubmitting ? "Enviando…" : ctaLabel}
              onAdvance={() => void advance()}
              ctaDisabled={isSubmitting}
              hideEnterHint={isSubmitting}
            />
          ) : null}
        </div>
      ) : null}
    </StepShell>
  );
}

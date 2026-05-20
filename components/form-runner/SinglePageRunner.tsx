"use client";

import { motion } from "framer-motion";
import { CheckCircle2 } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { interpolate } from "@/lib/interpolate";
import {
  findActiveDisqualifier,
  resolveTheme,
  SIZE_DEFAULTS,
  type FormDefinition,
  type Step,
} from "@/lib/schema";
import { useFormStore, type AnswerValue } from "@/lib/store";
import { useFormSubmit } from "@/lib/use-form-submit";
import { useTrackingCapture } from "@/lib/use-tracking-capture";

import { DisqualifierModal } from "./DisqualifierModal";
import { StepRenderer } from "./StepRenderer";

interface Props {
  form: FormDefinition;
  embedded?: boolean;
}

/**
 * Classic long-form layout: every step rendered top-to-bottom on one
 * page with a single submit at the end. Reuses the same field components
 * the SteppedFormRunner uses — the field's `advance` is wired to the
 * page-level submit so Enter inside a text input behaves like an
 * HTML <form> submit (validates all rows, surfaces all errors).
 *
 * Statement steps render as plain copy blocks. Thank-you steps don't
 * render at all in this mode — successMessage / form.successMessage
 * fills the post-submit surface instead.
 */
export function SinglePageRunner({ form, embedded = false }: Props) {
  const setForm = useFormStore((s) => s.setForm);
  const answers = useFormStore((s) => s.answers);
  const setAnswer = useFormStore((s) => s.setAnswer);
  const status = useFormStore((s) => s.status);
  const errorMessage = useFormStore((s) => s.errorMessage);
  const clearPersistedAnswers = useFormStore((s) => s.clearPersistedAnswers);

  const [errors, setErrors] = useState<Record<string, string | null>>({});
  const [successId, setSuccessId] = useState<string | null>(null);
  const handlersRef = useRef<
    Map<string, () => boolean | Promise<boolean>>
  >(new Map());

  useEffect(() => {
    setForm(form);
  }, [form, setForm]);

  useTrackingCapture(form);

  const honeypotRef = useRef<HTMLInputElement | null>(null);
  const { submit } = useFormSubmit({
    form,
    honeypotRef,
    onSuccess: (submissionId) => {
      setSuccessId(submissionId);
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

  const sizes = useMemo(() => {
    const o = form.theme ?? {};
    return {
      formWidth: o.formWidth ?? SIZE_DEFAULTS.formWidth,
      formMinHeight: o.formMinHeight ?? SIZE_DEFAULTS.formMinHeight,
      formPadding: o.formPadding ?? SIZE_DEFAULTS.formPadding,
      titleSize: o.titleSize ?? SIZE_DEFAULTS.titleSize,
      descriptionSize: o.descriptionSize ?? SIZE_DEFAULTS.descriptionSize,
      inputHeight: o.inputHeight ?? SIZE_DEFAULTS.inputHeight,
      inputTextSize: o.inputTextSize ?? SIZE_DEFAULTS.inputTextSize,
      fieldGap: o.fieldGap ?? SIZE_DEFAULTS.fieldGap,
      ctaGap: o.ctaGap ?? SIZE_DEFAULTS.ctaGap,
      ctaHeight: o.ctaHeight ?? SIZE_DEFAULTS.ctaHeight,
      ctaTextSize: o.ctaTextSize ?? SIZE_DEFAULTS.ctaTextSize,
      lgpdSize: o.lgpdSize ?? SIZE_DEFAULTS.lgpdSize,
    };
  }, [form.theme]);

  const themeVars = useMemo(() => {
    const t = resolveTheme(form.theme);
    const o = form.theme ?? {};
    return {
      "--form-primary": t.primary,
      "--form-primary-foreground": o.primaryForeground ?? "#FFFFFF",
      "--form-background": t.background,
      "--form-foreground": t.foreground,
      "--form-card-bg": o.cardBackground ?? "transparent",
      "--form-card-radius": o.cardBorderRadius ?? "1rem",
      "--form-input-bg": o.inputBackground ?? "transparent",
      "--form-input-border": o.inputBorder ?? "var(--border)",
      "--form-input-focus-border": o.inputBorder ?? "var(--foreground)",
      "--form-input-radius": o.inputRadius ?? "0.5rem",
      "--form-input-placeholder":
        o.mutedForeground ?? "var(--muted-foreground)",
      "--form-muted-foreground":
        o.mutedForeground ?? "var(--muted-foreground)",
      // Pipe sizing into the inputs/dropdown shared CSS vars.
      "--form-input-height": sizes.inputHeight,
      "--form-input-text-size": sizes.inputTextSize,
    } as React.CSSProperties;
  }, [form.theme, sizes.inputHeight, sizes.inputTextSize]);

  const showLabels = form.theme?.showLabels !== false;
  const titleAlign = form.theme?.titleAlign ?? "left";
  const showHeader = form.theme?.showFormChrome !== false;

  const registerSubmit = useCallback(
    (stepId: string) =>
      (handler: () => boolean | Promise<boolean>) => {
        handlersRef.current.set(stepId, handler);
      },
    [],
  );

  const setErrorFor = useCallback(
    (stepId: string) => (msg: string | null) =>
      setErrors((prev) =>
        prev[stepId] === msg ? prev : { ...prev, [stepId]: msg },
      ),
    [],
  );

  const runValidation = useCallback(async (): Promise<boolean> => {
    let allOk = true;
    for (const [, handler] of handlersRef.current) {
      const ok = await handler();
      if (!ok) allOk = false;
    }
    return allOk;
  }, []);

  const disqualifier = useMemo(
    () => findActiveDisqualifier(form, answers),
    [form, answers],
  );

  // Clearing the disqualifying answer on dismiss (instead of just
  // acknowledging) lets the user immediately pick a different option.
  const dismissDisqualifier = useCallback(() => {
    if (!disqualifier) return;
    const step = form.steps.find((s) => s.id === disqualifier.stepId);
    if (!step) return;
    const key = step.mapTo ?? step.id;
    const current = answers[key];
    // For multi_choice we strip only the offending value; for single
    // selects we clear the whole answer.
    if (Array.isArray(current)) {
      const next = (current as string[]).filter(
        (v) => v !== disqualifier.optionValue,
      );
      setAnswer(key, next.length > 0 ? next : null);
    } else {
      setAnswer(key, null);
    }
  }, [disqualifier, form.steps, answers, setAnswer]);

  const onSubmit = useCallback(async () => {
    if (status === "submitting") return;
    if (disqualifier) return;
    const valid = await runValidation();
    if (!valid) {
      // Scroll the first error into view so the user knows what to fix.
      if (typeof document !== "undefined") {
        const firstError = document.querySelector("[data-spark-error]");
        firstError?.scrollIntoView({ behavior: "smooth", block: "center" });
      }
      return;
    }
    await submit();
  }, [runValidation, status, submit, disqualifier]);

  // Input fields call `advance` on Enter / single_choice auto-advance.
  // In single_page mode that maps to "submit the whole form".
  const advance = useCallback(() => {
    void onSubmit();
  }, [onSubmit]);

  // Filter out non-input flow steps; they get rendered specially.
  const inputSteps = form.steps.filter(
    (s) => s.type !== "thank_you",
  );

  if (successId) {
    return (
      <div
        style={themeVars}
        className="flex min-h-screen flex-col bg-[var(--form-background,var(--background))] text-[var(--form-foreground,var(--foreground))]"
      >
        {!embedded && showHeader ? <FormHeader form={form} /> : null}
        <main className="flex flex-1 items-center justify-center px-6 py-12">
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
            className="mx-auto flex w-full max-w-md flex-col items-start gap-4"
          >
            <CheckCircle2
              className="h-10 w-10 text-[var(--form-primary,var(--primary))]"
              aria-hidden
            />
            <h2 className="text-2xl font-semibold tracking-tight md:text-3xl">
              {form.successMessage ?? "Recebido! Vamos te chamar em breve."}
            </h2>
            {form.redirectOnSuccess ? (
              <p className="text-sm text-muted-foreground">
                Redirecionando…
              </p>
            ) : null}
          </motion.div>
        </main>
      </div>
    );
  }

  return (
    <div
      style={themeVars}
      className="flex min-h-screen flex-col bg-[var(--form-background,var(--background))] text-[var(--form-foreground,var(--foreground))]"
    >
      {!embedded && showHeader ? <FormHeader form={form} /> : null}

      {/* Honeypot field — same anti-spam pattern as the stepped runner. */}
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

      <main
        className="mx-auto w-full flex-1"
        style={{
          maxWidth: sizes.formWidth,
          minHeight: sizes.formMinHeight,
          padding: sizes.formPadding,
        }}
      >
        <div
          style={{
            background: "var(--form-card-bg)",
            borderRadius: "var(--form-card-radius)",
          }}
        >
          <header
            className={titleAlign === "center" ? "space-y-2 text-center" : "space-y-2"}
            style={{ marginBottom: sizes.formPadding }}
          >
            <h1
              className="font-semibold tracking-tight"
              style={{ fontSize: sizes.titleSize, lineHeight: "1.2" }}
            >
              {interpolate(form.title, answers)}
            </h1>
            {form.description ? (
              <p
                className="leading-relaxed text-[var(--form-muted-foreground,var(--muted-foreground))]"
                style={{ fontSize: sizes.descriptionSize }}
              >
                {interpolate(form.description, answers)}
              </p>
            ) : null}
          </header>

          <form
            onSubmit={(e) => {
              e.preventDefault();
              void onSubmit();
            }}
            noValidate
            style={{ display: "flex", flexDirection: "column", gap: sizes.fieldGap }}
          >
            {inputSteps.map((step, index) => (
              <FieldRow
                key={step.id}
                step={step}
                index={index}
                answers={answers}
                setAnswer={setAnswer}
                advance={advance}
                registerSubmit={registerSubmit(step.id)}
                setError={setErrorFor(step.id)}
                error={errors[step.id] ?? null}
                redirectUrl={form.redirectOnSuccess}
                showLabels={showLabels}
                labelTextSize={sizes.inputTextSize}
              />
            ))}

            {errorMessage ? (
              <p
                role="alert"
                data-spark-error
                className="rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-3 text-destructive"
                style={{ fontSize: sizes.inputTextSize }}
              >
                {errorMessage}
              </p>
            ) : null}

            <button
              type="submit"
              disabled={status === "submitting" || Boolean(disqualifier)}
              style={{
                borderRadius: "var(--form-input-radius, 0.5rem)",
                marginTop: sizes.ctaGap,
                height: sizes.ctaHeight,
                fontSize: sizes.ctaTextSize,
              }}
              className="inline-flex w-full items-center justify-center gap-2 bg-[var(--form-primary,var(--primary))] px-6 font-medium text-[var(--form-primary-foreground,var(--primary-foreground))] transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {status === "submitting"
                ? "Enviando…"
                : (form.steps.find((s) => s.type === "thank_you")?.cta ??
                  "Enviar")}
            </button>

            {form.lgpdNotice ? (
              <p
                className="whitespace-pre-line text-[var(--form-muted-foreground,var(--muted-foreground))]"
                style={{
                  fontSize: sizes.lgpdSize,
                  lineHeight: "1.5",
                  marginTop: "12px",
                }}
              >
                {form.lgpdNotice}
              </p>
            ) : null}
          </form>
        </div>
      </main>

      {disqualifier ? (
        <DisqualifierModal
          config={disqualifier.config}
          onClose={dismissDisqualifier}
        />
      ) : null}
    </div>
  );
}

function FormHeader({ form }: { form: FormDefinition }) {
  return (
    <header className="flex items-center justify-between border-b border-border px-6 py-4">
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
  );
}

interface FieldRowProps {
  step: Step;
  index: number;
  answers: Record<string, AnswerValue>;
  setAnswer: (id: string, value: AnswerValue) => void;
  advance: () => void;
  registerSubmit: (h: () => boolean | Promise<boolean>) => void;
  setError: (msg: string | null) => void;
  error: string | null;
  redirectUrl?: string;
  showLabels?: boolean;
  labelTextSize?: string;
}

function FieldRow({
  step,
  index,
  answers,
  setAnswer,
  advance,
  registerSubmit,
  setError,
  error,
  redirectUrl,
  showLabels = true,
  labelTextSize,
}: FieldRowProps) {
  if (step.type === "statement") {
    return (
      <div className="rounded-lg border border-border bg-muted/30 px-4 py-3 text-sm leading-relaxed text-[var(--form-muted-foreground,var(--muted-foreground))]">
        <p className="font-medium text-foreground">
          {interpolate(step.title, answers)}
        </p>
        {step.subtitle ? (
          <p className="mt-1">{interpolate(step.subtitle, answers)}</p>
        ) : null}
      </div>
    );
  }

  const value = answers[step.mapTo ?? step.id];

  // When labels are hidden, the step's title becomes the placeholder so
  // the field still self-describes (matches the Sprout Social aesthetic).
  const effectiveStep = showLabels
    ? step
    : {
        ...step,
        placeholder:
          step.placeholder ?? interpolate(step.title, answers),
      };

  return (
    <div className="space-y-1.5" data-spark-error={error ? "true" : undefined}>
      {showLabels ? (
        <div>
          <label
            htmlFor={`f-${step.id}`}
            className="block font-medium leading-tight"
            style={labelTextSize ? { fontSize: labelTextSize } : undefined}
          >
            {interpolate(step.title, answers)}
            {step.required ? (
              <span className="ml-1 text-destructive" aria-hidden>
                *
              </span>
            ) : null}
          </label>
          {step.subtitle ? (
            <p className="mt-1 text-xs text-[var(--form-muted-foreground,var(--muted-foreground))]">
              {interpolate(step.subtitle, answers)}
            </p>
          ) : null}
        </div>
      ) : null}

      <StepRenderer
        step={effectiveStep}
        value={value}
        setValue={(v) => setAnswer(step.mapTo ?? step.id, v)}
        advance={advance}
        registerSubmit={registerSubmit}
        error={error}
        setError={setError}
        redirectUrl={redirectUrl}
      />

      {error ? (
        <p
          role="alert"
          data-spark-error="true"
          className="text-xs font-medium text-destructive"
        >
          {error}
        </p>
      ) : showLabels && step.helperText ? (
        <p className="text-xs text-[var(--form-muted-foreground,var(--muted-foreground))]">
          {step.helperText}
        </p>
      ) : null}

      <span className="sr-only" id={`f-${step.id}-end`}>
        step {index + 1}
      </span>
    </div>
  );
}

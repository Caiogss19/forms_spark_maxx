"use client";

import { useMemo, useState } from "react";

import { interpolate } from "@/lib/interpolate";
import {
  resolveTheme,
  SIZE_DEFAULTS,
  type FormDefinition,
  type Step,
} from "@/lib/schema";
import type { Answers, AnswerValue } from "@/lib/store";

interface Props {
  form: FormDefinition;
}

/**
 * Static, self-contained preview of the form layout. Mirrors the
 * SinglePageRunner visual structure pixel-for-pixel but without zustand,
 * submission, or validation — so the editor can show "what the user
 * sees" updating live as the schema/theme changes. Field components
 * are intentionally mocked (uncontrolled local state) rather than
 * importing the real field renderers, which would pull the runner store
 * in alongside them.
 */
export function FormPreview({ form }: Props) {
  const [answers, setAnswers] = useState<Answers>({});

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
    const formBg = o.transparentBackground ? "transparent" : t.background;
    const cardBg = o.transparentCard
      ? "transparent"
      : (o.cardBackground ?? "transparent");
    const inputBorder = o.hideInputBorder
      ? "transparent"
      : (o.inputBorder ?? "rgba(255,255,255,0.12)");
    return {
      "--prev-primary": t.primary,
      "--prev-primary-foreground": o.primaryForeground ?? "#FFFFFF",
      "--prev-background": formBg,
      "--prev-foreground": t.foreground,
      "--prev-card-bg": cardBg,
      "--prev-card-radius": o.cardBorderRadius ?? "1rem",
      "--prev-input-bg": o.inputBackground ?? "transparent",
      "--prev-input-border": inputBorder,
      "--prev-input-radius": o.inputRadius ?? "0.5rem",
      "--prev-input-placeholder":
        o.mutedForeground ?? "rgba(255,255,255,0.45)",
      "--prev-muted": o.mutedForeground ?? "rgba(255,255,255,0.55)",
      "--prev-input-height": sizes.inputHeight,
      "--prev-input-text-size": sizes.inputTextSize,
      "--prev-input-border-width": o.hideInputBorder
        ? "0"
        : (o.inputBorderWidth ?? "1px"),
    } as React.CSSProperties;
  }, [form.theme, sizes.inputHeight, sizes.inputTextSize]);

  const titleAlign = form.theme?.titleAlign ?? "left";
  const showLabels = form.theme?.showLabels !== false;
  const inputSteps = form.steps.filter((s) => s.type !== "thank_you");
  const ctaLabel =
    form.steps.find((s) => s.type === "thank_you")?.cta ?? "Enviar";

  return (
    <div
      style={{
        ...themeVars,
        background: "var(--prev-background)",
        color: "var(--prev-foreground)",
        fontFamily: form.theme?.fontFamily ?? "Inter, system-ui, sans-serif",
      }}
      className="overflow-hidden rounded-2xl border border-border shadow-inner"
    >
      <div
        className="mx-auto w-full"
        style={{
          maxWidth: sizes.formWidth,
          minHeight: sizes.formMinHeight,
          padding: form.theme?.removeFormPadding ? "0" : sizes.formPadding,
        }}
      >
        <div
          style={{
            background: "var(--prev-card-bg)",
            borderRadius: "var(--prev-card-radius)",
            borderStyle: form.theme?.cardBorderWidth ? "solid" : undefined,
            borderWidth: form.theme?.cardBorderWidth,
            borderColor: form.theme?.cardBorderColor,
            boxShadow: form.theme?.hideCardShadow
              ? "none"
              : form.theme?.cardShadow,
          }}
        >
          <header
            className={
              titleAlign === "center" ? "space-y-2 text-center" : "space-y-2"
            }
            style={{ marginBottom: sizes.formPadding }}
          >
            <h1
              style={{
                fontSize: sizes.titleSize,
                lineHeight: form.theme?.titleLineHeight ?? "1.2",
                letterSpacing: form.theme?.titleLetterSpacing,
                color: form.theme?.titleColor,
                fontWeight: form.theme?.titleWeight ?? "600",
                margin: 0,
              }}
            >
              {interpolate(form.title || "Título do formulário", answers)}
            </h1>
            {form.description ? (
              <p
                style={{
                  fontSize: sizes.descriptionSize,
                  lineHeight: form.theme?.descriptionLineHeight ?? "1.6",
                  color: form.theme?.descriptionColor ?? "var(--prev-muted)",
                  margin: 0,
                }}
              >
                {interpolate(form.description, answers)}
              </p>
            ) : null}
          </header>

          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: sizes.fieldGap,
            }}
          >
            {inputSteps.map((step) => (
              <FieldMock
                key={step.id}
                step={step}
                answers={answers}
                setValue={(v) =>
                  setAnswers((p) => ({
                    ...p,
                    [step.mapTo ?? step.id]: v as AnswerValue,
                  }))
                }
                showLabels={showLabels}
                labelTextSize={sizes.inputTextSize}
                labelColor={form.theme?.labelColor}
                labelWeight={form.theme?.labelWeight ?? "500"}
                labelLineHeight={form.theme?.labelLineHeight ?? "1.3"}
                errorColor={form.theme?.errorColor ?? "#ef4444"}
              />
            ))}

            <button
              type="button"
              disabled
              style={{
                borderRadius:
                  form.theme?.ctaRadius ?? "var(--prev-input-radius)",
                marginTop: sizes.ctaGap,
                height: sizes.ctaHeight,
                fontSize: sizes.ctaTextSize,
                fontWeight: form.theme?.ctaWeight ?? "500",
                background:
                  form.theme?.ctaBackground ?? "var(--prev-primary)",
                color:
                  form.theme?.ctaForeground ?? "var(--prev-primary-foreground)",
                width: "100%",
                cursor: "default",
              }}
              className="inline-flex items-center justify-center gap-2 px-6"
            >
              {ctaLabel}
            </button>

            {form.lgpdNotice ? (
              <p
                className="whitespace-pre-line"
                style={{
                  fontSize: sizes.lgpdSize,
                  lineHeight: "1.5",
                  marginTop: "12px",
                  color: "var(--prev-muted)",
                }}
              >
                {form.lgpdNotice}
              </p>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}

interface FieldMockProps {
  step: Step;
  answers: Answers;
  setValue: (v: unknown) => void;
  showLabels: boolean;
  labelTextSize: string;
  labelColor?: string;
  labelWeight: string;
  labelLineHeight: string;
  errorColor: string;
}

function FieldMock({
  step,
  answers,
  setValue,
  showLabels,
  labelTextSize,
  labelColor,
  labelWeight,
  labelLineHeight,
  errorColor,
}: FieldMockProps) {
  const value = answers[step.mapTo ?? step.id];

  if (step.type === "statement") {
    return (
      <div
        style={{
          background: "rgba(255,255,255,0.04)",
          borderRadius: "var(--prev-input-radius)",
          padding: "10px 14px",
          fontSize: labelTextSize,
        }}
      >
        <p style={{ fontWeight: 600 }}>
          {interpolate(step.title, answers)}
        </p>
        {step.subtitle ? (
          <p style={{ marginTop: 4, color: "var(--prev-muted)" }}>
            {interpolate(step.subtitle, answers)}
          </p>
        ) : null}
      </div>
    );
  }

  // When labels are hidden, title doubles as placeholder so the field
  // still self-describes (same convention as SinglePageRunner).
  const effectiveStep: Step = showLabels
    ? step
    : {
        ...step,
        placeholder: step.placeholder ?? interpolate(step.title, answers),
      };

  const baseInputStyle: React.CSSProperties = {
    height: "var(--prev-input-height)",
    fontSize: "var(--prev-input-text-size)",
    borderRadius: "var(--prev-input-radius)",
    background: "var(--prev-input-bg)",
    borderColor: "var(--prev-input-border)",
    borderWidth: "var(--prev-input-border-width)",
    borderStyle: "solid",
    color: "var(--prev-foreground)",
    width: "100%",
    padding: "0 16px",
    outline: "none",
  };

  return (
    <div>
      {showLabels ? (
        <label
          className="mb-1 block"
          style={{
            fontSize: labelTextSize,
            lineHeight: labelLineHeight,
            color: labelColor,
            fontWeight: labelWeight,
          }}
        >
          {interpolate(step.title, answers)}
          {step.required ? (
            <span style={{ color: errorColor, marginLeft: 4 }}>*</span>
          ) : null}
        </label>
      ) : null}

      {renderInput(effectiveStep, value, setValue, baseInputStyle)}
    </div>
  );
}

function renderInput(
  step: Step,
  value: unknown,
  setValue: (v: unknown) => void,
  style: React.CSSProperties,
) {
  switch (step.type) {
    case "long_text":
      return (
        <textarea
          value={typeof value === "string" ? value : ""}
          onChange={(e) => setValue(e.target.value)}
          placeholder={step.placeholder}
          rows={3}
          style={{
            ...style,
            height: "auto",
            minHeight: "var(--prev-input-height)",
            padding: "10px 14px",
            resize: "none",
          }}
        />
      );
    case "single_choice":
    case "multi_choice":
      return (
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          {(step.options ?? []).map((opt) => (
            <button
              key={opt.value}
              type="button"
              onClick={() => setValue(opt.value)}
              style={{
                ...style,
                height: "var(--prev-input-height)",
                textAlign: "left",
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                gap: 8,
              }}
            >
              {opt.emoji ? <span>{opt.emoji}</span> : null}
              <span>{opt.label}</span>
            </button>
          ))}
        </div>
      );
    case "dropdown":
      return (
        <select
          value={typeof value === "string" ? value : ""}
          onChange={(e) => setValue(e.target.value)}
          style={{ ...style, appearance: "none" }}
        >
          <option value="" disabled>
            {step.placeholder ?? "Selecione…"}
          </option>
          {(step.options ?? []).map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
      );
    case "number":
    case "currency":
      return (
        <input
          type="number"
          value={typeof value === "string" || typeof value === "number" ? String(value) : ""}
          onChange={(e) => setValue(e.target.value)}
          placeholder={step.placeholder}
          style={style}
        />
      );
    case "date":
      return (
        <input
          type="date"
          value={typeof value === "string" ? value : ""}
          onChange={(e) => setValue(e.target.value)}
          style={style}
        />
      );
    case "consent":
      return (
        <label
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            fontSize: "var(--prev-input-text-size)",
          }}
        >
          <input
            type="checkbox"
            checked={value === true}
            onChange={(e) => setValue(e.target.checked)}
          />
          {step.subtitle ?? step.title}
        </label>
      );
    case "email":
    case "phone":
    case "url":
    case "short_text":
    default:
      return (
        <input
          type="text"
          value={typeof value === "string" ? value : ""}
          onChange={(e) => setValue(e.target.value)}
          placeholder={step.placeholder}
          style={style}
        />
      );
  }
}

"use client";

import { Check } from "lucide-react";
import { useEffect } from "react";

import { cn } from "@/lib/utils";
import type { FieldProps } from "@/components/form-runner/fields/types";

export function Consent({
  step,
  value,
  setValue,
  registerSubmit,
  setError,
}: FieldProps) {
  const isOn = value === true;

  useEffect(() => {
    registerSubmit(() => {
      if (step.required && !isOn) {
        setError(
          step.messages?.required ??
            "Você precisa concordar pra continuar.",
        );
        return false;
      }
      setError(null);
      return true;
    });
  }, [step, isOn, registerSubmit, setError]);

  return (
    <button
      type="button"
      onClick={() => {
        setValue(!isOn);
        setError(null);
      }}
      aria-pressed={isOn}
      className={cn(
        "group flex w-full items-start gap-3 rounded-lg border p-4 text-left transition-colors",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
        isOn
          ? "border-[var(--form-primary,var(--primary))] bg-[var(--form-primary,var(--primary))]/5"
          : "border-border hover:border-foreground/40 hover:bg-muted/60",
      )}
    >
      <span
        className={cn(
          "mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded border transition-colors",
          isOn
            ? "border-[var(--form-primary,var(--primary))] bg-[var(--form-primary,var(--primary))] text-[var(--form-primary-foreground,var(--primary-foreground))]"
            : "border-border bg-transparent",
        )}
      >
        {isOn ? <Check className="h-3.5 w-3.5" aria-hidden /> : null}
      </span>
      <span className="text-sm leading-relaxed">
        {step.placeholder ?? step.helperText ?? "Concordo com os termos."}
      </span>
    </button>
  );
}

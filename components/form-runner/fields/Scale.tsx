"use client";

import { useEffect } from "react";

import { cn } from "@/lib/utils";
import type { FieldProps } from "@/components/form-runner/fields/types";

export function Scale({
  step,
  value,
  setValue,
  advance,
  registerSubmit,
  setError,
}: FieldProps) {
  const min = step.validation?.min ?? 0;
  const max = step.validation?.max ?? 10;
  const range = Array.from({ length: max - min + 1 }, (_, i) => i + min);
  const current = typeof value === "number" ? value : null;

  useEffect(() => {
    registerSubmit(() => {
      if (step.required && current === null) {
        setError(step.messages?.required ?? "Selecione uma nota.");
        return false;
      }
      setError(null);
      return true;
    });
  }, [step, current, registerSubmit, setError]);

  function pick(n: number) {
    setValue(n);
    setError(null);
    setTimeout(() => advance(), 250);
  }

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-6 gap-1.5 md:grid-cols-11">
        {range.map((n) => (
          <button
            key={n}
            type="button"
            onClick={() => pick(n)}
            className={cn(
              "h-11 rounded-md border text-sm font-medium transition-colors",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
              current === n
                ? "border-[var(--form-primary,var(--primary))] bg-[var(--form-primary,var(--primary))] text-[var(--form-primary-foreground,var(--primary-foreground))]"
                : "border-border bg-transparent hover:border-foreground/40 hover:bg-muted/60",
            )}
          >
            {n}
          </button>
        ))}
      </div>
      <div className="flex justify-between text-xs text-muted-foreground">
        <span>{min}</span>
        <span>{max}</span>
      </div>
    </div>
  );
}

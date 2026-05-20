"use client";

import { useEffect } from "react";

import { cn } from "@/lib/utils";
import type { FieldProps } from "@/components/form-runner/fields/types";

const HOTKEYS = ["1", "2", "3", "4", "5", "6", "7", "8", "9"];

export function SingleChoice({
  step,
  value,
  setValue,
  advance,
  registerSubmit,
  setError,
}: FieldProps) {
  const options = step.options ?? [];

  useEffect(() => {
    registerSubmit(() => {
      if (step.required && !value) {
        setError(step.messages?.required ?? "Selecione uma opção.");
        return false;
      }
      setError(null);
      return true;
    });
  }, [step, value, registerSubmit, setError]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      // Ignore if the user is typing in a focused input/textarea
      const tag = (e.target as HTMLElement | null)?.tagName?.toLowerCase();
      if (tag === "input" || tag === "textarea") return;
      const idx = HOTKEYS.indexOf(e.key);
      if (idx >= 0 && options[idx]) {
        e.preventDefault();
        pick(options[idx].value);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [options]);

  function pick(v: string) {
    setValue(v);
    setError(null);
    setTimeout(() => advance(), 250);
  }

  return (
    <div className="grid gap-2">
      {options.map((opt, idx) => {
        const selected = value === opt.value;
        return (
          <button
            key={opt.value}
            type="button"
            onClick={() => pick(opt.value)}
            className={cn(
              "group flex w-full items-center gap-3 rounded-lg border px-4 py-3.5 text-left transition-colors",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
              selected
                ? "border-[var(--form-primary,var(--primary))] bg-[var(--form-primary,var(--primary))]/5"
                : "border-border hover:border-foreground/40 hover:bg-muted/60",
            )}
          >
            <span
              className={cn(
                "flex h-7 w-9 items-center justify-center rounded border text-xs font-medium",
                selected
                  ? "border-[var(--form-primary,var(--primary))] bg-[var(--form-primary,var(--primary))] text-[var(--form-primary-foreground,var(--primary-foreground))]"
                  : "border-border bg-muted text-muted-foreground group-hover:border-foreground/40",
              )}
            >
              {idx < HOTKEYS.length ? HOTKEYS[idx] : String(idx + 1)}
            </span>
            {opt.emoji ? <span className="text-lg">{opt.emoji}</span> : null}
            <span className="flex-1 text-sm font-medium">{opt.label}</span>
            {opt.description ? (
              <span className="text-xs text-muted-foreground">
                {opt.description}
              </span>
            ) : null}
          </button>
        );
      })}
    </div>
  );
}

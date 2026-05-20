"use client";

import { Check } from "lucide-react";
import { useEffect, useMemo } from "react";

import { cn } from "@/lib/utils";
import type { FieldProps } from "@/components/form-runner/fields/types";

const HOTKEYS = ["1", "2", "3", "4", "5", "6", "7", "8", "9"];

export function MultiChoice({
  step,
  value,
  setValue,
  registerSubmit,
  setError,
}: FieldProps) {
  const options = step.options ?? [];
  const selected = useMemo<string[]>(
    () => (Array.isArray(value) ? (value as string[]) : []),
    [value],
  );

  useEffect(() => {
    registerSubmit(() => {
      if (step.required && selected.length === 0) {
        setError(step.messages?.required ?? "Selecione ao menos uma opção.");
        return false;
      }
      const min = step.validation?.min;
      const max = step.validation?.max;
      if (min != null && selected.length < min) {
        setError(step.messages?.min ?? `Selecione ao menos ${min}.`);
        return false;
      }
      if (max != null && selected.length > max) {
        setError(step.messages?.max ?? `Selecione no máximo ${max}.`);
        return false;
      }
      setError(null);
      return true;
    });
  }, [step, selected, registerSubmit, setError]);

  function toggle(v: string) {
    const next = selected.includes(v)
      ? selected.filter((x) => x !== v)
      : [...selected, v];
    setValue(next);
    setError(null);
  }

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const tag = (e.target as HTMLElement | null)?.tagName?.toLowerCase();
      if (tag === "input" || tag === "textarea") return;
      const idx = HOTKEYS.indexOf(e.key);
      if (idx >= 0 && options[idx]) {
        e.preventDefault();
        toggle(options[idx].value);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [options, selected]);

  return (
    <div className="grid gap-2">
      {options.map((opt, idx) => {
        const isOn = selected.includes(opt.value);
        return (
          <button
            key={opt.value}
            type="button"
            onClick={() => toggle(opt.value)}
            aria-pressed={isOn}
            className={cn(
              "group flex w-full items-center gap-3 rounded-lg border px-4 py-3.5 text-left transition-colors",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
              isOn
                ? "border-[var(--form-primary,var(--primary))] bg-[var(--form-primary,var(--primary))]/5"
                : "border-border hover:border-foreground/40 hover:bg-muted/60",
            )}
          >
            <span
              className={cn(
                "flex h-7 w-9 items-center justify-center rounded border text-xs font-medium",
                isOn
                  ? "border-[var(--form-primary,var(--primary))] bg-[var(--form-primary,var(--primary))] text-[var(--form-primary-foreground,var(--primary-foreground))]"
                  : "border-border bg-muted text-muted-foreground group-hover:border-foreground/40",
              )}
            >
              {idx < HOTKEYS.length ? HOTKEYS[idx] : String(idx + 1)}
            </span>
            {opt.emoji ? <span className="text-lg">{opt.emoji}</span> : null}
            <span className="flex-1 text-sm font-medium">{opt.label}</span>
            <Check
              className={cn(
                "h-4 w-4 transition-opacity",
                isOn ? "opacity-100" : "opacity-0",
              )}
              aria-hidden
            />
          </button>
        );
      })}
    </div>
  );
}

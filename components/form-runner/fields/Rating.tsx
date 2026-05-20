"use client";

import { Star } from "lucide-react";
import { useEffect } from "react";

import { cn } from "@/lib/utils";
import type { FieldProps } from "@/components/form-runner/fields/types";

export function Rating({
  step,
  value,
  setValue,
  advance,
  registerSubmit,
  setError,
}: FieldProps) {
  const max = step.validation?.max ?? 5;
  const current = typeof value === "number" ? value : 0;

  useEffect(() => {
    registerSubmit(() => {
      if (step.required && current === 0) {
        setError(step.messages?.required ?? "Dê uma nota.");
        return false;
      }
      setError(null);
      return true;
    });
  }, [step, current, registerSubmit, setError]);

  function pick(n: number) {
    setValue(n);
    setError(null);
    setTimeout(() => advance(), 300);
  }

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const tag = (e.target as HTMLElement | null)?.tagName?.toLowerCase();
      if (tag === "input" || tag === "textarea") return;
      const n = Number(e.key);
      if (Number.isFinite(n) && n >= 1 && n <= max) {
        e.preventDefault();
        pick(n);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [max]);

  return (
    <div className="flex gap-1.5">
      {Array.from({ length: max }, (_, i) => i + 1).map((n) => (
        <button
          key={n}
          type="button"
          onClick={() => pick(n)}
          aria-label={`${n} de ${max}`}
          className="rounded-md p-1 transition-transform hover:scale-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <Star
            className={cn(
              "h-9 w-9 transition-colors",
              n <= current
                ? "fill-[var(--form-primary,var(--primary))] text-[var(--form-primary,var(--primary))]"
                : "fill-transparent text-muted-foreground",
            )}
          />
        </button>
      ))}
    </div>
  );
}

"use client";

import { ChevronDown } from "lucide-react";
import { useEffect, useRef } from "react";

import { cn } from "@/lib/utils";
import type { FieldProps } from "@/components/form-runner/fields/types";

export function Dropdown({
  step,
  value,
  setValue,
  advance,
  registerSubmit,
  setError,
}: FieldProps) {
  const ref = useRef<HTMLSelectElement>(null);
  const options = step.options ?? [];

  useEffect(() => {
    ref.current?.focus();
  }, [step.id]);

  useEffect(() => {
    registerSubmit(() => {
      if (step.required && (value === undefined || value === "")) {
        setError(step.messages?.required ?? "Selecione uma opção.");
        return false;
      }
      setError(null);
      return true;
    });
  }, [step, value, registerSubmit, setError]);

  const current = typeof value === "string" ? value : "";

  return (
    <div className="relative">
      <select
        ref={ref}
        value={current}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            advance();
          }
        }}
        className={cn(
          "flex h-12 w-full appearance-none rounded-lg border border-border bg-transparent px-4 pr-10 text-base outline-none transition-colors",
          "focus:border-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
        )}
      >
        <option value="" disabled>
          {step.placeholder ?? "Selecione…"}
        </option>
        {options.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
      <ChevronDown
        aria-hidden
        className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
      />
    </div>
  );
}

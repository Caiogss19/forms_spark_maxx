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
        style={{
          height: "var(--form-input-height, 3rem)",
          fontSize: "var(--form-input-text-size, 1rem)",
          borderRadius: "var(--form-input-radius, 0.5rem)",
          background: "var(--form-input-bg, transparent)",
          borderWidth: "var(--form-input-border-width, 1px)",
          color: current ? undefined : "var(--form-input-placeholder, var(--muted-foreground))",
        }}
        className={cn(
          "flex w-full appearance-none border px-4 pr-10 outline-none transition-colors",
          "border-[var(--form-input-border,var(--border))]",
          "focus:border-[var(--form-input-focus-border,var(--foreground))]",
          "focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
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

"use client";

import { useEffect, useRef } from "react";

import { Input } from "@/components/ui/input";
import type { FieldProps } from "@/components/form-runner/fields/types";
import { formatBRL } from "@/lib/mask";

export function Currency({
  step,
  value,
  setValue,
  advance,
  registerSubmit,
  error,
  setError,
}: FieldProps) {
  const ref = useRef<HTMLInputElement>(null);

  useEffect(() => {
    ref.current?.focus();
  }, [step.id]);

  useEffect(() => {
    registerSubmit(() => {
      const n = typeof value === "number" ? value : 0;
      if (step.required && n <= 0) {
        setError(step.messages?.required ?? "Informe um valor.");
        return false;
      }
      const { min, max } = step.validation ?? {};
      if (min != null && n < min) {
        setError(step.messages?.min ?? `Mínimo R$ ${min}.`);
        return false;
      }
      if (max != null && n > max) {
        setError(step.messages?.max ?? `Máximo R$ ${max}.`);
        return false;
      }
      setError(null);
      return true;
    });
  }, [step, value, registerSubmit, setError]);

  const amount = typeof value === "number" ? value : 0;
  const display = amount > 0 ? formatBRL(amount).display : "";

  return (
    <Input
      ref={ref}
      type="text"
      value={display}
      onChange={(e) => {
        const parsed = formatBRL(e.target.value);
        setValue(parsed.amount);
        if (error) setError(null);
      }}
      onKeyDown={(e) => {
        if (e.key === "Enter") {
          e.preventDefault();
          advance();
        }
      }}
      placeholder={step.placeholder ?? "R$ 0,00"}
      inputMode="numeric"
      enterKeyHint="next"
    />
  );
}

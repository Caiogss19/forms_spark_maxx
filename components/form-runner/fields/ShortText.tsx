"use client";

import { useEffect, useRef } from "react";

import { Input } from "@/components/ui/input";
import type { FieldProps } from "@/components/form-runner/fields/types";

export function ShortText({
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
      const v = typeof value === "string" ? value.trim() : "";
      if (step.required && !v) {
        setError(step.messages?.required ?? "Campo obrigatório.");
        return false;
      }
      const min = step.validation?.min;
      const max = step.validation?.max;
      if (min != null && v.length < min) {
        setError(
          step.messages?.min ?? `Mínimo ${min} caracteres.`,
        );
        return false;
      }
      if (max != null && v.length > max) {
        setError(
          step.messages?.max ?? `Máximo ${max} caracteres.`,
        );
        return false;
      }
      if (step.validation?.pattern) {
        try {
          const re = new RegExp(step.validation.pattern);
          if (!re.test(v)) {
            setError(step.messages?.pattern ?? "Formato inválido.");
            return false;
          }
        } catch {
          /* ignore malformed regex */
        }
      }
      setError(null);
      return true;
    });
  }, [step, value, registerSubmit, setError]);

  return (
    <Input
      ref={ref}
      value={typeof value === "string" ? value : ""}
      onChange={(e) => {
        setValue(e.target.value);
        if (error) setError(null);
      }}
      onKeyDown={(e) => {
        if (e.key === "Enter") {
          e.preventDefault();
          advance();
        }
      }}
      placeholder={step.placeholder}
      autoComplete="off"
      enterKeyHint="next"
      inputMode="text"
      maxLength={step.validation?.max}
    />
  );
}

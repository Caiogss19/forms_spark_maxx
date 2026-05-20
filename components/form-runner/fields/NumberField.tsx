"use client";

import { useEffect, useRef } from "react";

import { Input } from "@/components/ui/input";
import type { FieldProps } from "@/components/form-runner/fields/types";

export function NumberField({
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
      if (value === undefined || value === null || value === "") {
        if (step.required) {
          setError(step.messages?.required ?? "Informe um número.");
          return false;
        }
        setError(null);
        return true;
      }
      const n = typeof value === "number" ? value : Number(value);
      if (!Number.isFinite(n)) {
        setError(step.messages?.invalid ?? "Não é um número válido.");
        return false;
      }
      const { min, max } = step.validation ?? {};
      if (min != null && n < min) {
        setError(step.messages?.min ?? `Mínimo ${min}.`);
        return false;
      }
      if (max != null && n > max) {
        setError(step.messages?.max ?? `Máximo ${max}.`);
        return false;
      }
      setError(null);
      return true;
    });
  }, [step, value, registerSubmit, setError]);

  return (
    <Input
      ref={ref}
      type="number"
      value={
        value === undefined || value === null
          ? ""
          : typeof value === "number"
            ? String(value)
            : String(value)
      }
      onChange={(e) => {
        const raw = e.target.value;
        if (raw === "") {
          setValue(undefined);
        } else {
          const n = Number(raw);
          setValue(Number.isFinite(n) ? n : raw);
        }
        if (error) setError(null);
      }}
      onKeyDown={(e) => {
        if (e.key === "Enter") {
          e.preventDefault();
          advance();
        }
      }}
      placeholder={step.placeholder ?? "0"}
      inputMode="numeric"
      min={step.validation?.min}
      max={step.validation?.max}
      enterKeyHint="next"
    />
  );
}

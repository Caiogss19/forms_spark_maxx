"use client";

import { useEffect, useRef } from "react";

import { Input } from "@/components/ui/input";
import type { FieldProps } from "@/components/form-runner/fields/types";

export function DateField({
  step,
  value,
  setValue,
  advance,
  registerSubmit,
  setError,
}: FieldProps) {
  const ref = useRef<HTMLInputElement>(null);

  useEffect(() => {
    ref.current?.focus();
  }, [step.id]);

  useEffect(() => {
    registerSubmit(() => {
      const v = typeof value === "string" ? value : "";
      if (step.required && !v) {
        setError(step.messages?.required ?? "Informe uma data.");
        return false;
      }
      if (!v && !step.required) {
        setError(null);
        return true;
      }
      const d = new Date(v);
      if (Number.isNaN(d.getTime())) {
        setError(step.messages?.invalid ?? "Data inválida.");
        return false;
      }
      setError(null);
      return true;
    });
  }, [step, value, registerSubmit, setError]);

  return (
    <Input
      ref={ref}
      type="date"
      value={typeof value === "string" ? value : ""}
      onChange={(e) => setValue(e.target.value)}
      onKeyDown={(e) => {
        if (e.key === "Enter") {
          e.preventDefault();
          advance();
        }
      }}
      placeholder={step.placeholder}
    />
  );
}

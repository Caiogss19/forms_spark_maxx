"use client";

import { useEffect, useRef } from "react";

import { Textarea } from "@/components/ui/textarea";
import type { FieldProps } from "@/components/form-runner/fields/types";

export function LongText({
  step,
  value,
  setValue,
  advance,
  registerSubmit,
  error,
  setError,
}: FieldProps) {
  const ref = useRef<HTMLTextAreaElement>(null);

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
        setError(step.messages?.min ?? `Mínimo ${min} caracteres.`);
        return false;
      }
      if (max != null && v.length > max) {
        setError(step.messages?.max ?? `Máximo ${max} caracteres.`);
        return false;
      }
      setError(null);
      return true;
    });
  }, [step, value, registerSubmit, setError]);

  const v = typeof value === "string" ? value : "";
  const max = step.validation?.max;

  return (
    <div className="space-y-2">
      <Textarea
        ref={ref}
        value={v}
        onChange={(e) => {
          setValue(e.target.value);
          if (error) setError(null);
        }}
        onKeyDown={(e) => {
          // Enter advances; Shift+Enter inserts newline (Typeform pattern).
          if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault();
            advance();
          }
        }}
        placeholder={step.placeholder}
        rows={5}
        maxLength={max}
      />
      {max != null ? (
        <p className="text-right text-xs text-muted-foreground">
          {v.length}/{max}
        </p>
      ) : null}
    </div>
  );
}

"use client";

import { useEffect, useRef } from "react";

import { Input } from "@/components/ui/input";
import type { FieldProps } from "@/components/form-runner/fields/types";
import { formatPhoneBR } from "@/lib/mask";

export function Phone({
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
      const v = typeof value === "string" ? value : "";
      const digits = v.replace(/\D/g, "");
      if (step.required && digits.length === 0) {
        setError(step.messages?.required ?? "Informe seu telefone.");
        return false;
      }
      if (!digits && !step.required) {
        setError(null);
        return true;
      }
      if (digits.length < 10) {
        setError(step.messages?.invalid ?? "Telefone incompleto.");
        return false;
      }
      setError(null);
      return true;
    });
  }, [step, value, registerSubmit, setError]);

  const display = typeof value === "string" ? value : "";

  return (
    <Input
      ref={ref}
      type="tel"
      value={display}
      onChange={(e) => {
        const { display } = formatPhoneBR(e.target.value);
        setValue(display);
        if (error) setError(null);
      }}
      onKeyDown={(e) => {
        if (e.key === "Enter") {
          e.preventDefault();
          advance();
        }
      }}
      placeholder={step.placeholder ?? "(11) 99999-9999"}
      autoComplete="tel"
      inputMode="tel"
      enterKeyHint="next"
    />
  );
}

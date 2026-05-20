"use client";

import { useEffect, useRef } from "react";

import { Input } from "@/components/ui/input";
import type { FieldProps } from "@/components/form-runner/fields/types";
import { validateEmail } from "@/lib/corporate-email";

export function Email({
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
        setError(step.messages?.required ?? "Informe seu e-mail.");
        return false;
      }
      if (!v && !step.required) {
        setError(null);
        return true;
      }
      const result = validateEmail(v, {
        corporateOnly: step.validation?.corporateOnly,
      });
      if (!result.ok) {
        const msg =
          result.reason === "blocked_domain"
            ? (step.messages?.blockedDomain ??
              "Use seu e-mail corporativo pra agilizarmos seu atendimento.")
            : (step.messages?.invalid ?? "E-mail inválido.");
        setError(msg);
        return false;
      }
      setError(null);
      return true;
    });
  }, [step, value, registerSubmit, setError]);

  return (
    <Input
      ref={ref}
      type="email"
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
      placeholder={step.placeholder ?? "voce@empresa.com.br"}
      autoComplete="email"
      inputMode="email"
      enterKeyHint="next"
      spellCheck={false}
      autoCapitalize="off"
    />
  );
}

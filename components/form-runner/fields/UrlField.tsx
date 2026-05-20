"use client";

import { useEffect, useRef } from "react";

import { Input } from "@/components/ui/input";
import type { FieldProps } from "@/components/form-runner/fields/types";

function isLikelyUrl(value: string): boolean {
  try {
    const withProtocol = /^https?:\/\//i.test(value) ? value : `https://${value}`;
    const u = new URL(withProtocol);
    return Boolean(u.hostname) && u.hostname.includes(".");
  } catch {
    return false;
  }
}

export function UrlField({
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
        setError(step.messages?.required ?? "Informe um link.");
        return false;
      }
      if (!v && !step.required) {
        setError(null);
        return true;
      }
      if (!isLikelyUrl(v)) {
        setError(step.messages?.invalid ?? "Link inválido.");
        return false;
      }
      // Normalize: prepend https:// if missing.
      const normalized = /^https?:\/\//i.test(v) ? v : `https://${v}`;
      if (normalized !== v) setValue(normalized);
      setError(null);
      return true;
    });
  }, [step, value, registerSubmit, setError, setValue]);

  return (
    <Input
      ref={ref}
      type="url"
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
      placeholder={step.placeholder ?? "https://..."}
      autoComplete="url"
      inputMode="url"
      spellCheck={false}
      autoCapitalize="off"
      enterKeyHint="next"
    />
  );
}

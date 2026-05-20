"use client";

import { useEffect, useRef } from "react";

import { Input } from "@/components/ui/input";
import type { FieldProps } from "@/components/form-runner/fields/types";
import { validateEmail } from "@/lib/corporate-email";
import { validateEmailRemote } from "@/lib/validate-email-client";

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
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    ref.current?.focus();
    return () => {
      abortRef.current?.abort();
    };
  }, [step.id]);

  useEffect(() => {
    registerSubmit(async () => {
      const v = typeof value === "string" ? value.trim().toLowerCase() : "";
      if (step.required && !v) {
        setError(step.messages?.required ?? "Informe seu e-mail.");
        return false;
      }
      if (!v && !step.required) {
        setError(null);
        return true;
      }
      const corporateOnly = !!step.validation?.corporateOnly;
      const local = validateEmail(v, { corporateOnly });
      if (!local.ok) {
        setError(messageFor(local.reason, step));
        return false;
      }

      // Remote verdict: applies env-overridden blocklist and (when
      // EMAIL_VALIDATION_MX is on) MX presence. Falls back to ok:true
      // on network errors so we never punish the lead.
      abortRef.current?.abort();
      const ctrl = new AbortController();
      abortRef.current = ctrl;
      const remote = await validateEmailRemote(v, corporateOnly, ctrl.signal);
      if (!remote.ok) {
        setError(messageFor(remote.reason, step));
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

function messageFor(
  reason: string | undefined,
  step: FieldProps["step"],
): string {
  switch (reason) {
    case "blocked_domain":
      return (
        step.messages?.blockedDomain ??
        "Use seu e-mail corporativo pra agilizarmos seu atendimento."
      );
    case "disposable":
      return (
        step.messages?.blockedDomain ??
        "E-mails descartáveis não são aceitos. Use um e-mail real."
      );
    case "no_mx_record":
      return (
        step.messages?.invalid ??
        "Esse domínio não recebe e-mails. Confere a digitação?"
      );
    case "invalid_format":
    default:
      return step.messages?.invalid ?? "E-mail inválido.";
  }
}

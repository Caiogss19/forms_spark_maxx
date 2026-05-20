"use client";

import { useEffect } from "react";

import type { FieldProps } from "@/components/form-runner/fields/types";

export function NotImplemented({ step, registerSubmit, setError }: FieldProps) {
  useEffect(() => {
    registerSubmit(() => {
      setError(null);
      return true;
    });
  }, [registerSubmit, setError]);

  return (
    <div className="rounded-lg border border-dashed border-border p-4 text-sm text-muted-foreground">
      Tipo de campo <code className="rounded bg-muted px-1 py-0.5">{step.type}</code>{" "}
      ainda não foi implementado. Vai entrar num próximo bloco.
    </div>
  );
}

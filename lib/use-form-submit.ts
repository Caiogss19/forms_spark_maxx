"use client";

import { useCallback } from "react";

import type { FormDefinition } from "@/lib/schema";
import { useFormStore } from "@/lib/store";

interface SubmitResult {
  ok: boolean;
  submissionId?: string;
  message?: string;
}

interface UseFormSubmitOptions {
  form: FormDefinition;
  honeypotRef: React.RefObject<HTMLInputElement | null>;
  onSuccess?: (submissionId: string) => void;
}

export function useFormSubmit({
  form,
  honeypotRef,
  onSuccess,
}: UseFormSubmitOptions) {
  const setStatus = useFormStore((s) => s.setStatus);
  const status = useFormStore((s) => s.status);

  const submit = useCallback(async (): Promise<SubmitResult> => {
    const state = useFormStore.getState();
    setStatus("submitting");

    const body = {
      slug: form.slug,
      answers: state.answers,
      hiddenFields: state.hiddenFields,
      tracking: state.tracking,
      hp: honeypotRef.current?.value ?? "",
    };

    try {
      const res = await fetch("/api/submit", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = (await res.json()) as
        | { ok: true; submissionId: string }
        | { ok: false; message: string };

      if (!res.ok || !data.ok) {
        const message =
          ("message" in data && data.message) ||
          "Não foi possível enviar agora. Tente novamente.";
        setStatus("error", message);
        return { ok: false, message };
      }
      setStatus("submitted");
      onSuccess?.(data.submissionId);
      return { ok: true, submissionId: data.submissionId };
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Erro de rede.";
      setStatus("error", message);
      return { ok: false, message };
    }
  }, [form.slug, honeypotRef, onSuccess, setStatus]);

  return { submit, status };
}

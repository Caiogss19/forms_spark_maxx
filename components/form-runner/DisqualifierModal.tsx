"use client";

import { AlertCircle, ArrowUpRight, X } from "lucide-react";
import { useEffect } from "react";
import { createPortal } from "react-dom";

import type { DisqualifyConfig } from "@/lib/schema";

interface Props {
  config: DisqualifyConfig;
  onClose: () => void;
}

export function DisqualifierModal({ config, onClose }: Props) {
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener("keydown", onKey);
    };
  }, [onClose]);

  if (typeof document === "undefined") return null;

  const hasCta = config.ctaUrl && config.ctaUrl.length > 0;
  const ctaLabel = config.ctaLabel ?? "Saiba mais";

  return createPortal(
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 p-4"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby="disqualifier-title"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: "var(--form-background, var(--background))",
          color: "var(--form-foreground, var(--foreground))",
          borderRadius: "var(--form-card-radius, 1rem)",
        }}
        className="relative flex w-full max-w-md flex-col gap-5 border border-border p-7 shadow-2xl"
      >
        <button
          type="button"
          onClick={onClose}
          aria-label="Fechar"
          className="absolute right-3 top-3 rounded-md p-1.5 text-[var(--form-muted-foreground,var(--muted-foreground))] transition-colors hover:bg-muted hover:text-[var(--form-foreground,var(--foreground))]"
        >
          <X className="h-4 w-4" />
        </button>

        <div
          style={{
            background: "var(--form-primary, var(--primary))",
            color: "var(--form-primary-foreground, var(--primary-foreground))",
          }}
          className="inline-flex h-10 w-10 items-center justify-center rounded-full"
        >
          <AlertCircle className="h-5 w-5" aria-hidden />
        </div>

        <div className="space-y-2">
          <h2
            id="disqualifier-title"
            className="text-xl font-semibold tracking-tight"
          >
            {config.title ?? "Não foi dessa vez"}
          </h2>
          <p className="whitespace-pre-line text-sm leading-relaxed text-[var(--form-muted-foreground,var(--muted-foreground))]">
            {config.message}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3 pt-1">
          {hasCta ? (
            <a
              href={config.ctaUrl}
              target="_blank"
              rel="noopener noreferrer"
              style={{
                background: "var(--form-primary, var(--primary))",
                color:
                  "var(--form-primary-foreground, var(--primary-foreground))",
                borderRadius: "var(--form-input-radius, 0.5rem)",
              }}
              className="inline-flex h-11 items-center gap-1.5 px-5 text-sm font-medium transition-opacity hover:opacity-90"
            >
              {ctaLabel}
              <ArrowUpRight className="h-3.5 w-3.5" aria-hidden />
            </a>
          ) : null}
          <button
            type="button"
            onClick={onClose}
            style={{ borderRadius: "var(--form-input-radius, 0.5rem)" }}
            className="inline-flex h-11 items-center px-4 text-sm font-medium text-[var(--form-muted-foreground,var(--muted-foreground))] transition-colors hover:bg-muted hover:text-[var(--form-foreground,var(--foreground))]"
          >
            Voltar e alterar resposta
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}

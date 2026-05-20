"use client";

import { CornerDownLeft } from "lucide-react";

interface Props {
  ctaLabel?: string;
  ctaDisabled?: boolean;
  onAdvance?: () => void;
  hideEnterHint?: boolean;
}

export function KeyboardHints({
  ctaLabel = "Continuar",
  ctaDisabled,
  onAdvance,
  hideEnterHint,
}: Props) {
  return (
    <div className="flex flex-wrap items-center gap-3 text-sm">
      <button
        type="button"
        onClick={onAdvance}
        disabled={ctaDisabled}
        className="inline-flex h-11 items-center gap-2 rounded-lg bg-[var(--form-primary,var(--primary))] px-5 font-medium text-[var(--form-primary-foreground,var(--primary-foreground))] transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
      >
        {ctaLabel}
        <CornerDownLeft className="h-4 w-4" aria-hidden />
      </button>
      {!hideEnterHint ? (
        <p className="text-xs text-muted-foreground">
          ou pressione{" "}
          <kbd className="rounded border border-border bg-muted px-1.5 py-0.5 font-mono text-[10px]">
            Enter ↵
          </kbd>
        </p>
      ) : null}
    </div>
  );
}

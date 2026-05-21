"use client";

import { CheckCircle2 } from "lucide-react";

interface Props {
  redirectUrl?: string;
}

export function ThankYou({ redirectUrl }: Props) {
  return (
    <div className="flex flex-col items-start gap-4">
      <CheckCircle2
        className="h-10 w-10 text-[var(--form-primary,var(--primary))]"
        aria-hidden
      />
      {redirectUrl ? (
        <a
          href={redirectUrl}
          target="_top"
          rel="noopener"
          className="text-sm font-medium underline underline-offset-4"
        >
          Ir para a próxima etapa →
        </a>
      ) : null}
    </div>
  );
}

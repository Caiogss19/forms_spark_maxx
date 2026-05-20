"use client";

import type { ReactNode } from "react";

import type { Step } from "@/lib/schema";

interface Props {
  step: Step;
  index: number;
  total: number;
  title: string;
  subtitle?: string;
  helperText?: string;
  errorMessage?: string | null;
  children: ReactNode;
}

export function StepShell({
  step,
  index,
  total,
  title,
  subtitle,
  helperText,
  errorMessage,
  children,
}: Props) {
  return (
    <div className="mx-auto flex w-full max-w-xl flex-col gap-6 px-6 py-12 md:py-20">
      {step.type !== "thank_you" && step.type !== "statement" ? (
        <p className="text-xs font-medium uppercase tracking-widest text-muted-foreground">
          {index + 1} / {total}
          {step.required ? " · obrigatório" : ""}
        </p>
      ) : null}

      <header className="space-y-2">
        <h2 className="text-2xl font-semibold leading-tight tracking-tight md:text-3xl">
          {title}
        </h2>
        {subtitle ? (
          <p className="text-base leading-relaxed text-muted-foreground">
            {subtitle}
          </p>
        ) : null}
      </header>

      <div className="flex flex-col gap-3">{children}</div>

      {helperText && !errorMessage ? (
        <p className="text-xs text-muted-foreground">{helperText}</p>
      ) : null}
      {errorMessage ? (
        <p
          role="alert"
          className="text-sm font-medium text-destructive"
        >
          {errorMessage}
        </p>
      ) : null}
    </div>
  );
}

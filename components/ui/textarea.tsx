import * as React from "react";
import { cn } from "@/lib/utils";

export type TextareaProps = React.TextareaHTMLAttributes<HTMLTextAreaElement>;

export const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ className, rows = 4, style, ...props }, ref) => (
    <textarea
      ref={ref}
      rows={rows}
      style={{
        borderRadius: "var(--form-input-radius, 0.5rem)",
        background: "var(--form-input-bg, transparent)",
        ...style,
      }}
      className={cn(
        "flex min-h-[96px] w-full border px-4 py-3 text-base outline-none transition-colors",
        "border-[var(--form-input-border,var(--border))]",
        "placeholder:text-[var(--form-input-placeholder,var(--muted-foreground))]",
        "focus:border-[var(--form-input-focus-border,var(--foreground))]",
        "focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
        "disabled:cursor-not-allowed disabled:opacity-50",
        className,
      )}
      {...props}
    />
  ),
);
Textarea.displayName = "Textarea";

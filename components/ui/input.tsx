import * as React from "react";
import { cn } from "@/lib/utils";

export type InputProps = React.InputHTMLAttributes<HTMLInputElement>;

export const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, type = "text", style, ...props }, ref) => (
    <input
      ref={ref}
      type={type}
      style={{
        height: "var(--form-input-height, 3rem)",
        fontSize: "var(--form-input-text-size, 1rem)",
        borderRadius: "var(--form-input-radius, 0.5rem)",
        background: "var(--form-input-bg, transparent)",
        borderWidth: "var(--form-input-border-width, 1px)",
        ...style,
      }}
      className={cn(
        "flex w-full border px-4 py-2 outline-none transition-colors",
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
Input.displayName = "Input";

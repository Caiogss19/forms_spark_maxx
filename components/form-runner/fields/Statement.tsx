"use client";

import { useEffect } from "react";

import type { FieldProps } from "@/components/form-runner/fields/types";

export function Statement({ registerSubmit, setError }: FieldProps) {
  useEffect(() => {
    registerSubmit(() => {
      setError(null);
      return true;
    });
  }, [registerSubmit, setError]);
  return null;
}

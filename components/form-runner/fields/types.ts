import type { Step } from "@/lib/schema";
import type { AnswerValue } from "@/lib/store";

export interface FieldProps {
  step: Step;
  value: AnswerValue;
  setValue: (v: AnswerValue) => void;
  advance: () => void;
  registerSubmit: (handler: () => boolean | Promise<boolean>) => void;
  error?: string | null;
  setError: (msg: string | null) => void;
}

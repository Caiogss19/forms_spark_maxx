import type { Answers } from "@/lib/store";

const TOKEN = /\{\{\s*([\w.]+)\s*\}\}/g;

export function interpolate(template: string, answers: Answers): string {
  if (!template.includes("{{")) return template;
  return template.replace(TOKEN, (_, key) => {
    const value = answers[key];
    if (value == null) return "";
    if (Array.isArray(value)) return value.join(", ");
    return String(value);
  });
}

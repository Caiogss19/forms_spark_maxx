import { z } from "zod";

export const FIELD_TYPES = [
  "short_text",
  "long_text",
  "email",
  "phone",
  "single_choice",
  "multi_choice",
  "dropdown",
  "rating",
  "scale",
  "date",
  "number",
  "currency",
  "url",
  "file",
  "consent",
  "statement",
  "thank_you",
] as const;

export const FieldType = z.enum(FIELD_TYPES);
export type FieldTypeValue = z.infer<typeof FieldType>;

export const StepOptionSchema = z.object({
  value: z.string(),
  label: z.string(),
  emoji: z.string().optional(),
  description: z.string().optional(),
});
export type StepOption = z.infer<typeof StepOptionSchema>;

export const StepValidationSchema = z.object({
  min: z.number().optional(),
  max: z.number().optional(),
  pattern: z.string().optional(),
  corporateOnly: z.boolean().optional(),
  maxFileSizeMB: z.number().optional(),
  acceptedMimeTypes: z.array(z.string()).optional(),
});
export type StepValidation = z.infer<typeof StepValidationSchema>;

export const LOGIC_OPS = ["eq", "neq", "in", "contains", "gt", "lt"] as const;
export const LogicOp = z.enum(LOGIC_OPS);

export const StepLogicSchema = z.object({
  if: z.object({
    field: z.string(),
    op: LogicOp,
    value: z.unknown(),
  }),
  goto: z.string(),
});
export type StepLogic = z.infer<typeof StepLogicSchema>;

export const StepMessagesSchema = z.object({
  required: z.string().optional(),
  invalid: z.string().optional(),
  blockedDomain: z.string().optional(),
  min: z.string().optional(),
  max: z.string().optional(),
  pattern: z.string().optional(),
});
export type StepMessages = z.infer<typeof StepMessagesSchema>;

export const StepSchema = z.object({
  id: z.string().min(1),
  type: FieldType,
  title: z.string(),
  subtitle: z.string().optional(),
  placeholder: z.string().optional(),
  helperText: z.string().optional(),
  required: z.boolean().default(false),
  cta: z.string().optional(),
  options: z.array(StepOptionSchema).optional(),
  validation: StepValidationSchema.optional(),
  logic: z.array(StepLogicSchema).optional(),
  mapTo: z.string().optional(),
  messages: StepMessagesSchema.optional(),
  imageUrl: z.url().optional(),
});
export type Step = z.infer<typeof StepSchema>;

export const ThemeSchema = z.object({
  primary: z.string().optional(),
  background: z.string().optional(),
  foreground: z.string().optional(),
  fontFamily: z.string().optional(),
  logoUrl: z.url().optional(),
  mode: z.enum(["light", "dark", "auto"]).optional(),
});
export type Theme = z.infer<typeof ThemeSchema>;

export const DEFAULT_THEME: Required<
  Pick<Theme, "primary" | "background" | "foreground" | "fontFamily" | "mode">
> = {
  primary: "#0A0A0A",
  background: "#FFFFFF",
  foreground: "#0A0A0A",
  fontFamily: "Inter",
  mode: "auto",
};

export function resolveTheme(theme?: Theme) {
  return { ...DEFAULT_THEME, ...(theme ?? {}) };
}

export const PRODUCTS = [
  "sprout",
  "community",
  "creator_pulse",
  "generico",
] as const;
export const Product = z.enum(PRODUCTS);
export type ProductValue = z.infer<typeof Product>;

export const HiddenFieldSchema = z.object({
  key: z.string(),
  default: z.string().optional(),
});

export const FormSchema = z.object({
  slug: z.string().regex(/^[a-z0-9-]+$/, "kebab-case only"),
  title: z.string(),
  description: z.string().optional(),
  estimatedMinutes: z.number().optional(),
  language: z.enum(["pt-BR", "en-US"]).default("pt-BR"),
  theme: ThemeSchema.optional(),
  webhookUrl: z.url().optional(),
  webhookAuth: z.string().optional(),
  conversionIdentifier: z.string(),
  product: Product,
  tags: z.array(z.string()).default([]),
  redirectOnSuccess: z.url().optional(),
  successMessage: z.string().optional(),
  hiddenFields: z.array(HiddenFieldSchema).default([]),
  steps: z.array(StepSchema).min(1),
});
export type FormDefinition = z.infer<typeof FormSchema>;

export function safeParseForm(input: unknown) {
  return FormSchema.safeParse(input);
}

export function parseForm(input: unknown): FormDefinition {
  return FormSchema.parse(input);
}

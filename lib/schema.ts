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

export const DisqualifyConfigSchema = z.object({
  title: z.string().optional(),
  message: z.string().min(1),
  ctaLabel: z.string().optional(),
  ctaUrl: z.string().optional(),
});
export type DisqualifyConfig = z.infer<typeof DisqualifyConfigSchema>;

export const StepOptionSchema = z.object({
  value: z.string(),
  label: z.string(),
  emoji: z.string().optional(),
  description: z.string().optional(),
  disqualify: DisqualifyConfigSchema.optional(),
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
  primaryForeground: z.string().optional(),
  background: z.string().optional(),
  foreground: z.string().optional(),
  cardBackground: z.string().optional(),
  cardBorderRadius: z.string().optional(),
  inputBackground: z.string().optional(),
  inputBorder: z.string().optional(),
  inputRadius: z.string().optional(),
  mutedForeground: z.string().optional(),
  fontFamily: z.string().optional(),
  logoUrl: z.url().optional(),
  mode: z.enum(["light", "dark", "auto"]).optional(),
  showLabels: z.boolean().optional(),
  titleAlign: z.enum(["left", "center"]).optional(),
  showFormChrome: z.boolean().optional(),
  // Single-page sizing — CSS values (px/rem/em/%). Defaults match the
  // compact-form spec used in production embeds.
  formWidth: z.string().optional(),
  formMinHeight: z.string().optional(),
  formPadding: z.string().optional(),
  titleSize: z.string().optional(),
  descriptionSize: z.string().optional(),
  inputHeight: z.string().optional(),
  inputTextSize: z.string().optional(),
  fieldGap: z.string().optional(),
  ctaGap: z.string().optional(),
  ctaHeight: z.string().optional(),
  ctaTextSize: z.string().optional(),
  lgpdSize: z.string().optional(),
  // Backgrounds / chrome toggles — critical for embedding into Framer,
  // Webflow, etc. where the form should inherit the parent page's bg.
  transparentBackground: z.boolean().optional(),
  transparentCard: z.boolean().optional(),
  hideInputBorder: z.boolean().optional(),
  hideCardShadow: z.boolean().optional(),
  removeFormPadding: z.boolean().optional(),
  // Per-element colors (string CSS values).
  titleColor: z.string().optional(),
  labelColor: z.string().optional(),
  descriptionColor: z.string().optional(),
  errorColor: z.string().optional(),
  cardBorderColor: z.string().optional(),
  cardBorderWidth: z.string().optional(),
  inputBorderWidth: z.string().optional(),
  cardShadow: z.string().optional(),
  // Typography weights — "300" | "400" | "500" | "600" | "700".
  titleWeight: z.string().optional(),
  labelWeight: z.string().optional(),
  ctaWeight: z.string().optional(),
  // CTA color overrides (independent of "primary").
  ctaBackground: z.string().optional(),
  ctaForeground: z.string().optional(),
  ctaRadius: z.string().optional(),
});
export type Theme = z.infer<typeof ThemeSchema>;

export const SIZE_DEFAULTS = {
  formWidth: "390px",
  formMinHeight: "486px",
  formPadding: "20px",
  titleSize: "22px",
  descriptionSize: "13px",
  inputHeight: "40px",
  inputTextSize: "14px",
  fieldGap: "10px",
  ctaGap: "30px",
  ctaHeight: "40px",
  ctaTextSize: "14px",
  lgpdSize: "11px",
} as const;

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
  layout: z.enum(["stepped", "single_page"]).default("stepped"),
  theme: ThemeSchema.optional(),
  webhookUrl: z.url().optional(),
  webhookAuth: z.string().optional(),
  conversionIdentifier: z.string(),
  product: Product,
  tags: z.array(z.string()).default([]),
  redirectOnSuccess: z.url().optional(),
  successMessage: z.string().optional(),
  lgpdNotice: z.string().optional(),
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

/**
 * Walks the form steps and answers; returns the first disqualifier
 * config triggered by a currently-selected option, or null. Used by the
 * runner to gate advancement and surface a blocking modal.
 */
export function findActiveDisqualifier(
  form: FormDefinition,
  answers: Record<string, unknown>,
): { config: DisqualifyConfig; stepId: string; optionValue: string } | null {
  for (const step of form.steps) {
    if (!step.options || step.options.length === 0) continue;
    const key = step.mapTo ?? step.id;
    const answer = answers[key];
    if (answer == null || answer === "") continue;
    const selectedValues = Array.isArray(answer)
      ? (answer as unknown[]).map(String)
      : [String(answer)];
    for (const sv of selectedValues) {
      const opt = step.options.find((o) => o.value === sv);
      if (opt?.disqualify) {
        return {
          config: opt.disqualify,
          stepId: step.id,
          optionValue: opt.value,
        };
      }
    }
  }
  return null;
}

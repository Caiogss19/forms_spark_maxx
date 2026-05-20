"use client";

import {
  ArrowDown,
  ArrowLeft,
  ArrowUp,
  Code2,
  Plus,
  Trash2,
  X,
} from "lucide-react";
import Link from "next/link";
import { useState } from "react";

import { EmbedButton } from "@/components/admin/EmbedButton";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  FIELD_TYPES,
  FormSchema,
  SIZE_DEFAULTS,
  type FormDefinition,
  type Step,
  type StepOption,
} from "@/lib/schema";
import { cn } from "@/lib/utils";

interface Props {
  initialForm: FormDefinition;
}

export function FormEditor({ initialForm }: Props) {
  const [form, setForm] = useState<FormDefinition>(initialForm);
  const [saving, setSaving] = useState(false);
  const [savedAt, setSavedAt] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [jsonOpen, setJsonOpen] = useState(false);

  function patch(partial: Partial<FormDefinition>) {
    setForm((f) => ({ ...f, ...partial }));
  }

  function patchTheme(partial: Partial<NonNullable<FormDefinition["theme"]>>) {
    setForm((f) => ({ ...f, theme: { ...(f.theme ?? {}), ...partial } }));
  }

  function patchStep(idx: number, partial: Partial<Step>) {
    setForm((f) => {
      const next = [...f.steps];
      next[idx] = { ...next[idx], ...partial };
      return { ...f, steps: next };
    });
  }

  function removeStep(idx: number) {
    setForm((f) => {
      if (f.steps.length <= 1) return f;
      const next = f.steps.filter((_, i) => i !== idx);
      return { ...f, steps: next };
    });
  }

  function moveStep(idx: number, dir: -1 | 1) {
    setForm((f) => {
      const target = idx + dir;
      if (target < 0 || target >= f.steps.length) return f;
      const next = [...f.steps];
      [next[idx], next[target]] = [next[target], next[idx]];
      return { ...f, steps: next };
    });
  }

  function addStep() {
    setForm((f) => {
      const id = `field_${f.steps.length + 1}`;
      const newStep: Step = {
        id,
        type: "short_text",
        title: "Novo campo",
        required: false,
      };
      return { ...f, steps: [...f.steps, newStep] };
    });
  }

  async function save() {
    setSaving(true);
    setError(null);
    try {
      const validated = FormSchema.safeParse(form);
      if (!validated.success) {
        setError(
          "Schema inválido: " +
            validated.error.issues
              .map((i) => `${i.path.join(".")}: ${i.message}`)
              .join("; "),
        );
        return;
      }
      const res = await fetch(`/api/admin/forms/${form.slug}`, {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ schema: validated.data, active: true }),
      });
      const data = (await res.json()) as { ok: boolean; message?: string };
      if (!res.ok || !data.ok) {
        setError(data.message ?? "Falha ao salvar.");
        return;
      }
      setSavedAt(new Date().toLocaleTimeString("pt-BR"));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro inesperado.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-30 border-b border-border bg-background/90 backdrop-blur">
        <div className="mx-auto flex max-w-4xl items-center justify-between gap-3 px-6 py-3">
          <Link
            href="/admin"
            className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            Voltar
          </Link>
          <div className="flex items-center gap-2 text-sm">
            {savedAt ? (
              <span className="text-xs text-muted-foreground">
                Salvo {savedAt}
              </span>
            ) : null}
            <button
              type="button"
              onClick={() => setJsonOpen(true)}
              className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-border px-3 text-sm font-medium transition-colors hover:bg-muted"
            >
              <Code2 className="h-3.5 w-3.5" /> JSON
            </button>
            <EmbedButton slug={form.slug} />
            <button
              type="button"
              onClick={save}
              disabled={saving}
              className="inline-flex h-9 items-center rounded-lg bg-primary px-4 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-50"
            >
              {saving ? "Salvando…" : "Salvar"}
            </button>
          </div>
        </div>
        {error ? (
          <div className="border-t border-destructive/30 bg-destructive/5 px-6 py-2 text-xs text-destructive">
            {error}
          </div>
        ) : null}
      </header>

      <main className="mx-auto w-full max-w-4xl space-y-6 px-6 py-8">
        {/* Metadata */}
        <section className="rounded-2xl border border-border p-5">
          <h2 className="mb-4 text-sm font-semibold uppercase tracking-wider text-muted-foreground">
            Identidade
          </h2>
          <div className="grid gap-4 md:grid-cols-2">
            <Field label="Slug (URL)">
              <Input
                value={form.slug}
                onChange={(e) =>
                  patch({ slug: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, "-") })
                }
              />
            </Field>
            <Field label="Layout">
              <Select
                value={form.layout ?? "stepped"}
                onChange={(v) => patch({ layout: v as "stepped" | "single_page" })}
                options={[
                  { value: "stepped", label: "Stepped (Typeform-like)" },
                  { value: "single_page", label: "Single page (clássico)" },
                ]}
              />
            </Field>
            <Field label="Título" full>
              <Input
                value={form.title}
                onChange={(e) => patch({ title: e.target.value })}
              />
            </Field>
            <Field label="Descrição" full>
              <Textarea
                rows={2}
                value={form.description ?? ""}
                onChange={(e) => patch({ description: e.target.value || undefined })}
              />
            </Field>
            <Field label="Produto">
              <Select
                value={form.product}
                onChange={(v) =>
                  patch({ product: v as FormDefinition["product"] })
                }
                options={[
                  { value: "sprout", label: "Sprout" },
                  { value: "community", label: "Community" },
                  { value: "creator_pulse", label: "Creator Pulse" },
                  { value: "generico", label: "Genérico" },
                ]}
              />
            </Field>
            <Field label="Conversion Identifier (RD)">
              <Input
                value={form.conversionIdentifier}
                onChange={(e) => patch({ conversionIdentifier: e.target.value })}
              />
            </Field>
            <Field label="Tags (CSV)" full>
              <Input
                value={form.tags.join(", ")}
                onChange={(e) =>
                  patch({
                    tags: e.target.value
                      .split(",")
                      .map((t) => t.trim())
                      .filter(Boolean),
                  })
                }
              />
            </Field>
            <Field label="Mensagem de sucesso" full>
              <Input
                value={form.successMessage ?? ""}
                onChange={(e) =>
                  patch({ successMessage: e.target.value || undefined })
                }
              />
            </Field>
            <Field label="Redirect após sucesso (URL opcional)" full>
              <Input
                value={form.redirectOnSuccess ?? ""}
                onChange={(e) =>
                  patch({ redirectOnSuccess: e.target.value || undefined })
                }
              />
            </Field>
            <Field label="Webhook URL (sobrescreve N8N_WEBHOOK_URL pra esse form)" full>
              <Input
                placeholder="https://… (deixe vazio pra usar o webhook padrão do projeto)"
                value={form.webhookUrl ?? ""}
                onChange={(e) =>
                  patch({ webhookUrl: e.target.value || undefined })
                }
              />
            </Field>
            <Field label="Webhook Authorization header (opcional)" full>
              <Input
                placeholder="Ex.: Bearer abc123 (deixe vazio pra usar N8N_WEBHOOK_AUTH)"
                value={form.webhookAuth ?? ""}
                onChange={(e) =>
                  patch({ webhookAuth: e.target.value || undefined })
                }
              />
            </Field>
            <Field label="Aviso de LGPD / uso de dados (opcional)" full>
              <Textarea
                rows={3}
                placeholder="Ex.: Ao enviar, você concorda com nossa Política de Privacidade. Os dados serão usados apenas para contato comercial."
                value={form.lgpdNotice ?? ""}
                onChange={(e) =>
                  patch({ lgpdNotice: e.target.value || undefined })
                }
              />
            </Field>
          </div>
        </section>

        {/* Theme */}
        <section className="rounded-2xl border border-border p-5">
          <h2 className="mb-4 text-sm font-semibold uppercase tracking-wider text-muted-foreground">
            Visual (tema)
          </h2>
          <div className="grid gap-4 md:grid-cols-2">
            <ColorField
              label="Fundo (background)"
              value={form.theme?.background ?? ""}
              onChange={(v) => patchTheme({ background: v || undefined })}
            />
            <ColorField
              label="Texto (foreground)"
              value={form.theme?.foreground ?? ""}
              onChange={(v) => patchTheme({ foreground: v || undefined })}
            />
            <ColorField
              label="Botão primário"
              value={form.theme?.primary ?? ""}
              onChange={(v) => patchTheme({ primary: v || undefined })}
            />
            <ColorField
              label="Texto do botão"
              value={form.theme?.primaryForeground ?? ""}
              onChange={(v) => patchTheme({ primaryForeground: v || undefined })}
            />
            <ColorField
              label="Fundo do card"
              value={form.theme?.cardBackground ?? ""}
              onChange={(v) => patchTheme({ cardBackground: v || undefined })}
            />
            <ColorField
              label="Fundo dos inputs"
              value={form.theme?.inputBackground ?? ""}
              onChange={(v) => patchTheme({ inputBackground: v || undefined })}
            />
            <Field label="Borda dos inputs (CSS)">
              <Input
                placeholder="ex.: transparent ou #333"
                value={form.theme?.inputBorder ?? ""}
                onChange={(e) =>
                  patchTheme({ inputBorder: e.target.value || undefined })
                }
              />
            </Field>
            <Field label="Raio dos inputs (CSS)">
              <Input
                placeholder="ex.: 9999px ou 0.5rem"
                value={form.theme?.inputRadius ?? ""}
                onChange={(e) =>
                  patchTheme({ inputRadius: e.target.value || undefined })
                }
              />
            </Field>
            <Field label="Modo">
              <Select
                value={form.theme?.mode ?? "auto"}
                onChange={(v) =>
                  patchTheme({ mode: v as "light" | "dark" | "auto" })
                }
                options={[
                  { value: "auto", label: "Auto" },
                  { value: "light", label: "Light" },
                  { value: "dark", label: "Dark" },
                ]}
              />
            </Field>
            <Field label="Alinhamento do título">
              <Select
                value={form.theme?.titleAlign ?? "left"}
                onChange={(v) =>
                  patchTheme({ titleAlign: v as "left" | "center" })
                }
                options={[
                  { value: "left", label: "Esquerda" },
                  { value: "center", label: "Centro" },
                ]}
              />
            </Field>
            <CheckboxField
              label="Mostrar labels acima dos campos"
              checked={form.theme?.showLabels !== false}
              onChange={(v) => patchTheme({ showLabels: v })}
            />
            <CheckboxField
              label="Mostrar header com nome do form"
              checked={form.theme?.showFormChrome !== false}
              onChange={(v) => patchTheme({ showFormChrome: v })}
            />
          </div>
        </section>

        {/* Sizes (single_page layout) */}
        <section className="rounded-2xl border border-border p-5">
          <div className="mb-1 flex items-center justify-between">
            <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
              Dimensões e tipografia (single page)
            </h2>
            <button
              type="button"
              onClick={() =>
                patchTheme({
                  formWidth: undefined,
                  formMinHeight: undefined,
                  formPadding: undefined,
                  titleSize: undefined,
                  descriptionSize: undefined,
                  inputHeight: undefined,
                  inputTextSize: undefined,
                  fieldGap: undefined,
                  ctaGap: undefined,
                  ctaHeight: undefined,
                  ctaTextSize: undefined,
                  lgpdSize: undefined,
                })
              }
              className="text-xs text-muted-foreground underline-offset-2 hover:underline"
            >
              Resetar pros defaults
            </button>
          </div>
          <p className="mb-4 text-xs text-muted-foreground">
            Aceita qualquer unidade CSS (px, rem, em, %). Deixe vazio pra
            usar o default. Aplica-se ao layout <code>single_page</code>.
          </p>
          <div className="grid gap-4 md:grid-cols-2">
            <SizeField
              label="Largura do form"
              placeholder={SIZE_DEFAULTS.formWidth}
              value={form.theme?.formWidth}
              onChange={(v) => patchTheme({ formWidth: v })}
            />
            <SizeField
              label="Altura mínima do form"
              placeholder={SIZE_DEFAULTS.formMinHeight}
              value={form.theme?.formMinHeight}
              onChange={(v) => patchTheme({ formMinHeight: v })}
            />
            <SizeField
              label="Padding interno do form"
              placeholder={SIZE_DEFAULTS.formPadding}
              value={form.theme?.formPadding}
              onChange={(v) => patchTheme({ formPadding: v })}
            />
            <SizeField
              label="Tamanho do título"
              placeholder={SIZE_DEFAULTS.titleSize}
              value={form.theme?.titleSize}
              onChange={(v) => patchTheme({ titleSize: v })}
            />
            <SizeField
              label="Tamanho da descrição"
              placeholder={SIZE_DEFAULTS.descriptionSize}
              value={form.theme?.descriptionSize}
              onChange={(v) => patchTheme({ descriptionSize: v })}
            />
            <SizeField
              label="Altura dos campos / labels"
              placeholder={SIZE_DEFAULTS.inputHeight}
              value={form.theme?.inputHeight}
              onChange={(v) => patchTheme({ inputHeight: v })}
            />
            <SizeField
              label="Tamanho do texto dos campos"
              placeholder={SIZE_DEFAULTS.inputTextSize}
              value={form.theme?.inputTextSize}
              onChange={(v) => patchTheme({ inputTextSize: v })}
            />
            <SizeField
              label="Espaçamento entre campos"
              placeholder={SIZE_DEFAULTS.fieldGap}
              value={form.theme?.fieldGap}
              onChange={(v) => patchTheme({ fieldGap: v })}
            />
            <SizeField
              label="Espaçamento antes do CTA"
              placeholder={SIZE_DEFAULTS.ctaGap}
              value={form.theme?.ctaGap}
              onChange={(v) => patchTheme({ ctaGap: v })}
            />
            <SizeField
              label="Altura do botão CTA"
              placeholder={SIZE_DEFAULTS.ctaHeight}
              value={form.theme?.ctaHeight}
              onChange={(v) => patchTheme({ ctaHeight: v })}
            />
            <SizeField
              label="Tamanho do texto do CTA"
              placeholder={SIZE_DEFAULTS.ctaTextSize}
              value={form.theme?.ctaTextSize}
              onChange={(v) => patchTheme({ ctaTextSize: v })}
            />
            <SizeField
              label="Tamanho do aviso LGPD"
              placeholder={SIZE_DEFAULTS.lgpdSize}
              value={form.theme?.lgpdSize}
              onChange={(v) => patchTheme({ lgpdSize: v })}
            />
          </div>
        </section>

        {/* Steps */}
        <section className="rounded-2xl border border-border p-5">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
              Campos ({form.steps.length})
            </h2>
            <button
              type="button"
              onClick={addStep}
              className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-border px-3 text-sm font-medium transition-colors hover:bg-muted"
            >
              <Plus className="h-3.5 w-3.5" /> Adicionar campo
            </button>
          </div>

          <ul className="space-y-3">
            {form.steps.map((step, idx) => (
              <StepCard
                key={step.id + "-" + idx}
                step={step}
                index={idx}
                total={form.steps.length}
                onChange={(p) => patchStep(idx, p)}
                onMove={(d) => moveStep(idx, d)}
                onRemove={() => removeStep(idx)}
              />
            ))}
          </ul>
        </section>
      </main>

      {jsonOpen ? (
        <JsonModal
          value={JSON.stringify(form, null, 2)}
          onClose={() => setJsonOpen(false)}
          onApply={(json) => {
            try {
              const parsed = JSON.parse(json);
              const validated = FormSchema.safeParse(parsed);
              if (!validated.success) {
                setError("JSON inválido: " + validated.error.issues[0]?.message);
                return false;
              }
              setForm(validated.data);
              setJsonOpen(false);
              setError(null);
              return true;
            } catch (err) {
              setError(err instanceof Error ? err.message : "JSON malformado.");
              return false;
            }
          }}
        />
      ) : null}
    </div>
  );
}

function Field({
  label,
  children,
  full,
}: {
  label: string;
  children: React.ReactNode;
  full?: boolean;
}) {
  return (
    <label className={cn("block space-y-1.5", full && "md:col-span-2")}>
      <span className="text-xs font-medium text-muted-foreground">{label}</span>
      {children}
    </label>
  );
}

function SizeField({
  label,
  value,
  onChange,
  placeholder,
}: {
  label: string;
  value: string | undefined;
  onChange: (v: string | undefined) => void;
  placeholder: string;
}) {
  return (
    <label className="block space-y-1.5">
      <span className="text-xs font-medium text-muted-foreground">{label}</span>
      <Input
        value={value ?? ""}
        placeholder={`default: ${placeholder}`}
        onChange={(e) => onChange(e.target.value || undefined)}
      />
    </label>
  );
}

function ColorField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
}) {
  const valid = /^#([0-9a-f]{3,8})$/i.test(value);
  return (
    <label className="block space-y-1.5">
      <span className="text-xs font-medium text-muted-foreground">{label}</span>
      <div className="flex gap-2">
        <Input
          value={value}
          placeholder="#000000 ou rgba(…)"
          onChange={(e) => onChange(e.target.value)}
        />
        {valid ? (
          <span
            className="h-12 w-12 shrink-0 rounded-lg border border-border"
            style={{ background: value }}
            aria-hidden
          />
        ) : null}
      </div>
    </label>
  );
}

function CheckboxField({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <label className="flex items-center gap-2 text-sm">
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="h-4 w-4"
      />
      {label}
    </label>
  );
}

function Select({
  value,
  onChange,
  options,
}: {
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
}) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="flex h-12 w-full rounded-lg border border-border bg-transparent px-4 text-sm outline-none focus:border-foreground"
    >
      {options.map((o) => (
        <option key={o.value} value={o.value}>
          {o.label}
        </option>
      ))}
    </select>
  );
}

function StepCard({
  step,
  index,
  total,
  onChange,
  onMove,
  onRemove,
}: {
  step: Step;
  index: number;
  total: number;
  onChange: (p: Partial<Step>) => void;
  onMove: (dir: -1 | 1) => void;
  onRemove: () => void;
}) {
  const needsOptions = ["single_choice", "multi_choice", "dropdown"].includes(
    step.type,
  );

  return (
    <li className="rounded-xl border border-border bg-muted/20 p-4">
      <div className="mb-3 flex items-center gap-2">
        <span className="rounded-md border border-border bg-background px-2 py-0.5 font-mono text-[11px] text-muted-foreground">
          {index + 1}
        </span>
        <select
          value={step.type}
          onChange={(e) => onChange({ type: e.target.value as Step["type"] })}
          className="h-8 rounded-md border border-border bg-background px-2 text-xs"
        >
          {FIELD_TYPES.map((t) => (
            <option key={t} value={t}>
              {t}
            </option>
          ))}
        </select>
        <Input
          value={step.id}
          onChange={(e) => onChange({ id: e.target.value })}
          className="h-8 max-w-[160px] text-xs"
          placeholder="step id"
        />
        <div className="ml-auto flex items-center gap-1">
          <IconBtn onClick={() => onMove(-1)} disabled={index === 0} title="Mover pra cima">
            <ArrowUp className="h-3.5 w-3.5" />
          </IconBtn>
          <IconBtn
            onClick={() => onMove(1)}
            disabled={index === total - 1}
            title="Mover pra baixo"
          >
            <ArrowDown className="h-3.5 w-3.5" />
          </IconBtn>
          <IconBtn onClick={onRemove} title="Remover" disabled={total <= 1} destructive>
            <Trash2 className="h-3.5 w-3.5" />
          </IconBtn>
        </div>
      </div>

      <div className="grid gap-3 md:grid-cols-2">
        <Field label="Título / Pergunta" full>
          <Input
            value={step.title}
            onChange={(e) => onChange({ title: e.target.value })}
          />
        </Field>
        <Field label="Subtítulo (opcional)" full>
          <Input
            value={step.subtitle ?? ""}
            onChange={(e) =>
              onChange({ subtitle: e.target.value || undefined })
            }
          />
        </Field>
        <Field label="Placeholder">
          <Input
            value={step.placeholder ?? ""}
            onChange={(e) =>
              onChange({ placeholder: e.target.value || undefined })
            }
          />
        </Field>
        <Field label="mapTo (chave no payload n8n)">
          <Input
            value={step.mapTo ?? ""}
            placeholder={`(default: ${step.id})`}
            onChange={(e) =>
              onChange({ mapTo: e.target.value || undefined })
            }
          />
        </Field>
        <CheckboxField
          label="Campo obrigatório"
          checked={step.required ?? false}
          onChange={(v) => onChange({ required: v })}
        />
        {step.type === "email" ? (
          <CheckboxField
            label="Aceitar só e-mail corporativo"
            checked={step.validation?.corporateOnly ?? false}
            onChange={(v) =>
              onChange({
                validation: {
                  ...(step.validation ?? {}),
                  corporateOnly: v,
                },
              })
            }
          />
        ) : null}

        {needsOptions ? (
          <OptionsEditor
            options={step.options ?? []}
            onChange={(opts) => onChange({ options: opts })}
          />
        ) : null}
      </div>
    </li>
  );
}

function OptionsEditor({
  options,
  onChange,
}: {
  options: StepOption[];
  onChange: (opts: StepOption[]) => void;
}) {
  function update(i: number, p: Partial<StepOption>) {
    onChange(options.map((o, idx) => (idx === i ? { ...o, ...p } : o)));
  }
  function remove(i: number) {
    onChange(options.filter((_, idx) => idx !== i));
  }
  function add() {
    onChange([...options, { value: `opt_${options.length + 1}`, label: "Nova opção" }]);
  }

  return (
    <div className="md:col-span-2">
      <span className="text-xs font-medium text-muted-foreground">
        Opções ({options.length})
      </span>
      <ul className="mt-1.5 space-y-3">
        {options.map((opt, i) => (
          <li
            key={i}
            className="space-y-2 rounded-lg border border-border/60 bg-background/40 p-2"
          >
            <div className="flex items-center gap-2">
              <Input
                value={opt.value}
                onChange={(e) => update(i, { value: e.target.value })}
                placeholder="value"
                className="h-9 max-w-[150px] text-xs"
              />
              <Input
                value={opt.label}
                onChange={(e) => update(i, { label: e.target.value })}
                placeholder="Label visível"
                className="h-9 flex-1 text-sm"
              />
              <Input
                value={opt.emoji ?? ""}
                onChange={(e) =>
                  update(i, { emoji: e.target.value || undefined })
                }
                placeholder="🚀"
                className="h-9 w-14 text-center text-xs"
              />
              <IconBtn onClick={() => remove(i)} title="Remover" destructive>
                <Trash2 className="h-3.5 w-3.5" />
              </IconBtn>
            </div>
            <DisqualifierEditor
              value={opt.disqualify}
              onChange={(d) => update(i, { disqualify: d })}
            />
          </li>
        ))}
      </ul>
      <button
        type="button"
        onClick={add}
        className="mt-2 inline-flex h-8 items-center gap-1.5 rounded-md border border-dashed border-border px-3 text-xs text-muted-foreground hover:bg-muted"
      >
        <Plus className="h-3 w-3" /> Adicionar opção
      </button>
    </div>
  );
}

function DisqualifierEditor({
  value,
  onChange,
}: {
  value: StepOption["disqualify"];
  onChange: (v: StepOption["disqualify"]) => void;
}) {
  const enabled = Boolean(value);

  function toggle(on: boolean) {
    if (on) {
      onChange({
        title: value?.title ?? "Não foi dessa vez",
        message:
          value?.message ??
          "Esse formulário não é pra esse perfil. Mas a gente tem outros caminhos pra você.",
        ctaLabel: value?.ctaLabel ?? "",
        ctaUrl: value?.ctaUrl ?? "",
      });
    } else {
      onChange(undefined);
    }
  }

  function patch(p: Partial<NonNullable<StepOption["disqualify"]>>) {
    if (!value) return;
    onChange({ ...value, ...p });
  }

  return (
    <div className="rounded-md border border-dashed border-border bg-muted/20 px-3 py-2">
      <label className="flex cursor-pointer items-center gap-2 text-xs">
        <input
          type="checkbox"
          checked={enabled}
          onChange={(e) => toggle(e.target.checked)}
          className="h-3.5 w-3.5"
        />
        <span className="font-medium">Bloquear quando essa opção for selecionada</span>
        <span className="text-muted-foreground">
          (popup impede de avançar)
        </span>
      </label>
      {enabled ? (
        <div className="mt-3 grid gap-2">
          <Input
            placeholder="Título do popup (ex.: Não foi dessa vez)"
            value={value?.title ?? ""}
            onChange={(e) => patch({ title: e.target.value || undefined })}
            className="h-9 text-sm"
          />
          <Textarea
            placeholder="Mensagem que o usuário vai ver no popup"
            rows={3}
            value={value?.message ?? ""}
            onChange={(e) => patch({ message: e.target.value })}
            className="text-sm"
          />
          <div className="grid gap-2 md:grid-cols-2">
            <Input
              placeholder="Texto do botão CTA (opcional)"
              value={value?.ctaLabel ?? ""}
              onChange={(e) =>
                patch({ ctaLabel: e.target.value || undefined })
              }
              className="h-9 text-xs"
            />
            <Input
              placeholder="Link do CTA (https://… opcional)"
              value={value?.ctaUrl ?? ""}
              onChange={(e) => patch({ ctaUrl: e.target.value || undefined })}
              className="h-9 text-xs"
            />
          </div>
        </div>
      ) : null}
    </div>
  );
}

function IconBtn({
  children,
  onClick,
  disabled,
  title,
  destructive,
}: {
  children: React.ReactNode;
  onClick: () => void;
  disabled?: boolean;
  title?: string;
  destructive?: boolean;
}) {
  return (
    <button
      type="button"
      title={title}
      onClick={onClick}
      disabled={disabled}
      className={cn(
        "inline-flex h-8 w-8 items-center justify-center rounded-md border border-border bg-background transition-colors disabled:cursor-not-allowed disabled:opacity-30",
        destructive
          ? "hover:border-destructive/40 hover:bg-destructive/10 hover:text-destructive"
          : "hover:bg-muted",
      )}
    >
      {children}
    </button>
  );
}

function JsonModal({
  value,
  onClose,
  onApply,
}: {
  value: string;
  onClose: () => void;
  onApply: (json: string) => boolean;
}) {
  const [text, setText] = useState(value);
  return (
    <ModalShell onClose={onClose} title="Editar JSON bruto" wide>
      <Textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        rows={22}
        className="font-mono text-xs"
        spellCheck={false}
      />
      <div className="flex justify-end gap-2">
        <button
          type="button"
          onClick={onClose}
          className="rounded-lg border border-border px-3 py-1.5 text-sm hover:bg-muted"
        >
          Cancelar
        </button>
        <button
          type="button"
          onClick={() => onApply(text)}
          className="rounded-lg bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground hover:opacity-90"
        >
          Aplicar
        </button>
      </div>
    </ModalShell>
  );
}

function ModalShell({
  title,
  children,
  onClose,
  wide,
}: {
  title: string;
  children: React.ReactNode;
  onClose: () => void;
  wide?: boolean;
}) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
      onClick={onClose}
    >
      <div
        className={cn(
          "max-h-[90vh] w-full overflow-y-auto rounded-2xl border border-border bg-background p-6 shadow-2xl",
          wide ? "max-w-3xl" : "max-w-xl",
        )}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-start justify-between gap-4">
          <h3 className="text-lg font-semibold tracking-tight">{title}</h3>
          <button
            type="button"
            onClick={onClose}
            aria-label="Fechar"
            className="rounded-md p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="space-y-4">{children}</div>
      </div>
    </div>
  );
}

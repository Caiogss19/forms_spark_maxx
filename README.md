# Spark Forms

Sistema de formulários multi-step, white-label, embedável. Substitui Typeform
pra captura de leads no site da Spark (Framer). 100% editável via JSON, captura
UTMs + click IDs + cookies de tracker, valida e-mail corporativo e envia pro
n8n com retry exponencial.

```
forms.spark.com.br/f/sprout-qualifier    ← standalone público
forms.spark.com.br/embed/sprout-qualifier ← versão pra iframe
```

## Quickstart

```bash
pnpm install
cp .env.example .env.local   # opcional pra dev local
pnpm dev                     # http://localhost:3000
```

Abre o demo em `/f/demo-spark` ou `/embed-demo.html`.

## Stack

| Camada | Tech |
|---|---|
| Framework | Next.js 16 (App Router) · React 19 · TypeScript estrito |
| Style | Tailwind v4 + Inter |
| Estado | Zustand (per-tab, persistência localStorage por slug) |
| Animação | Framer Motion |
| Validação | Zod 4 + react-hook-form |
| Anti-spam | Honeypot + Cloudflare Turnstile (opt-in) |
| Storage opcional | Supabase (fallback se webhook falhar) · Vercel Blob (uploads) |
| Webhook target | n8n (RD Station unificado) |

## Adicionar um form novo

1. Crie `forms/<slug>.json` seguindo `lib/schema.ts`:

   ```json
   {
     "slug": "sprout-qualifier",
     "title": "Spark Sprout — Qualificação",
     "product": "sprout",
     "conversionIdentifier": "One Page - Forms - Sprout",
     "tags": ["forms", "sprout", "lead"],
     "estimatedMinutes": 2,
     "steps": [
       { "id": "name", "type": "short_text", "title": "Seu nome?", "required": true, "mapTo": "name" },
       { "id": "email", "type": "email", "title": "E-mail corporativo?", "required": true,
         "validation": { "corporateOnly": true }, "mapTo": "email" },
       { "id": "thanks", "type": "thank_you", "title": "Recebido!" }
     ]
   }
   ```

2. `pnpm validate:forms` — falha o build se o JSON quebrar o schema.
3. Acesse `/f/sprout-qualifier` (público) ou `/embed/sprout-qualifier` (iframe).

### Tipos de campo (17)

`short_text` · `long_text` · `email` · `phone` · `single_choice` ·
`multi_choice` · `dropdown` · `rating` · `scale` · `date` · `number` ·
`currency` · `url` · `file` · `consent` · `statement` · `thank_you`

Veja `forms/demo-spark.json` pra exemplos de cada um.

### Branching condicional

Cada step aceita `logic[]`. A primeira regra que casa vence; senão cai no próximo step linear.

```json
{
  "id": "role",
  "type": "single_choice",
  "options": [...],
  "logic": [
    { "if": { "field": "cargo", "op": "eq", "value": "social_media" }, "goto": "channels" }
  ]
}
```

Operadores: `eq`, `neq`, `in`, `contains`, `gt`, `lt`. A regra lê de
`answers[step.mapTo ?? step.id]`.

### Variáveis no texto

`title` e `subtitle` interpolam `{{key}}` contra as respostas:

```json
{ "id": "email", "title": "E qual seu e-mail, {{name}}?" }
```

### Hidden fields

Campos preenchidos via querystring:

```json
{
  "hiddenFields": [
    { "key": "plano", "default": "self_serve" }
  ]
}
```

`/f/sprout?plano=enterprise` → `payload.plano = "enterprise"`.

## Embedar no Framer

### Snippet (recomendado)

Em **Custom Code → Embed** cole:

```html
<div data-spark-form="sprout-qualifier" data-spark-min-height="640px"></div>
<script async src="https://forms.spark.com.br/embed.js"></script>
```

O script:
- Cria o iframe apontando pra `/embed/<slug>`.
- Encaminha UTMs da página pai pro iframe (querystring + postMessage).
- Encaminha cookies `_ga`, `_fbp`, `rdtrk` da página pai.
- Auto-resize via `ResizeObserver` no iframe + `postMessage` no parent.
- Dispara `spark:submission` no `window` e empurra `dataLayer.push({ event: "spark_form_submitted", ... })` quando o lead converte.

### Iframe direto

```html
<iframe
  src="https://forms.spark.com.br/embed/sprout-qualifier?utm_source=site&transparent=1"
  style="width:100%;height:640px;border:0;"
  loading="lazy"
  title="Spark Sprout">
</iframe>
```

## Pipeline de submit

```
POST /api/submit
  → rate limit por IP (60s sliding, RATE_LIMIT_PER_MIN)
  → Zod body
  → honeypot (silent 200 se preenchido)
  → Turnstile (opt-in: TURNSTILE_SECRET_KEY)
  → form load por slug
  → e-mail corporativo re-checado server-side
  → buildN8nPayload()  (produto, conversion_identifier, tags, tracking, hidden, answers, _meta)
  → POST webhook (timeout 8s, retry 1s/3s/9s, 4xx terminal)
  → on exhaustão: saveFailedSubmission() no Supabase (best-effort)
  → ok:true sempre que o lead foi capturado — webhook:"ok" ou "queued"
```

`webhook:"queued"` significa que o lead está no Supabase aguardando re-envio.
Implemente um cron diário fora desse repo pra drenar `form_submissions WHERE webhook_status='failed'`.

### Contrato do payload n8n

Compatível com o nó `Processar dados da LP`:

```jsonc
{
  "produto": "sprout",
  "conversion_identifier": "One Page - Forms - Sprout",
  "tags": ["forms","sprout","lead"],
  // tracking (utm_*, gclid, fbp, ga_client_id, referrer, device, ...)
  // hidden fields (?qs)
  // answers (chaves de step.mapTo ou step.id)
  "_source": "spark-forms",
  "_form_slug": "sprout-qualifier",
  "_submission_id": "uuid",
  "_timestamp": "ISO"
}
```

## Variáveis de ambiente

Veja `.env.example`. Resumo:

| Var | Obrigatório | O que faz |
|---|---|---|
| `N8N_WEBHOOK_URL` | sim em prod | Default do webhook (cada form pode sobrescrever no JSON) |
| `N8N_WEBHOOK_AUTH` | sim em prod | Authorization header pro n8n |
| `RATE_LIMIT_PER_MIN` | não (10) | Submissões por IP/min |
| `BLOCKED_EMAIL_DOMAINS` | não | CSV override da blocklist default (gmail/hotmail/etc) |
| `EMAIL_VALIDATION_MX` | não (off) | Liga MX lookup no `/api/validate-email` |
| `SUPABASE_URL` + `SUPABASE_SERVICE_KEY` | opcional | Fallback de leads perdidos |
| `TURNSTILE_SECRET_KEY` + `NEXT_PUBLIC_TURNSTILE_SITE_KEY` | opcional | Anti-spam invisível |
| `BLOB_READ_WRITE_TOKEN` | opcional | Habilita Vercel Blob no `/api/upload`; sem ele cai em base64 (1MB) |

## Schema do Supabase (opcional)

```sql
create table forms (
  slug text primary key,
  schema jsonb not null,
  active boolean default true,
  created_at timestamptz default now()
);

create table form_submissions (
  id uuid primary key default gen_random_uuid(),
  form_slug text references forms(slug),
  payload jsonb not null,
  webhook_status text,
  webhook_attempts int default 0,
  webhook_last_error text,
  ip text,
  created_at timestamptz default now()
);

create index on form_submissions(form_slug, created_at desc);
create index on form_submissions(webhook_status) where webhook_status <> 'ok';
```

A app só usa `form_submissions` (e só pra fallback). Tabela `forms` está
reservada caso queira mudar pra schema gerenciado por painel no futuro.

## Deploy (Vercel)

```bash
vercel link
vercel env add N8N_WEBHOOK_URL production
vercel env add N8N_WEBHOOK_AUTH production
# opcionais
vercel env add SUPABASE_URL production
vercel env add SUPABASE_SERVICE_KEY production
vercel env add TURNSTILE_SECRET_KEY production
vercel env add BLOB_READ_WRITE_TOKEN production
vercel --prod
```

Depois aponte o domínio `forms.spark.com.br` para a project URL.

O `prebuild` valida todos os JSONs em `/forms` antes do `next build`, então
um schema quebrado falha o deploy fast.

## Scripts úteis

```bash
pnpm dev              # next dev
pnpm build            # next build (com prebuild = validate:forms)
pnpm typecheck        # tsc --noEmit
pnpm lint             # eslint
pnpm validate:forms   # valida JSONs em /forms
pnpm test:e2e         # Playwright (smoke + branching + retry)
node scripts/mock-webhook.mjs   # mock n8n local (porta 4567) p/ testes
```

## Critérios de aceitação (status)

- [x] Form novo só com JSON em `/forms` — zero código
- [x] Standalone em `/f/[slug]` e embedado via iframe + script
- [x] UTMs do parent chegam no payload mesmo com iframe
- [x] `joao@gmail.com` bloqueado com mensagem clara quando `corporateOnly=true`
- [x] `joao@empresa.com.br` passa
- [x] Falha de rede no webhook: lead não perde (Supabase fallback)
- [x] Branching: `"social_media"` pula pra step específico
- [x] Mobile: campos com teclado correto, scroll por step
- [x] Bundle do `/embed/[slug]` < 120KB JS gzip

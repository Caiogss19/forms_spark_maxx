# Spark Forms

Multi-step, white-label, embeddable forms — replaces Typeform for Spark lead capture.

> **Status**: 🚧 In construction (block-by-block per `PROMPT.md`).

## Stack

- Next.js 16 (App Router) + TypeScript
- Tailwind CSS v4 + shadcn-style primitives
- Zustand (runtime state) · Zod + react-hook-form (validation) · Framer Motion (animation)
- Supabase (optional backup) · Cloudflare Turnstile (optional anti-spam)

## Quick start

```bash
pnpm install
cp .env.example .env.local
pnpm dev
```

Open <http://localhost:3000>.

## Layout

```
app/
  f/[slug]/         # Public standalone form
  embed/[slug]/     # iframe-friendly variant (no chrome)
  api/submit/       # Server route → validates → forwards to n8n
components/
  form-runner/      # FormRunner, StepRenderer, fields/*
  ui/               # shadcn-style primitives
lib/
  schema.ts         # Zod FormSchema (single source of truth)
  tracking.ts       # UTMs, referrer, fingerprint
  corporate-email.ts
  branching.ts      # logic engine
  webhook.ts        # n8n client + retry
  store.ts          # Zustand
forms/              # JSON schemas — one file per form
public/embed.js     # Snippet for parent pages (Framer)
```

## Adding a new form

1. Drop a JSON file in `forms/` (e.g. `forms/my-form.json`) matching `FormSchema` in `lib/schema.ts`.
2. Open `/f/my-form` (public) or embed `/embed/my-form` in Framer.
3. No code change required.

See `forms/demo-spark.json` for the canonical example (built in block 2).

## Implementation plan

Tracked in `PROMPT.md` (canonical brief). Blocks delivered:

- [x] **1. Bootstrap** — Next.js + Tailwind v4 + Inter + shadcn primitives + env.
- [ ] **2. Schema + types** — Zod `FormSchema` and demo JSON.
- [ ] **3. FormRunner** + first three fields (ShortText, Email, SingleChoice).
- [ ] **4. Tracking** — UTMs + Zustand store.
- [ ] **5. Corporate email** — blocklist + MX endpoint.
- [ ] **6. /api/submit** — Zod, Turnstile, rate limit, retry, Supabase fallback.
- [ ] **7. Remaining fields** — all 17 types.
- [ ] **8. Branching engine.**
- [ ] **9. /embed/[slug] + public/embed.js** — postMessage bridge.
- [ ] **10. README expanded** — Framer guide, webhook config.
- [ ] **11. Deploy on Vercel.**
- [ ] **12. Playwright e2e.**

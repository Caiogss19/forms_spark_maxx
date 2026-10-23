"use client";

import { motion } from "framer-motion";
import { ArrowUp, CalendarDays, ExternalLink, RotateCcw } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { messageFor } from "@/components/form-runner/fields/Email";
import { resolveNextStep } from "@/lib/branching";
import { validateEmail } from "@/lib/corporate-email";
import { interpolate } from "@/lib/interpolate";
import { formatPhoneBR } from "@/lib/mask";
import { buildSchedulingUrl, calendlyEvent, notifyBooking, scheduledInvitee } from "@/lib/scheduling";
import { resolveTheme, type FormDefinition, type Step } from "@/lib/schema";
import { STORAGE_KEYS, safeRemoveLocal } from "@/lib/storage";
import { useFormStore, type AnswerValue } from "@/lib/store";
import { useFormSubmit } from "@/lib/use-form-submit";
import { useTrackingCapture } from "@/lib/use-tracking-capture";
import { validateEmailRemote } from "@/lib/validate-email-client";

interface Props {
  form: FormDefinition;
  embedded?: boolean;
}

interface Message {
  id: number;
  from: "bot" | "user";
  text: string;
}

type Phase = "talking" | "awaiting" | "submitting" | "submit_error" | "done";

const TEXT_TYPES = new Set(["short_text", "long_text", "email", "phone", "number", "url"]);
const CHOICE_TYPES = new Set(["dropdown", "single_choice"]);

function isInputStep(step: Step) {
  return step.type !== "statement" && step.type !== "thank_you";
}

function sleep(ms: number) {
  return new Promise<void>((r) => setTimeout(r, ms));
}

// Long enough to read as typing, short enough not to stall the lead.
function typingDelay(text: string) {
  return Math.min(1100, 380 + text.length * 12);
}

/**
 * Conversational layout: the bot asks one step at a time, the lead
 * answers by typing or tapping an option. Answers land in the same store
 * and go through the same /api/submit as the other runners, so the
 * webhook payload is identical to the form's.
 *
 * The lead is submitted right after `chat.submitAfter`; steps after it
 * only feed the scheduling prefill. The conversation ends with the
 * booking link (chat.scheduling) or the success message.
 */
export function ChatRunner({ form, embedded = false }: Props) {
  const setForm = useFormStore((s) => s.setForm);
  const setAnswer = useFormStore((s) => s.setAnswer);
  const clearPersistedAnswers = useFormStore((s) => s.clearPersistedAnswers);

  const [messages, setMessages] = useState<Message[]>([]);
  const [typing, setTyping] = useState(false);
  const [phase, setPhase] = useState<Phase>("talking");
  const [stepId, setStepId] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const [schedulingUrl, setSchedulingUrl] = useState<string | null>(null);
  const [bookingUrl, setBookingUrl] = useState<string | null>(null);
  const [panelHeight, setPanelHeight] = useState(0);
  // Messages from this index on render below the booking panel.
  const [panelAt, setPanelAt] = useState<number | null>(null);
  const [booked, setBooked] = useState(false);
  const [answered, setAnswered] = useState(0);
  const [remaining, setRemaining] = useState<number | null>(null);

  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement | HTMLTextAreaElement | null>(null);
  const honeypotRef = useRef<HTMLInputElement | null>(null);
  const nextId = useRef(0);
  const alive = useRef(true);
  const started = useRef(false);
  const submitted = useRef(false);
  const interacted = useRef(false);
  const pendingNext = useRef<string | null>(null);

  const chat = form.chat;
  const step = stepId ? (form.steps.find((s) => s.id === stepId) ?? null) : null;

  const submitAfterId = useMemo(() => {
    if (chat?.submitAfter) return chat.submitAfter;
    const inputs = form.steps.filter(isInputStep);
    return inputs[inputs.length - 1]?.id ?? null;
  }, [chat?.submitAfter, form.steps]);

  // A chat transcript can't be resumed half-way, so start clean.
  useEffect(() => {
    safeRemoveLocal(STORAGE_KEYS.answers(form.slug));
    setForm(form);
  }, [form, setForm]);

  useTrackingCapture(form);

  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);

  // Fixed-height surface with its own scroll: tell embed.js once instead
  // of growing the iframe with every message.
  useEffect(() => {
    if (!embedded || typeof window === "undefined") return;
    const px = parseInt(form.theme?.formMinHeight ?? "", 10);
    window.parent?.postMessage(
      { type: "spark-forms:resize", height: Number.isFinite(px) ? px : 620, slug: form.slug },
      "*",
    );
  }, [embedded, form.slug, form.theme?.formMinHeight]);

  // Scroll the transcript itself — scrollIntoView would also scroll the
  // host page when embedded.
  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTo({ top: el.scrollHeight, behavior: "smooth" });
  }, [messages, typing, phase, panelHeight]);

  const push = useCallback((from: Message["from"], text: string) => {
    setMessages((prev) => [...prev, { id: nextId.current++, from, text }]);
  }, []);

  const botSay = useCallback(
    async (lines: string[]) => {
      const answers = useFormStore.getState().answers;
      for (const raw of lines) {
        const text = interpolate(raw, answers).trim();
        if (!text) continue;
        setTyping(true);
        await sleep(typingDelay(text));
        if (!alive.current) return;
        setTyping(false);
        push("bot", text);
      }
    },
    [push],
  );

  const { submit } = useFormSubmit({
    form,
    honeypotRef,
    onSuccess: (submissionId) => {
      clearPersistedAnswers();
      window.parent?.postMessage(
        { type: "spark-forms:submitted", submissionId, slug: form.slug },
        "*",
      );
    },
  });

  const applyPageUrlFallback = useCallback(() => {
    const fallback = chat?.pageUrlFallback;
    if (!fallback) return;
    const { tracking, setTracking } = useFormStore.getState();
    const current = tracking.page_url ?? "";
    if (current.toLowerCase().includes(form.product)) return;
    const url = new URL(fallback);
    try {
      new URL(current).searchParams.forEach((v, k) => {
        if (!url.searchParams.has(k)) url.searchParams.set(k, v);
      });
    } catch {
      /* no usable host URL — fallback as is */
    }
    setTracking({ page_url: url.toString() });
  }, [chat?.pageUrlFallback, form.product]);

  // Input steps from `id` to the end, following the branching rules with
  // the answers so far — a rule that skips steps shortens the count.
  const remainingFrom = useCallback(
    (id: string | null) => {
      const answers = useFormStore.getState().answers;
      const seen = new Set<string>();
      let count = 0;
      let cur = id;
      while (cur && !seen.has(cur)) {
        seen.add(cur);
        const s = form.steps.find((x) => x.id === cur);
        if (!s || s.type === "thank_you") break;
        if (isInputStep(s)) count++;
        cur = resolveNextStep({ currentStepId: cur, steps: form.steps, answers });
      }
      return count;
    },
    [form.steps],
  );

  const finish = useCallback(async () => {
    setRemaining(0);
    setStepId(null);
    setPhase("talking");
    if (chat?.scheduling) {
      const { answers, tracking } = useFormStore.getState();
      setSchedulingUrl(buildSchedulingUrl(chat.scheduling, answers, tracking));
      if (chat.scheduling.display === "inline") {
        setBookingUrl(
          buildSchedulingUrl(chat.scheduling, answers, tracking, window.location.host),
        );
      }
      await botSay([chat.scheduling.message]);
    } else {
      const thanks = form.steps.find((s) => s.type === "thank_you");
      await botSay([
        form.successMessage ?? thanks?.title ?? "Recebido! A gente te chama em breve.",
      ]);
    }
    if (alive.current) setPhase("done");
  }, [botSay, chat?.scheduling, form.steps, form.successMessage]);

  // The booking panel fills the visible transcript so the calendar shows
  // whole without scrolling; the conversation stays above it.
  useEffect(() => {
    if (phase !== "done" || !bookingUrl) return;
    const el = scrollRef.current;
    if (el) setPanelHeight(Math.max(460, el.clientHeight - 40));
    setPanelAt((at) => at ?? messages.length);
  }, [phase, bookingUrl, messages.length]);

  // Calendly reports the booking via postMessage: confirm it in the chat
  // and tell the host page (embed.js forwards it to dataLayer).
  useEffect(() => {
    if (!bookingUrl) return;
    function onMessage(e: MessageEvent) {
      if (calendlyEvent(e) !== "calendly.event_scheduled") return;
      setBooked(true);
      const invitee = scheduledInvitee(e);
      const notifyUrl = chat?.scheduling?.notifyUrl;
      if (notifyUrl && invitee) notifyBooking(notifyUrl, invitee);
      window.parent?.postMessage({ type: "spark-forms:scheduled", slug: form.slug }, "*");
      const confirmation = chat?.scheduling?.confirmation;
      if (confirmation) void botSay([confirmation]);
    }
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, [bookingUrl, botSay, chat?.scheduling?.confirmation, chat?.scheduling?.notifyUrl, form.slug]);

  const ask = useCallback(
    async (id: string | null): Promise<void> => {
      const next = id ? form.steps.find((s) => s.id === id) : null;
      if (!next || next.type === "thank_you") {
        if (!submitted.current && form.steps.some(isInputStep)) {
          // Branching skipped submitAfter — never end without the lead.
          pendingNext.current = null;
          if (!(await sendLead())) return;
        }
        return finish();
      }
      setPhase("talking");
      await botSay([next.title, next.subtitle ?? ""]);
      if (!alive.current) return;
      if (next.type === "statement") {
        return ask(
          resolveNextStep({
            currentStepId: next.id,
            steps: form.steps,
            answers: useFormStore.getState().answers,
          }),
        );
      }
      setDraft("");
      setRemaining(remainingFrom(next.id));
      setStepId(next.id);
      setPhase("awaiting");
    },
    // sendLead is declared below and only reads refs/stable callbacks.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [botSay, finish, form.steps, remainingFrom],
  );

  async function sendLead(): Promise<boolean> {
    setPhase("submitting");
    applyPageUrlFallback();
    const res = await submit();
    if (!alive.current) return false;
    if (!res.ok) {
      await botSay([
        "Ops, não consegui registrar suas respostas agora. Tenta de novo?",
      ]);
      setPhase("submit_error");
      return false;
    }
    submitted.current = true;
    return true;
  }

  async function retrySubmit() {
    if (await sendLead()) void ask(pendingNext.current);
  }

  useEffect(() => {
    if (started.current) return;
    started.current = true;
    void (async () => {
      await botSay(chat?.greeting ?? []);
      await ask(form.steps[0]?.id ?? null);
    })();
  }, [ask, botSay, chat?.greeting, form.steps]);

  // Focus only after the lead has interacted: focusing on load would
  // scroll the host page down to the iframe.
  useEffect(() => {
    if (phase === "awaiting" && interacted.current) inputRef.current?.focus();
  }, [phase, stepId]);

  async function answer(value: AnswerValue, display: string) {
    if (!step || phase !== "awaiting") return;
    interacted.current = true;
    const current = step;
    setStepId(null);
    setPhase("talking");
    push("user", display);
    setAnswered((n) => n + 1);
    setRemaining((r) => (r == null ? r : Math.max(0, r - 1)));
    setAnswer(current.mapTo ?? current.id, value);
    setDraft("");

    const next = resolveNextStep({
      currentStepId: current.id,
      steps: form.steps,
      answers: useFormStore.getState().answers,
    });

    if (current.id === submitAfterId && !submitted.current) {
      pendingNext.current = next;
      if (!(await sendLead())) return;
    }
    await ask(next);
  }

  async function onSendText() {
    if (!step) return;
    const raw = draft.trim();
    if (!raw && !step.required) return answer(null, step.skipLabel ?? "Pular");
    const error = await validateText(step, raw);
    if (error) {
      push("user", raw || "…");
      setStepId(null);
      setPhase("talking");
      await botSay([error]);
      setStepId(step.id);
      setPhase("awaiting");
      return;
    }
    const value = step.type === "email" ? raw.toLowerCase() : raw;
    await answer(value, value);
  }

  const theme = useMemo(() => {
    const t = resolveTheme(form.theme);
    const o = form.theme ?? {};
    return {
      // The page around the chat may go transparent (host shows through),
      // but the chat itself always sits on a solid surface: on a dark host
      // or a dark-mode browser the text color would otherwise vanish.
      "--chat-bg": o.transparentBackground ? "transparent" : t.background,
      "--chat-surface": t.background,
      "--chat-fg": t.foreground,
      "--chat-muted": o.mutedForeground ?? "var(--muted-foreground)",
      "--chat-accent": t.primary,
      "--chat-accent-fg": o.primaryForeground ?? "#FFFFFF",
      "--chat-bot-bg": o.cardBackground ?? "var(--muted)",
      "--chat-user-bg": t.foreground,
      "--chat-user-fg": t.background,
      // The booking button is the conversion: its own color (brand CTA).
      "--chat-cta": o.ctaBackground ?? t.primary,
      "--chat-cta-fg": o.ctaForeground ?? o.primaryForeground ?? "#FFFFFF",
      "--chat-input-bg": o.inputBackground ?? t.background,
      "--chat-input-border": o.inputBorder ?? "var(--border)",
      "--chat-border": o.cardBorderColor ?? "var(--border)",
      "--chat-radius": o.cardBorderRadius ?? "1.25rem",
      // Native controls and autofill follow the theme, not the OS.
      colorScheme: t.mode === "auto" ? "light dark" : t.mode,
      fontFamily: o.fontFamily ? `${o.fontFamily}, system-ui, sans-serif` : undefined,
    } as React.CSSProperties;
  }, [form.theme]);

  const options = step && CHOICE_TYPES.has(step.type) ? (step.options ?? []) : [];

  const renderMessage = (m: Message) => (
    <motion.div
      key={m.id}
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.32, ease: [0.22, 1, 0.36, 1] }}
      className={
        m.from === "bot"
          ? "max-w-[85%] self-start whitespace-pre-line rounded-[18px] rounded-bl-[7px] bg-[var(--chat-bot-bg)] px-4 py-2.5 text-[15px] leading-normal"
          : "max-w-[85%] self-end whitespace-pre-line break-words rounded-[18px] rounded-br-[7px] bg-[var(--chat-user-bg)] px-4 py-2.5 text-[15px] leading-normal text-[var(--chat-user-fg)]"
      }
    >
      {m.text}
    </motion.div>
  );

  const typingBubble = (
    <div
      aria-label="digitando"
      className="flex gap-1 self-start rounded-[18px] rounded-bl-[7px] bg-[var(--chat-bot-bg)] px-4 py-3.5"
    >
      {[0, 1, 2].map((i) => (
        <motion.span
          key={i}
          className="h-1.5 w-1.5 rounded-full bg-[var(--chat-accent)]"
          animate={{ opacity: [0.25, 0.9, 0.25] }}
          transition={{ duration: 1, repeat: Infinity, delay: i * 0.15 }}
        />
      ))}
    </div>
  );

  return (
    <div
      style={theme}
      className={
        embedded
          ? "flex h-[100dvh] w-full bg-[var(--chat-bg)] text-[var(--chat-fg)] antialiased"
          : "flex min-h-[100dvh] w-full items-center justify-center bg-[var(--chat-bg)] p-4 text-[var(--chat-fg)] antialiased"
      }
    >
      <input
        ref={honeypotRef}
        type="text"
        name="company_website_url"
        tabIndex={-1}
        autoComplete="off"
        aria-hidden="true"
        style={{ position: "absolute", left: "-9999px", width: 1, height: 1, opacity: 0 }}
      />

      <section
        aria-label={chat?.botName ?? form.title}
        className={
          embedded
            ? "flex h-full w-full flex-col overflow-hidden"
            : "flex h-[min(720px,calc(100dvh-2rem))] w-full max-w-md flex-col overflow-hidden border border-[var(--chat-border)]"
        }
        style={{
          background: "var(--chat-surface)",
          borderRadius: embedded ? undefined : "var(--chat-radius)",
        }}
      >
        <header className="flex items-center gap-3 border-b border-[var(--chat-border)] px-5 py-4">
          {chat?.avatarUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={chat.avatarUrl} alt="" className="h-10 w-10 shrink-0 rounded-full object-cover" />
          ) : (
            <span
              aria-hidden
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[var(--chat-accent)] text-[15px] text-[var(--chat-accent-fg)]"
            >
              {(chat?.botName ?? "S").charAt(0)}
            </span>
          )}
          <div className="min-w-0">
            <p className="truncate text-[15px] uppercase leading-tight tracking-[0.03em]">
              {chat?.botName ?? form.title}
            </p>
            <p className="mt-1 truncate text-[12px] uppercase leading-none tracking-[0.16em] text-[var(--chat-muted)]">
              <span aria-hidden className="mr-[0.35em]">✳</span>
              {typing ? "digitando…" : (chat?.botSubtitle ?? "online")}
            </p>
          </div>
        </header>

        {chat?.progress !== false ? (
          <ProgressBar
            answered={answered}
            remaining={remaining ?? remainingFrom(form.steps[0]?.id ?? null)}
            started={remaining != null}
            booked={booked}
            color={chat?.progressColor}
            track={chat?.progressTrack}
          />
        ) : null}

        <div
          ref={scrollRef}
          role="log"
          aria-live="polite"
          className="spark-no-scrollbar flex flex-1 flex-col gap-2 overflow-y-auto px-5 py-5"
        >
          {(panelAt == null ? messages : messages.slice(0, panelAt)).map(renderMessage)}

          {typing && panelAt == null ? typingBubble : null}

          {phase === "awaiting" && options.length > 0 ? (
            <div className="mt-1 flex flex-col items-end gap-2">
              {options.map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => void answer(opt.value, opt.label)}
                  className="max-w-[85%] rounded-[18px] border border-[var(--chat-accent)] px-4 py-2.5 text-left text-[15px] leading-snug text-[var(--chat-accent)] transition-colors duration-150 hover:bg-[var(--chat-accent)] hover:text-[var(--chat-accent-fg)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--chat-accent)]"
                >
                  {opt.emoji ? `${opt.emoji} ` : ""}
                  {opt.label}
                </button>
              ))}
              {!step?.required ? (
                <SkipButton label={step?.skipLabel} onClick={() => void answer(null, step?.skipLabel ?? "Pular")} />
              ) : null}
            </div>
          ) : null}

          {phase === "submit_error" ? (
            <button
              type="button"
              onClick={() => void retrySubmit()}
              className="mt-1 inline-flex items-center gap-2 self-end rounded-full border border-[var(--chat-accent)] px-5 py-2.5 text-[15px] text-[var(--chat-accent)] transition-colors duration-150 hover:bg-[var(--chat-accent)] hover:text-[var(--chat-accent-fg)]"
            >
              <RotateCcw className="h-4 w-4" aria-hidden />
              Tentar de novo
            </button>
          ) : null}

          {phase === "done" && bookingUrl && panelHeight > 0 ? (
            <motion.div
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.32, ease: [0.22, 1, 0.36, 1] }}
              className="mt-1 flex shrink-0 flex-col overflow-hidden rounded-[18px] border border-[var(--chat-border)] bg-white"
              style={{ height: panelHeight }}
            >
              <iframe
                src={bookingUrl}
                title={chat?.scheduling?.ctaLabel ?? "Agendar"}
                className="w-full flex-1 border-0"
                allow="payment"
              />
              {!booked ? (
                <a
                  href={schedulingUrl ?? bookingUrl}
                  target="_blank"
                  rel="noopener"
                  className="flex items-center justify-center gap-1.5 border-t border-[var(--chat-border)] py-2 text-[13px] text-[var(--chat-muted)] hover:text-[var(--chat-fg)]"
                >
                  <ExternalLink className="h-3.5 w-3.5" aria-hidden />
                  Abrir a agenda em outra aba
                </a>
              ) : null}
            </motion.div>
          ) : null}

          {panelAt != null ? messages.slice(panelAt).map(renderMessage) : null}
          {typing && panelAt != null ? typingBubble : null}

          {phase === "done" && schedulingUrl && !bookingUrl ? (
            <motion.a
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.32, ease: [0.22, 1, 0.36, 1] }}
              href={schedulingUrl}
              target="_blank"
              rel="noopener"
              onClick={() =>
                window.parent?.postMessage(
                  { type: "spark-forms:scheduling-opened", slug: form.slug },
                  "*",
                )
              }
              className="mt-2 inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-full bg-[var(--chat-cta)] px-8 text-[18px] text-[var(--chat-cta-fg)] transition-[transform,box-shadow] duration-150 hover:-translate-y-px hover:shadow-[0_24px_60px_-20px_rgba(18,28,43,0.45)] focus-visible:outline-2 focus-visible:outline-offset-3 focus-visible:outline-[var(--chat-fg)]"
            >
              <CalendarDays className="h-5 w-5" aria-hidden />
              {chat?.scheduling?.ctaLabel ?? "Escolher horário"}
            </motion.a>
          ) : null}
        </div>

        {phase === "awaiting" && step && TEXT_TYPES.has(step.type) ? (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              void onSendText();
            }}
            noValidate
            className="flex items-end gap-2 border-t border-[var(--chat-border)] px-4 py-3"
          >
            {step.type === "long_text" ? (
              <textarea
                ref={(el) => {
                  inputRef.current = el;
                }}
                value={draft}
                rows={2}
                onChange={(e) => setDraft(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    void onSendText();
                  }
                }}
                placeholder={step.placeholder ?? "Escreva aqui…"}
                className="min-h-11 flex-1 resize-none rounded-[18px] border border-[var(--chat-input-border)] bg-[var(--chat-input-bg)] px-4 py-2.5 text-[15px] text-[var(--chat-fg)] outline-none placeholder:text-[var(--chat-muted)] focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-[var(--chat-accent)]"
              />
            ) : (
              <input
                ref={(el) => {
                  inputRef.current = el;
                }}
                value={draft}
                onChange={(e) =>
                  setDraft(step.type === "phone" ? formatPhoneBR(e.target.value).display : e.target.value)
                }
                {...inputAttrs(step)}
                placeholder={step.placeholder ?? "Escreva aqui…"}
                className="h-11 min-w-0 flex-1 rounded-full border border-[var(--chat-input-border)] bg-[var(--chat-input-bg)] px-5 text-[15px] text-[var(--chat-fg)] outline-none placeholder:text-[var(--chat-muted)] focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-[var(--chat-accent)]"
              />
            )}
            {!step.required && !draft.trim() ? (
              <SkipButton label={step.skipLabel} onClick={() => void answer(null, step.skipLabel ?? "Pular")} />
            ) : (
              <button
                type="submit"
                aria-label="Enviar"
                disabled={!draft.trim()}
                className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-[var(--chat-accent)] text-[var(--chat-accent-fg)] transition-opacity duration-150 disabled:opacity-35 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--chat-accent)]"
              >
                <ArrowUp className="h-[18px] w-[18px]" aria-hidden />
              </button>
            )}
          </form>
        ) : null}

        {form.lgpdNotice && messages.length > 0 && phase !== "done" ? (
          <p className="whitespace-pre-line px-5 pb-3 text-[11px] leading-snug text-[var(--chat-muted)]">
            {form.lgpdNotice}
          </p>
        ) : null}
      </section>
    </div>
  );
}

function ProgressBar({
  answered,
  remaining,
  started,
  booked,
  color,
  track,
}: {
  answered: number;
  remaining: number;
  started: boolean;
  booked: boolean;
  color?: string;
  track?: string;
}) {
  const total = answered + remaining;
  const pct = total > 0 ? Math.round((answered / total) * 100) : 0;
  const label = !started
    ? `${total} perguntas rápidas`
    : remaining === 0
      ? booked
        ? "Tudo pronto"
        : "Perguntas concluídas"
      : remaining === 1
        ? "Falta 1 pergunta"
        : `Faltam ${remaining} perguntas`;

  return (
    <div className="border-b border-[var(--chat-border)] px-5 pt-2.5 pb-3">
      <div className="flex items-baseline justify-between text-[12px] leading-none text-[var(--chat-muted)]">
        <span>{label}</span>
        <span className="tabular-nums">
          {answered}/{total}
        </span>
      </div>
      <div
        role="progressbar"
        aria-label="Progresso das perguntas"
        aria-valuemin={0}
        aria-valuemax={total}
        aria-valuenow={answered}
        className="mt-2 h-1.5 overflow-hidden rounded-full"
        style={{ background: track ?? "var(--chat-bot-bg)" }}
      >
        <motion.div
          className="h-full rounded-full"
          style={{
            background: color ?? "var(--chat-accent)",
            boxShadow: color ? `0 0 8px ${color}80` : undefined,
          }}
          initial={false}
          animate={{ width: `${pct}%` }}
          transition={{ duration: 0.32, ease: [0.22, 1, 0.36, 1] }}
        />
      </div>
    </div>
  );
}

function SkipButton({ label, onClick }: { label?: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="h-11 shrink-0 rounded-full px-4 text-[14px] text-[var(--chat-muted)] underline underline-offset-4 decoration-[var(--chat-input-border)] hover:text-[var(--chat-fg)] hover:decoration-current"
    >
      {label ?? "Pular"}
    </button>
  );
}

function inputAttrs(step: Step): React.InputHTMLAttributes<HTMLInputElement> {
  switch (step.type) {
    case "email":
      return { type: "email", inputMode: "email", autoComplete: "email", autoCapitalize: "off", spellCheck: false };
    case "phone":
      return { type: "tel", inputMode: "tel", autoComplete: "tel" };
    case "number":
      return { type: "text", inputMode: "decimal" };
    case "url":
      return { type: "url", inputMode: "url", autoCapitalize: "off", spellCheck: false };
    default:
      return {
        type: "text",
        autoComplete: step.mapTo?.toLowerCase().includes("nome") ? "name" : undefined,
        maxLength: step.validation?.max,
      };
  }
}

/** Same rules as the form fields, phrased as a bot reply. */
async function validateText(step: Step, value: string): Promise<string | null> {
  const m = step.messages ?? {};
  if (!value) return m.required ?? "Preciso dessa resposta pra seguir 🙂";

  switch (step.type) {
    case "email": {
      const email = value.toLowerCase();
      const corporateOnly = !!step.validation?.corporateOnly;
      const local = validateEmail(email, { corporateOnly });
      if (!local.ok) return messageFor(local.reason, step);
      const remote = await validateEmailRemote(email, corporateOnly);
      return remote.ok ? null : messageFor(remote.reason, step);
    }
    case "phone": {
      const digits = value.replace(/\D/g, "");
      return digits.length < 10
        ? (m.invalid ?? "Esse telefone parece incompleto. Pode mandar com DDD?")
        : null;
    }
    case "number":
      return Number.isFinite(Number(value.replace(",", ".")))
        ? null
        : (m.invalid ?? "Me manda só o número, por favor.");
    case "url":
      try {
        new URL(/^https?:\/\//i.test(value) ? value : `https://${value}`);
        return null;
      } catch {
        return m.invalid ?? "Esse link não parece válido.";
      }
  }

  const { min, max, pattern } = step.validation ?? {};
  if (min != null && value.length < min) return m.min ?? `Pode escrever um pouco mais? (mín. ${min} caracteres)`;
  if (max != null && value.length > max) return m.max ?? `Ficou longo — até ${max} caracteres.`;
  if (pattern && !new RegExp(pattern).test(value)) return m.pattern ?? m.invalid ?? "Não entendi esse formato.";
  return null;
}

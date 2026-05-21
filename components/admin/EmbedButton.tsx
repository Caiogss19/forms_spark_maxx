"use client";

import { Code2, Copy, X } from "lucide-react";
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";


import { cn } from "@/lib/utils";

interface Props {
  slug: string;
  variant?: "default" | "ghost";
  label?: string;
}

export function EmbedButton({ slug, variant = "default", label = "Embed" }: Props) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={cn(
          "inline-flex h-9 items-center gap-1.5 rounded-lg px-3 text-sm font-medium transition-colors",
          variant === "default"
            ? "border border-border hover:bg-muted"
            : "text-muted-foreground hover:text-foreground",
        )}
      >
        <Code2 className="h-3.5 w-3.5" aria-hidden />
        {label}
      </button>
      {open ? <EmbedModal slug={slug} onClose={() => setOpen(false)} /> : null}
    </>
  );
}

function EmbedModal({ slug, onClose }: { slug: string; onClose: () => void }) {
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener("keydown", onKey);
    };
  }, [onClose]);

  const origin = window.location.origin;

  const snippet = `<div data-spark-form="${slug}" data-spark-min-height="640px"></div>
<script async src="${origin}/embed.js?v=9"></script>`;

  const hostSnippet = `<!-- Cole UMA VEZ no <head> do site (Framer: Site Settings → Custom Code → Start of <head>).
     Garante que os UTMs da página real cheguem no payload do form,
     mesmo se o Framer/Next/qualquer SPA limpar ?utm_* via history.replaceState. -->
<script>
(function(){
  var u=location.href,r=document.referrer;
  window.addEventListener('message',function(e){
    if(!e.data||e.data.type!=='spark-forms:host-url-request')return;
    try{
      var n=location.href;
      e.source&&e.source.postMessage({type:'spark-forms:host-url-response',url:/[?&]utm_/i.test(n)?n:(/[?&]utm_/i.test(u)?u:n),referrer:document.referrer||r},'*');
    }catch(_){}
  });
})();
</script>`;

  const iframe = `<iframe
  src="${origin}/embed/${slug}"
  style="width:100%;height:640px;border:0;display:block;"
  loading="lazy"
  title="Spark Forms"></iframe>`;

  const directUrl = `${origin}/f/${slug}`;

  return createPortal(
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 p-4"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
    >
      <div
        className="relative flex max-h-[90vh] w-full max-w-xl flex-col rounded-2xl border border-border bg-background shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-4 border-b border-border px-6 py-4">
          <div>
            <h3 className="text-lg font-semibold tracking-tight">
              Embedar no Framer (ou qualquer site)
            </h3>
            <p className="mt-1 text-xs text-muted-foreground">
              Form: <code className="rounded bg-muted px-1 py-0.5">{slug}</code>
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Fechar"
            className="rounded-md p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="space-y-5 overflow-y-auto px-6 py-5">
          <CopyBlock
            title="1) Snippet do form (cole onde o form deve aparecer)"
            hint="Auto-resize, encaminha UTMs/cookies da página pai, dispara spark:submission no submit."
            code={snippet}
          />
          <CopyBlock
            title="2) Host listener (cole UMA vez em Start of <head>)"
            hint="Indispensável pra Framer/Webflow/qualquer SPA: o snippet captura a URL com ?utm_* assim que carrega, antes do router limpar a querystring. Sem isso, os UTMs somem do payload."
            code={hostSnippet}
          />
          <CopyBlock
            title="Iframe puro (sem tracking)"
            hint="Altura fixa 640px, sem forward de UTMs. Use só se não puder rodar JS."
            code={iframe}
          />
          <CopyBlock
            title="Link direto"
            hint="Standalone público — manda pra rede social, e-mail, etc."
            code={directUrl}
          />
          <div className="rounded-lg border border-dashed border-border bg-muted/30 p-3 text-xs leading-relaxed text-muted-foreground">
            <p className="mb-1 font-semibold text-foreground">No Framer</p>
            <p>
              <strong>Insert → Embed → Type: HTML</strong> e cole o snippet
              recomendado. Funciona igual em Webflow, Wix, Squarespace,
              WordPress (HTML block) ou qualquer site que aceite HTML/script.
            </p>
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
}

function CopyBlock({
  title,
  code,
  hint,
}: {
  title: string;
  code: string;
  hint?: string;
}) {
  const [copied, setCopied] = useState(false);
  async function copy() {
    try {
      await navigator.clipboard.writeText(code);
    } catch {
      const ta = document.createElement("textarea");
      ta.value = code;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand("copy");
      document.body.removeChild(ta);
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          {title}
        </p>
        <button
          type="button"
          onClick={copy}
          className="inline-flex h-8 items-center gap-1.5 rounded-md border border-border px-2.5 text-xs font-medium transition-colors hover:bg-muted"
        >
          <Copy className="h-3 w-3" />
          {copied ? "Copiado!" : "Copiar"}
        </button>
      </div>
      <pre className="overflow-x-auto rounded-lg border border-border bg-muted/40 px-3 py-2.5 text-xs leading-relaxed">
        <code>{code}</code>
      </pre>
      {hint ? <p className="text-xs text-muted-foreground">{hint}</p> : null}
    </div>
  );
}

"use client";

import { File as FileIcon, Loader2, Trash2, Upload } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { cn } from "@/lib/utils";
import type { FieldProps } from "@/components/form-runner/fields/types";

interface UploadResult {
  ok: boolean;
  url?: string;
  name?: string;
  size?: number;
  type?: string;
  storage?: "vercel-blob" | "data-url";
  message?: string;
}

export function FileUpload({
  step,
  value,
  setValue,
  registerSubmit,
  setError,
}: FieldProps) {
  const [uploading, setUploading] = useState(false);
  const [meta, setMeta] = useState<{ name: string; size: number } | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    registerSubmit(() => {
      if (uploading) {
        setError("Aguarde o upload terminar.");
        return false;
      }
      if (step.required && !value) {
        setError(step.messages?.required ?? "Anexe um arquivo.");
        return false;
      }
      setError(null);
      return true;
    });
  }, [step, value, uploading, registerSubmit, setError]);

  const accepted = step.validation?.acceptedMimeTypes ?? [];
  const maxMB = step.validation?.maxFileSizeMB ?? 10;

  async function onFileChosen(file: File) {
    setError(null);
    setMeta({ name: file.name, size: file.size });
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      fd.append("maxFileSizeMB", String(maxMB));
      if (accepted.length > 0) {
        fd.append("acceptedMimeTypes", accepted.join(","));
      }
      const res = await fetch("/api/upload", { method: "POST", body: fd });
      const data = (await res.json()) as UploadResult;
      if (!res.ok || !data.ok || !data.url) {
        setError(data.message ?? "Falha no upload.");
        setMeta(null);
        return;
      }
      setValue(data.url);
    } catch {
      setError("Falha de rede no upload.");
      setMeta(null);
    } finally {
      setUploading(false);
    }
  }

  function clear() {
    setMeta(null);
    setValue(undefined);
    setError(null);
    if (inputRef.current) inputRef.current.value = "";
  }

  const hasFile = typeof value === "string" && value.length > 0;

  return (
    <div className="space-y-3">
      <label
        className={cn(
          "flex cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-border px-6 py-10 text-center transition-colors",
          "hover:border-foreground/30 hover:bg-muted/40",
          uploading && "pointer-events-none opacity-60",
        )}
      >
        {uploading ? (
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        ) : (
          <Upload className="h-6 w-6 text-muted-foreground" />
        )}
        <span className="text-sm font-medium">
          {uploading ? "Enviando…" : "Clique pra escolher um arquivo"}
        </span>
        <span className="text-xs text-muted-foreground">
          {accepted.length > 0 ? accepted.join(", ") : "Qualquer formato"} ·
          até {maxMB}MB
        </span>
        <input
          ref={inputRef}
          type="file"
          className="sr-only"
          accept={accepted.join(",")}
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) void onFileChosen(f);
          }}
        />
      </label>

      {hasFile && meta ? (
        <div className="flex items-center gap-3 rounded-lg border border-border bg-muted/40 px-3 py-2.5 text-sm">
          <FileIcon
            className="h-4 w-4 shrink-0 text-muted-foreground"
            aria-hidden
          />
          <div className="min-w-0 flex-1">
            <p className="truncate font-medium">{meta.name}</p>
            <p className="text-xs text-muted-foreground">
              {(meta.size / 1024).toFixed(1)} KB
            </p>
          </div>
          <button
            type="button"
            onClick={clear}
            className="rounded p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            aria-label="Remover arquivo"
          >
            <Trash2 className="h-4 w-4" />
          </button>
        </div>
      ) : null}
    </div>
  );
}

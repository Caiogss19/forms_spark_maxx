import "server-only";
import { promises as fs } from "node:fs";
import path from "node:path";
import { cache } from "react";

import { FormSchema, type FormDefinition } from "@/lib/schema";
import { getFormRow, isSupabaseConfigured, listFormRows } from "@/lib/supabase";

const FORMS_DIR = path.join(process.cwd(), "forms");

export class FormNotFoundError extends Error {
  constructor(slug: string) {
    super(`Form "${slug}" not found.`);
    this.name = "FormNotFoundError";
  }
}

export class FormSchemaError extends Error {
  constructor(slug: string, public readonly issues: unknown) {
    super(`Form "${slug}" failed schema validation.`);
    this.name = "FormSchemaError";
  }
}

async function readFromFilesystem(slug: string): Promise<unknown | null> {
  const filePath = path.join(FORMS_DIR, `${slug}.json`);
  try {
    const raw = await fs.readFile(filePath, "utf8");
    return JSON.parse(raw);
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === "ENOENT") return null;
    throw err;
  }
}

async function listFilesystemSlugs(): Promise<string[]> {
  try {
    const entries = await fs.readdir(FORMS_DIR);
    return entries
      .filter((name) => name.endsWith(".json"))
      .map((name) => name.replace(/\.json$/, ""));
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === "ENOENT") return [];
    throw err;
  }
}

/**
 * Resolves a form slug → schema, preferring Supabase (live-editable) and
 * falling back to the filesystem JSON (the seeded baseline). When the
 * admin editor saves to Supabase, the live form picks it up on the next
 * request without a redeploy.
 */
export const getFormBySlug = cache(
  async (slug: string): Promise<FormDefinition> => {
    if (!/^[a-z0-9-]+$/.test(slug)) {
      throw new FormNotFoundError(slug);
    }

    let json: unknown | null = null;

    if (isSupabaseConfigured()) {
      const row = await getFormRow(slug);
      if (row && row.active !== false) json = row.schema;
    }

    if (json == null) {
      json = await readFromFilesystem(slug);
    }

    if (json == null) {
      throw new FormNotFoundError(slug);
    }

    const parsed = FormSchema.safeParse(json);
    if (!parsed.success) {
      throw new FormSchemaError(slug, parsed.error.issues);
    }
    if (parsed.data.slug !== slug) {
      throw new FormSchemaError(slug, [
        {
          message: `Schema slug "${parsed.data.slug}" does not match requested "${slug}".`,
        },
      ]);
    }
    return parsed.data;
  },
);

export const getFormSlugs = cache(async (): Promise<string[]> => {
  const fsSlugs = await listFilesystemSlugs();
  const set = new Set(fsSlugs);

  if (isSupabaseConfigured()) {
    const rows = await listFormRows();
    if (rows) {
      for (const row of rows) {
        if (row.active !== false) set.add(row.slug);
      }
    }
  }

  return Array.from(set).sort();
});

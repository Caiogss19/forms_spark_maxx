import "server-only";
import { promises as fs } from "node:fs";
import path from "node:path";
import { cache } from "react";

import { FormSchema, type FormDefinition } from "@/lib/schema";

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

export const getFormSlugs = cache(async (): Promise<string[]> => {
  try {
    const entries = await fs.readdir(FORMS_DIR);
    return entries
      .filter((name) => name.endsWith(".json"))
      .map((name) => name.replace(/\.json$/, ""))
      .sort();
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === "ENOENT") return [];
    throw err;
  }
});

export const getFormBySlug = cache(
  async (slug: string): Promise<FormDefinition> => {
    if (!/^[a-z0-9-]+$/.test(slug)) {
      throw new FormNotFoundError(slug);
    }
    const filePath = path.join(FORMS_DIR, `${slug}.json`);
    let raw: string;
    try {
      raw = await fs.readFile(filePath, "utf8");
    } catch (err) {
      if ((err as NodeJS.ErrnoException).code === "ENOENT") {
        throw new FormNotFoundError(slug);
      }
      throw err;
    }

    const json: unknown = JSON.parse(raw);
    const parsed = FormSchema.safeParse(json);
    if (!parsed.success) {
      throw new FormSchemaError(slug, parsed.error.issues);
    }
    if (parsed.data.slug !== slug) {
      throw new FormSchemaError(slug, [
        {
          message: `Schema slug "${parsed.data.slug}" does not match filename "${slug}".`,
        },
      ]);
    }
    return parsed.data;
  },
);

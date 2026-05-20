#!/usr/bin/env node
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

import { FormSchema } from "../lib/schema.ts";

const formsDir = join(process.cwd(), "forms");

const files = readdirSync(formsDir).filter((f) => f.endsWith(".json"));
if (files.length === 0) {
  console.log("No form JSONs found in /forms.");
  process.exit(0);
}

let failed = 0;
for (const file of files) {
  const slug = file.replace(/\.json$/, "");
  const raw = readFileSync(join(formsDir, file), "utf8");
  let json: unknown;
  try {
    json = JSON.parse(raw);
  } catch (err) {
    console.error(`❌ ${file}: invalid JSON — ${(err as Error).message}`);
    failed++;
    continue;
  }
  const result = FormSchema.safeParse(json);
  if (!result.success) {
    failed++;
    console.error(`❌ ${file}: schema errors`);
    for (const issue of result.error.issues) {
      console.error(
        `   • ${issue.path.join(".") || "(root)"}: ${issue.message}`,
      );
    }
    continue;
  }
  if (result.data.slug !== slug) {
    failed++;
    console.error(
      `❌ ${file}: schema slug "${result.data.slug}" != filename "${slug}"`,
    );
    continue;
  }
  console.log(`✅ ${file} (${result.data.steps.length} steps)`);
}

if (failed > 0) {
  console.error(`\n${failed} form(s) failed validation.`);
  process.exit(1);
}
console.log(`\n${files.length} form(s) valid.`);

import type { Step } from "@/lib/schema";
import type { SnapshotState } from "@/lib/store";

type Op = "eq" | "neq" | "in" | "contains" | "gt" | "lt";

/**
 * Evaluates a single `if` condition against the current answers map.
 * The branching engine is intentionally forgiving — type coercion follows
 * the principle that an author writing { value: "yes" } expects a match
 * against an actual boolean true OR the string "yes".
 */
export function evaluateCondition(
  cond: { field: string; op: Op; value: unknown },
  answers: Record<string, unknown>,
): boolean {
  const candidate = answers[cond.field];

  switch (cond.op) {
    case "eq":
      return looseEqual(candidate, cond.value);
    case "neq":
      return !looseEqual(candidate, cond.value);
    case "in": {
      if (!Array.isArray(cond.value)) return false;
      const list = cond.value as unknown[];
      if (Array.isArray(candidate)) {
        return candidate.some((c) => list.some((v) => looseEqual(c, v)));
      }
      return list.some((v) => looseEqual(candidate, v));
    }
    case "contains": {
      if (Array.isArray(candidate)) {
        return candidate.some((c) => looseEqual(c, cond.value));
      }
      if (typeof candidate === "string" && typeof cond.value === "string") {
        return candidate.toLowerCase().includes(cond.value.toLowerCase());
      }
      return false;
    }
    case "gt":
      return toNumber(candidate) > toNumber(cond.value);
    case "lt":
      return toNumber(candidate) < toNumber(cond.value);
    default:
      return false;
  }
}

function looseEqual(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (a == null || b == null) return false;
  if (typeof a === "boolean" || typeof b === "boolean") {
    return String(a).toLowerCase() === String(b).toLowerCase();
  }
  if (typeof a === "number" || typeof b === "number") {
    return toNumber(a) === toNumber(b);
  }
  return String(a) === String(b);
}

function toNumber(v: unknown): number {
  if (typeof v === "number") return v;
  if (typeof v === "string") {
    const n = Number(v.replace(/[^\d.-]/g, ""));
    return Number.isFinite(n) ? n : NaN;
  }
  return NaN;
}

/**
 * Resolves the next step for the current step using its logic[] rules.
 * First matching rule wins; if none match, falls back to the next step
 * in document order. Returns null when there's no further step.
 *
 * The author-facing key the rule reads from is the same key writes use:
 * step.mapTo (or step.id when mapTo is omitted), so a rule that branches
 * on "role" reads answers["role"] regardless of whether the step had a
 * mapTo that renamed the storage key. Authors who use mapTo should refer
 * to the mapTo'd key in their branching conditions.
 */
export function resolveNextStep(state: SnapshotState): string | null {
  const { currentStepId, steps, answers } = state;
  const idx = steps.findIndex((s) => s.id === currentStepId);
  if (idx === -1) return null;
  const step = steps[idx];

  if (step.logic && step.logic.length > 0) {
    for (const rule of step.logic) {
      if (evaluateCondition(rule.if, answers)) {
        const target = steps.find((s) => s.id === rule.goto);
        if (target) return target.id;
      }
    }
  }

  if (idx === steps.length - 1) return null;
  return steps[idx + 1].id;
}

/**
 * Lookup helper used by tests / future debugging.
 */
export function findStepIndex(steps: Step[], id: string): number {
  return steps.findIndex((s) => s.id === id);
}

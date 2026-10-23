// Lightweight client-side masks. No deps.

/**
 * BR phone formatter:
 *   11 digits     →  (11) 99999-9999
 *   10 digits     →  (11) 9999-9999
 *   starts with + →  +55 (11) 99999-9999
 *
 * Returns the formatted string and a raw E.164-ish value.
 */
export function formatPhoneBR(input: string): {
  display: string;
  raw: string;
} {
  const trimmed = input.trim();
  const international = trimmed.startsWith("+");
  const digits = trimmed.replace(/\D/g, "").slice(0, 13);

  if (international || digits.startsWith("55")) {
    const rest = digits.startsWith("55") ? digits.slice(2) : digits;
    const ddd = rest.slice(0, 2);
    const part1 = rest.slice(2, rest.length - 4);
    const part2 = rest.slice(-4);
    let display = "+55";
    if (ddd) display += ` (${ddd}`;
    if (ddd.length === 2) display += ")";
    if (part1) display += ` ${part1}`;
    if (part2 && rest.length > 6) display += `-${part2}`;
    return {
      display: display.trim(),
      raw: `+55${rest}`.slice(0, 14),
    };
  }

  return { display: nationalBR(digits), raw: digits };
}

/** DDD + number → "(11) 99999-9999" / "(11) 9999-9999", as typed so far. */
function nationalBR(digits: string): string {
  const ddd = digits.slice(0, 2);
  const isMobile = digits.length === 11;
  const main = isMobile ? digits.slice(2, 7) : digits.slice(2, 6);
  const end = digits.slice(isMobile ? 7 : 6, isMobile ? 11 : 10);
  let display = "";
  if (ddd) display = `(${ddd}`;
  // The ")" only comes with the next digit: closing it at 2 digits made backspace stick at "(11)".
  if (main) display += `) ${main}`;
  if (end) display += `-${end}`;
  return display.trim();
}

/** The prefix the chat's phone answer starts with: the lead types only DDD + number. */
export const BR_DDI = "+55 ";

/**
 * BR phone with "+55 " always in front: "+55 (11) 99999-9999". The prefix
 * can't be erased (clearing the field brings it back). A leading 55 is read
 * as the DDI only right after the "+" or when there are more than 11 digits,
 * so DDD 55 still works and a pasted "11 99999-9999" gets the +55.
 */
export function formatPhoneWithDDI(input: string): string {
  const trimmed = input.trim();
  // With "+" in front, what's left of the "+55" (even a half-erased "+5") is the prefix, never the DDD.
  let digits = trimmed.startsWith("+") ? trimmed.replace(/^\+\s*5?5?/, "").replace(/\D/g, "") : trimmed.replace(/\D/g, "");
  if (!trimmed.startsWith("+") && digits.length > 11 && digits.startsWith("55")) digits = digits.slice(2);
  return `${BR_DDI}${nationalBR(digits.slice(0, 11))}`;
}

/** DDD + number of a value from `formatPhoneWithDDI` (or typed without the +55). */
export function nationalDigitsBR(value: string): string {
  const digits = value.replace(/\D/g, "");
  return value.trim().startsWith("+55") ? digits.slice(2) : digits;
}

/**
 * Formats a value as BRL currency. Accepts:
 *   - raw digit string ("1234") → "R$ 12,34" (last 2 = cents)
 *   - number (12.34)            → "R$ 12,34"
 */
export function formatBRL(input: string | number): {
  display: string;
  amount: number;
} {
  let cents: number;
  if (typeof input === "number") {
    cents = Math.round(input * 100);
  } else {
    const digits = input.replace(/\D/g, "");
    cents = digits ? Number(digits) : 0;
  }
  const amount = cents / 100;
  const display = amount.toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  return { display, amount };
}

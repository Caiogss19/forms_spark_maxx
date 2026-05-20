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

  const ddd = digits.slice(0, 2);
  const isMobile = digits.length === 11;
  const main = isMobile ? digits.slice(2, 7) : digits.slice(2, 6);
  const end = digits.slice(isMobile ? 7 : 6, isMobile ? 11 : 10);
  let display = "";
  if (ddd) display = `(${ddd}`;
  if (ddd.length === 2) display += ")";
  if (main) display += ` ${main}`;
  if (end) display += `-${end}`;
  return { display: display.trim(), raw: digits };
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

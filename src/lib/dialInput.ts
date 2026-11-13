import { formatPhone, toE164 } from "./phone";

/** Longest number the field accepts (Compass takes 10–20 characters). */
export const MAX_DIAL_LENGTH = 20;

/**
 * Clean what the agent typed or pasted. Keeps digits, a leading "+", and the spacing characters
 * Compass accepts (space, "-", parentheses); drops everything else, including the invisible
 * direction marks WhatsApp wraps around numbers. The result is what is sent to Compass as typed.
 */
export function sanitizeDialInput(text: string): string {
  const kept = text.replace(/[^\d+\s\-()]/g, "").replace(/\s+/g, " ");
  // A "+" is only meaningful as the first character.
  const plus = kept.trimStart().startsWith("+") ? "+" : "";
  const rest = kept.replace(/[+]/g, "").trimStart();
  return `${plus}${rest}`.slice(0, MAX_DIAL_LENGTH);
}

/** Key presses on the on-screen pad: a digit, "+" (only first) or "back" (backspace). */
export function pressKey(value: string, key: string): string {
  if (key === "back") return value.slice(0, -1);
  if (key === "+") return value.length === 0 ? "+" : value;
  return sanitizeDialInput(`${value}${key}`);
}

/** The number to dial and show, or null when it can't be dialed (too short, not a mobile). */
export function dialTarget(input: string): { e164: string; display: string } | null {
  const e164 = toE164(sanitizeDialInput(input));
  return e164 ? { e164, display: formatPhone(e164) } : null;
}

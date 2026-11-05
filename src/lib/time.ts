/**
 * Date formatting in IST. Pure functions, covered by time.regression.ts.
 *
 * Done with a fixed +05:30 offset (India has no daylight saving) instead of Intl time zones,
 * so the output is identical on every device and in tests.
 */

const IST_OFFSET_MS = (5 * 60 + 30) * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

function toMs(input: string | number | Date): number {
  return input instanceof Date ? input.getTime() : typeof input === "number" ? input : Date.parse(input);
}

/** Calendar parts as seen on an IST wall clock. */
function istParts(ms: number) {
  const t = new Date(ms + IST_OFFSET_MS);
  return {
    year: t.getUTCFullYear(),
    month: t.getUTCMonth(),
    day: t.getUTCDate(),
    hour: t.getUTCHours(),
    minute: t.getUTCMinutes(),
  };
}

/** Whole days since the epoch on the IST calendar; equal values mean the same IST date. */
function istDayNumber(ms: number): number {
  return Math.floor((ms + IST_OFFSET_MS) / DAY_MS);
}

/** "4:05 pm" */
export function formatTimeIST(input: string | number | Date): string {
  const { hour, minute } = istParts(toMs(input));
  const h12 = hour % 12 === 0 ? 12 : hour % 12;
  return `${h12}:${String(minute).padStart(2, "0")} ${hour < 12 ? "am" : "pm"}`;
}

/**
 * Short relative label for lists:
 * "Today 4:05 pm", "Yesterday 9:00 am", "Tomorrow 11:30 am", "12 Nov, 4:05 pm", "12 Nov 2025".
 * Returns "" for missing or unparsable input.
 */
export function formatWhen(
  input: string | number | Date | null | undefined,
  now: number = Date.now(),
): string {
  if (input === null || input === undefined || input === "") return "";
  const ms = toMs(input);
  if (Number.isNaN(ms)) return "";

  const diff = istDayNumber(ms) - istDayNumber(now);
  const time = formatTimeIST(ms);
  if (diff === 0) return `Today ${time}`;
  if (diff === -1) return `Yesterday ${time}`;
  if (diff === 1) return `Tomorrow ${time}`;

  const p = istParts(ms);
  const date = `${p.day} ${MONTHS[p.month]}`;
  return p.year === istParts(now).year ? `${date}, ${time}` : `${date} ${p.year}`;
}

/** True when a due time has passed. Missing or unparsable dates are never overdue. */
export function isOverdue(dueAt: string | null | undefined, now: number = Date.now()): boolean {
  if (!dueAt) return false;
  const ms = Date.parse(dueAt);
  return !Number.isNaN(ms) && ms < now;
}

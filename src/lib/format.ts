/**
 * Display formatting identical to Compass web (leadsquared-avataar-client src/lib/formatters.ts).
 * All times are shown on the IST clock. Pure functions, covered by format.test.ts.
 */

const IST_OFFSET_MS = (5 * 60 + 30) * 60 * 1000;
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const pad = (n: number) => String(n).padStart(2, "0");

function ist(input: string | number | null | undefined) {
  if (input === null || input === undefined || input === "") return null;
  const ms = typeof input === "number" ? input : Date.parse(input);
  if (Number.isNaN(ms)) return null;
  const t = new Date(ms + IST_OFFSET_MS);
  const h = t.getUTCHours();
  return {
    day: t.getUTCDate(),
    month: t.getUTCMonth(),
    year: t.getUTCFullYear(),
    time: `${pad(h % 12 === 0 ? 12 : h % 12)}:${pad(t.getUTCMinutes())} ${h < 12 ? "am" : "pm"}`,
  };
}

/** "04/11/2026, 08:18 pm" (Compass formatDate). "—" when missing. */
export function formatDateIN(input: string | number | null | undefined): string {
  const p = ist(input);
  return p ? `${pad(p.day)}/${pad(p.month + 1)}/${p.year}, ${p.time}` : "—";
}

/** "4 Nov, 08:18 pm" (Calls, Call Details, WhatsApp). */
export function formatShortIN(input: string | number | null | undefined): string {
  const p = ist(input);
  return p ? `${p.day} ${MONTHS[p.month]}, ${p.time}` : "—";
}

/** "04 Nov 2026, 08:18 pm" (Appointments, Sessions). */
export function formatLongIN(input: string | number | null | undefined): string {
  const p = ist(input);
  return p ? `${pad(p.day)} ${MONTHS[p.month]} ${p.year}, ${p.time}` : "—";
}

/** Compass formatPhone: "+…" unchanged, 10 digits → "+91-XXXXXXXXXX", anything else unchanged. */
export function formatPhoneCompass(phone: string | null | undefined): string {
  if (!phone) return "—";
  const p = phone.trim();
  if (p.startsWith("+")) return p;
  return /^\d{10}$/.test(p) ? `+91-${p}` : p;
}

const SOURCE_ALIASES: Record<string, string> = { "laser-short-journey": "facial-short-journey" };

/** Compass shows sources as stored, with one alias. "—" when missing. */
export function formatSourceName(source: string | null | undefined): string {
  if (!source) return "—";
  return SOURCE_ALIASES[source] ?? source;
}

/** "Xm Ys" (Compass call durations). "—" for a missing or zero, unanswered call. */
export function formatCallDuration(seconds: number | string | null | undefined): string {
  const s = Number(seconds);
  if (!Number.isFinite(s) || s <= 0) return "—";
  return `${Math.floor(s / 60)}m ${Math.round(s % 60)}s`;
}

/** "₹1,23,456" (Indian grouping). "—" when missing. */
export function formatRupees(amount: number | string | null | undefined): string {
  if (amount === null || amount === undefined || amount === "") return "—";
  const n = Number(amount);
  if (!Number.isFinite(n)) return "—";
  const [whole = "0", frac] = Math.abs(n).toFixed(2).replace(/\.00$/, "").split(".");
  const last3 = whole.slice(-3);
  const rest = whole.slice(0, -3).replace(/\B(?=(\d{2})+(?!\d))/g, ",");
  return `${n < 0 ? "-" : ""}₹${rest ? `${rest},${last3}` : last3}${frac ? `.${frac}` : ""}`;
}

/** First + last name, else the phone, else "Unknown Lead" (Compass getLeadDisplayName). */
export function leadDisplayName(
  first: string | null | undefined,
  last: string | null | undefined,
  phone?: string | null,
): string {
  const name = [first, last]
    .map((s) => s?.trim())
    .filter(Boolean)
    .join(" ");
  return name || phone || "Unknown Lead";
}

export type StageTone =
  "red" | "brand" | "gray" | "cyan" | "amber" | "orange" | "green" | "purple" | "yellow";

/** Colour of a stage, by Compass's rules (OpportunityDetail stage line and badges). */
export function stageTone(code: string | null | undefined, stageType?: string | null): StageTone {
  const c = code ?? "";
  if (stageType === "inactive") return "red";
  if (c === "new_lead") return "brand";
  if (c === "not_connected") return "gray";
  if (c.startsWith("cold")) return "cyan";
  if (c.startsWith("warm")) return "amber";
  if (c.startsWith("hot")) return "orange";
  if (c.includes("paid")) return "green";
  if (/^(complaint|escalated|reopened)/.test(c)) return "purple";
  if (c === "on_hold") return "yellow";
  return "gray";
}

/** Payment status badge text (Purchase History). */
export function paymentStatusLabel(status: string | null | undefined): string {
  if (status === "paid") return "Paid";
  if (status === "partial_paid") return "Partial";
  if (status === "pending") return "Pending";
  return status || "—";
}

const DAY_MS = 24 * 60 * 60 * 1000;
const istDay = (ms: number) => Math.floor((ms + IST_OFFSET_MS) / DAY_MS);
/** IST weekday, Monday = 0. */
const istWeekday = (ms: number) => (new Date(ms + IST_OFFSET_MS).getUTCDay() + 6) % 7;

/** Activity timeline group: "Today", "Yesterday", "Earlier This Week" or "Feb 2026" (IST). */
export function activityGroupLabel(input: string, now: number = Date.now()): string {
  const ms = Date.parse(input);
  if (Number.isNaN(ms)) return "Earlier";
  const diff = istDay(now) - istDay(ms);
  if (diff === 0) return "Today";
  if (diff === 1) return "Yesterday";
  if (diff > 1 && diff <= istWeekday(now)) return "Earlier This Week";
  const p = new Date(ms + IST_OFFSET_MS);
  return `${MONTHS[p.getUTCMonth()]} ${p.getUTCFullYear()}`;
}

/** Task group on the opportunity Tasks tab: Overdue, Today, This Week or Later (IST). */
export function taskDueGroup(
  dueAt: string | null,
  status: string,
  now: number = Date.now(),
): "Overdue" | "Today" | "This Week" | "Later" {
  if (!dueAt) return "Later";
  const ms = Date.parse(dueAt);
  if (Number.isNaN(ms)) return "Later";
  if (status === "pending" && ms < now) return "Overdue";
  const diff = istDay(ms) - istDay(now);
  if (diff <= 0) return "Today";
  if (diff < 7 - istWeekday(now)) return "This Week";
  return "Later";
}

/** "2.1 MB", "340 KB", "800 B". */
export function formatFileSize(bytes: number): string {
  if (bytes >= 1_000_000) return `${(bytes / 1_000_000).toFixed(1)} MB`;
  if (bytes >= 1_000) return `${Math.round(bytes / 1_000)} KB`;
  return `${bytes} B`;
}

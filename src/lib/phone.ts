/**
 * Phone number helpers. Pure functions, covered by phone.regression.ts.
 *
 * Compass stores agent and lead numbers as plain digits, normally the 10-digit Indian mobile
 * number (e.g. "9871107094"). Lead numbers may also carry a country code (10–15 digits).
 */

const digitsOnly = (s: string) => s.replace(/\D/g, "");

/**
 * Reduce user input to a 10-digit Indian mobile number, or null if it isn't one.
 * Accepts "98711 07094", "+91 98711-07094", "09871107094", "919871107094".
 */
export function toIndianMobile(input: string): string | null {
  let d = digitsOnly(input);
  if (d.length === 12 && d.startsWith("91")) d = d.slice(2);
  else if (d.length === 11 && d.startsWith("0")) d = d.slice(1);
  return /^[6-9]\d{9}$/.test(d) ? d : null;
}

/**
 * Convert a Compass lead number to E.164 for dialing. 10 digits are treated as Indian;
 * a number that already carries a country code keeps it. Returns null when it can't be dialed.
 */
export function toE164(phone: string | null | undefined): string | null {
  if (!phone) return null;
  const trimmed = phone.trim();
  const d = digitsOnly(trimmed);
  if (d.length === 0) return null;

  const indian = toIndianMobile(trimmed);
  if (indian) return `+91${indian}`;

  // Explicit international number, or 11–15 digits that already include a country code.
  if ((trimmed.startsWith("+") || d.length > 10) && d.length >= 11 && d.length <= 15 && !d.startsWith("0")) {
    return `+${d}`;
  }
  return null;
}

/** Mask the middle digits for list views: "9871107094" → "98•••••094". */
export function maskPhone(phone: string | null | undefined): string {
  if (!phone) return "No number";
  const d = digitsOnly(phone);
  const local = d.length === 12 && d.startsWith("91") ? d.slice(2) : d;
  if (local.length < 6) return local;
  return `${local.slice(0, 2)}${"•".repeat(local.length - 5)}${local.slice(-3)}`;
}

/** Readable full number for the lead screen: "+91 98711 07094". */
export function formatPhone(phone: string | null | undefined): string {
  const e164 = toE164(phone);
  if (!e164) return phone?.trim() || "No number";
  if (e164.startsWith("+91") && e164.length === 13) {
    return `+91 ${e164.slice(3, 8)} ${e164.slice(8)}`;
  }
  return e164;
}

/**
 * WhatsApp chat link for a number: "https://wa.me/919876500001". Opens the WhatsApp app (or its
 * web page when the app isn't installed) on Android and iOS, without extra app permissions.
 * null when the number can't be dialed.
 */
export function whatsAppUrl(phone: string | null | undefined): string | null {
  const e164 = toE164(phone);
  return e164 ? `https://wa.me/${e164.slice(1)}` : null;
}

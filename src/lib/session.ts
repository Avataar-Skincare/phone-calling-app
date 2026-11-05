/**
 * Session helpers. Pure functions, covered by session.regression.ts.
 *
 * Compass issues a JWT that lasts 15 hours (auth.module.ts) and has no refresh endpoint, so
 * when it expires the agent logs in again. We read the expiry from the token's `exp` claim and
 * fall back to issue time + 15 h if the claim can't be read.
 */
import type { CompassUser } from "@/types/compass";

export const SESSION_TTL_MS = 15 * 60 * 60 * 1000;
/** Treat the session as expired slightly early so a request never goes out with a dying token. */
const EXPIRY_MARGIN_MS = 60 * 1000;

export interface Session {
  token: string;
  user: CompassUser;
  /** epoch ms */
  expiresAt: number;
}

const B64 = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";

/** base64url → UTF-8 string, without relying on atob/Buffer (works in Hermes and Node). */
function decodeBase64Url(input: string): string {
  const s = input.replace(/-/g, "+").replace(/_/g, "/");
  const bytes: number[] = [];
  let buffer = 0;
  let bits = 0;
  for (const ch of s) {
    if (ch === "=") break;
    const v = B64.indexOf(ch);
    if (v < 0) throw new Error("invalid base64");
    buffer = (buffer << 6) | v;
    bits += 6;
    if (bits >= 8) {
      bits -= 8;
      bytes.push((buffer >> bits) & 0xff);
    }
  }
  return decodeURIComponent(bytes.map((b) => `%${b.toString(16).padStart(2, "0")}`).join(""));
}

/** `exp` claim of a JWT in epoch ms, or null if absent/unreadable. */
export function jwtExpiryMs(token: string): number | null {
  const part = token.split(".")[1];
  if (!part) return null;
  try {
    const payload = JSON.parse(decodeBase64Url(part)) as { exp?: unknown };
    return typeof payload.exp === "number" ? payload.exp * 1000 : null;
  } catch {
    return null;
  }
}

export function buildSession(token: string, user: CompassUser, now: number = Date.now()): Session {
  return { token, user, expiresAt: jwtExpiryMs(token) ?? now + SESSION_TTL_MS };
}

export function isSessionExpired(session: Pick<Session, "expiresAt">, now: number = Date.now()): boolean {
  return now >= session.expiresAt - EXPIRY_MARGIN_MS;
}

/** Parse a stored session, rejecting anything malformed instead of crashing on it. */
export function parseStoredSession(raw: string | null): Session | null {
  if (!raw) return null;
  try {
    const s = JSON.parse(raw) as Partial<Session>;
    if (
      typeof s.token !== "string" ||
      typeof s.expiresAt !== "number" ||
      !s.user ||
      typeof s.user.id === "undefined"
    ) {
      return null;
    }
    return s as Session;
  } catch {
    return null;
  }
}

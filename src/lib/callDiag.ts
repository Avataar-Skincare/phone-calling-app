/**
 * Small diagnostics sent with a call whose talk time could not be read (ADR 0011). Pure builder,
 * covered by callDiag.test.ts. Only permission states, a yes/no/unknown flag, a lookup reason and
 * the phone and app model. Never a number other than the lead's own, never call-log contents.
 */

export type GrantState = "granted" | "denied";
export type LogVisible = "yes" | "no" | "unknown";
export type LookupReason = "no_permission" | "not_found" | "number_mismatch" | "error";

export interface CallDiag {
  phone: GrantState;
  phone_state: GrantState;
  call_log: GrantState;
  /** Did the phone show any call-log entries from the last 30 days? */
  call_log_visible: LogVisible;
  /** Why the lookup of this call failed. */
  lookup: LookupReason;
  /** "<Brand> <Model> · Android <Release>" */
  device: string;
  /** "<app version> (<native build>)" */
  app: string;
}

type LookupDebug = { permission: boolean; outgoingSince: number; matchedNumber: boolean };

export interface CallDiagInput {
  /** From the capabilities; null when they could not be read. */
  canDirectDial: boolean | null;
  canChooseSim: boolean | null;
  canReadCallLog: boolean | null;
  /** getCallLogVisibleCount(): -1 unknown. */
  visibleCount: number;
  /** getCallLogLookupDebug(); null when it could not be read. */
  debug: LookupDebug | null;
  brand?: string | null;
  model?: string | null;
  release?: string | number | null;
  appVersion?: string | null;
  nativeBuild?: string | null;
}

function grant(v: boolean | null): GrantState {
  return v === true ? "granted" : "denied";
}

export function logVisible(count: number): LogVisible {
  return count > 0 ? "yes" : count === 0 ? "no" : "unknown";
}

/** Why the lookup failed, from the counts the phone gave. */
export function lookupReason(debug: LookupDebug | null, canReadCallLog: boolean | null): LookupReason {
  if (!debug) return canReadCallLog === false ? "no_permission" : "error";
  if (!debug.permission) return "no_permission";
  if (debug.outgoingSince > 0 && !debug.matchedNumber) return "number_mismatch";
  return "not_found";
}

/** "Xiaomi Redmi Note 12 · Android 14" */
export function deviceLabel(
  brand?: string | null,
  model?: string | null,
  release?: string | number | null,
): string {
  const name = [brand, model]
    .map((s) => (s ?? "").trim())
    .filter(Boolean)
    .join(" ");
  const rel = release === null || release === undefined ? "" : String(release).trim();
  return [name || "Unknown phone", rel ? `Android ${rel}` : ""].filter(Boolean).join(" · ");
}

/** "1.0.0 (12)", or just the version when the build number is not known. */
export function appLabel(version?: string | null, nativeBuild?: string | null): string {
  const v = (version ?? "").trim() || "unknown";
  const b = (nativeBuild ?? "").trim();
  return b ? `${v} (${b})` : v;
}

export function buildCallDiag(i: CallDiagInput): CallDiag {
  return {
    phone: grant(i.canDirectDial),
    phone_state: grant(i.canChooseSim),
    call_log: grant(i.canReadCallLog),
    call_log_visible: logVisible(i.visibleCount),
    lookup: lookupReason(i.debug, i.canReadCallLog),
    device: deviceLabel(i.brand, i.model, i.release),
    app: appLabel(i.appVersion, i.nativeBuild),
  };
}

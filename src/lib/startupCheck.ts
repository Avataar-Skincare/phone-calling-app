/**
 * The "Before you start" check (ADR 0011). Pure rules, covered by startupCheck.test.ts.
 *
 * REQUIRED  blocks calling, no Skip: phone access or call-log access is missing (ADR 0008).
 * WARNING   has Skip, remembered for 24 h: call-log access is on but the phone shows no call log.
 * TIP       never blocks: on Google Phone, how to share recordings to the app. (The recordings
 *           folder is NOT asked for here — only in Settings and on the recording screen, by request
 *           2026-11-13.)
 */

export type IssueId = "phone" | "call_log" | "hidden_log" | "recordings_google";
export type Severity = "required" | "warning" | "tip";

export interface StartupIssue {
  id: IssueId;
  severity: Severity;
}

export interface StartupInput {
  /** CALL_PHONE granted; null = could not be read (not an issue). */
  phone: boolean | null;
  /** READ_PHONE_STATE granted. */
  phoneState: boolean | null;
  /** READ_CALL_LOG granted. */
  callLog: boolean | null;
  /** Call-log entries the phone shows from the last 30 days; -1 = unknown. */
  callLogVisible: number;
  /** Default dialer package, null = unknown. */
  dialerPackage: string | null;
  /** epoch ms when the agent last skipped the hidden-log warning; null = never. */
  skippedHiddenLogAt: number | null;
}

export const GOOGLE_PHONE_PACKAGE = "com.google.android.dialer";
/** A skipped warning stays quiet this long. */
export const SKIP_MS = 24 * 60 * 60 * 1000;

/** True while a skip is still in force. A skip dated in the future (clock change) counts as expired. */
export function skipIsActive(skippedAt: number | null, now: number): boolean {
  return skippedAt !== null && now >= skippedAt && now - skippedAt < SKIP_MS;
}

export function isGooglePhone(pkg: string | null): boolean {
  return pkg === GOOGLE_PHONE_PACKAGE;
}

/** Everything the agent should know about, most important first. */
export function evaluateStartup(i: StartupInput, now: number): StartupIssue[] {
  const out: StartupIssue[] = [];
  if (i.phone === false || i.phoneState === false) out.push({ id: "phone", severity: "required" });
  if (i.callLog === false) out.push({ id: "call_log", severity: "required" });
  if (i.callLog === true && i.callLogVisible === 0 && !skipIsActive(i.skippedHiddenLogAt, now)) {
    out.push({ id: "hidden_log", severity: "warning" });
  }
  if (isGooglePhone(i.dialerPackage)) out.push({ id: "recordings_google", severity: "tip" });
  return out;
}

export function hasRequired(issues: StartupIssue[]): boolean {
  return issues.some((x) => x.severity === "required");
}

/** The screen opens by itself for a required issue or an un-skipped warning, never for tips alone. */
export function shouldShowSetup(issues: StartupIssue[]): boolean {
  return issues.some((x) => x.severity === "required" || x.severity === "warning");
}

/**
 * Call session state machine and call times. Pure functions, covered by callState.test.ts.
 *
 *   dialing ──▶ in_call ──▶ ended
 *      └──────────────────────▲   (also: discarded when no call ever started)
 *
 * Inputs are the raw native events from modules/sim-dialer:
 *   Android: "offhook" (call live, includes outgoing ringing) and "idle" (no call).
 *            Android also fires the CURRENT state ("idle") the moment tracking starts; that must
 *            not end a session that hasn't started yet.
 *   iOS:     "dialing" → "connected" (answered) → "ended", outgoing calls only.
 *
 * When events are missing (app killed mid-call, Android without READ_PHONE_STATE, Expo Go), the
 * session is resolved when the app returns to the foreground, using the phone's current call
 * state. Such end times are marked approximate.
 */

export type CallStatus = "dialing" | "in_call" | "ended";
export type CallPlatform = "android" | "ios" | "fallback";
export type NativeState = "idle" | "offhook" | "ringing" | "dialing" | "connected" | "ended" | "unknown";

export interface CallTarget {
  name: string;
  /** E.164, e.g. +919871107094 */
  phone: string;
  opportunityId: string | null;
  leadId: string | null;
  taskId: string | null;
}

export interface CallSession extends CallTarget {
  id: string;
  platform: CallPlatform;
  /** Native call-state events are expected for this session. */
  tracked: boolean;
  /** "direct" = placed by the app; "dialer" = dialer opened, agent pressed call. */
  mode: "direct" | "dialer" | null;
  simId: string | null;
  status: CallStatus;
  /** epoch ms: agent tapped the call button */
  tappedAt: number;
  /** First sign the call is live (Android offhook / iOS dialing). */
  startedAt: number | null;
  /** iOS only: the other side answered. */
  connectedAt: number | null;
  endedAt: number | null;
  /** true / false on iOS; null when the platform can't tell (Android, fallback). */
  connected: boolean | null;
  /** End time was inferred on app resume rather than reported by the phone. */
  endApproximate: boolean;
}

/**
 * A tracked session with no call start after this long is treated as "the call did happen but we
 * missed its events" rather than "the agent cancelled". Below it, no start means cancelled.
 */
export const CANCEL_WINDOW_MS = 15_000;

/** Events older than the tap (with a little clock slack) belong to an earlier call. */
const STALE_SLACK_MS = 1_000;

export function createSession(
  target: CallTarget,
  opts: { platform: CallPlatform; tracked: boolean; simId: string | null; now?: number; id?: string },
): CallSession {
  const now = opts.now ?? Date.now();
  return {
    ...target,
    id: opts.id ?? `${now.toString(36)}-${Math.random().toString(36).slice(2, 8)}`,
    platform: opts.platform,
    tracked: opts.tracked,
    mode: null,
    simId: opts.simId,
    status: "dialing",
    tappedAt: now,
    startedAt: null,
    connectedAt: null,
    endedAt: null,
    connected: null,
    endApproximate: false,
  };
}

export function applyCallEvent(
  s: CallSession,
  e: { state: NativeState; at: number; connected?: boolean },
): CallSession {
  if (s.status === "ended") return s;
  if (e.at < s.tappedAt - STALE_SLACK_MS) return s;

  switch (e.state) {
    case "offhook": // Android: call is live
      return { ...s, status: "in_call", startedAt: s.startedAt ?? e.at };

    case "dialing": // iOS: outgoing call started, not answered yet
      return { ...s, startedAt: s.startedAt ?? e.at };

    case "connected": // iOS: answered
      return {
        ...s,
        status: "in_call",
        startedAt: s.startedAt ?? e.at,
        connectedAt: s.connectedAt ?? e.at,
        connected: true,
      };

    case "ended": // iOS
      if (s.startedAt === null) return s;
      return {
        ...s,
        status: "ended",
        endedAt: e.at,
        connected: e.connected ?? s.connectedAt !== null,
      };

    case "idle": // Android: only meaningful after the call went off-hook
      if (s.startedAt === null) return s;
      return { ...s, status: "ended", endedAt: e.at, connected: null };

    default: // "ringing" = incoming call; "unknown"
      return s;
  }
}

/**
 * Settle a session when the app comes back to the foreground.
 * Returns the (possibly updated) session, or null when the call never happened and the session
 * should be discarded.
 */
export function resolveOnResume(s: CallSession, native: NativeState, now: number): CallSession | null {
  if (s.status === "ended") return s;
  // Still on the phone: leave it alone.
  if (native === "offhook" || native === "dialing" || native === "connected") return s;

  if (s.startedAt === null) {
    // Tracked, nothing started, back quickly: the agent cancelled (iOS prompt) or the call failed.
    if (s.tracked && now - s.tappedAt < CANCEL_WINDOW_MS) return null;
    // Untracked (or events lost): we can't tell; treat it as a call that ended now.
    return { ...s, status: "ended", endedAt: now, endApproximate: true };
  }

  // Started, and the phone is no longer in a call, but the end event never arrived.
  return { ...s, status: "ended", endedAt: now, endApproximate: true };
}

/**
 * The three times recorded for every call, named like Compass's call activities
 * (`total_duration_seconds`, `talk_time_seconds`, `ring_time_seconds`).
 *
 *   total = call end − call start (the phone began dialing; ADR 0005). Falls back to the tap on
 *           Call only when no start event arrived. The time before dialing (iPhone's confirm
 *           prompt, the dialer, app delay) is not call time and is not counted.
 *   talk  = time after the client answered (0 = not answered)
 *   ring  = total − talk
 *
 * Talk time: iOS reports the answer moment (end − connectedAt; 0 when it ended unanswered).
 * Android reports no answer moment, so it comes from the call log (`logTalkSeconds`); without it
 * talk and ring are null and only the total is known.
 */
export interface CallTimes {
  totalDurationSeconds: number;
  talkTimeSeconds: number | null;
  ringTimeSeconds: number | null;
  /** true = answered, false = not answered, null = unknown. */
  answered: boolean | null;
}

export function callTimes(s: CallSession, logTalkSeconds?: number | null): CallTimes {
  const start = s.startedAt ?? s.tappedAt;
  const end = s.endedAt ?? start;
  const total = Math.max(0, Math.round((end - start) / 1000));

  let talk: number | null = null;
  if (s.platform === "ios") {
    if (s.connectedAt !== null) talk = Math.max(0, Math.round((end - s.connectedAt) / 1000));
    else if (s.connected === false) talk = 0;
  } else if (typeof logTalkSeconds === "number" && Number.isFinite(logTalkSeconds)) {
    talk = Math.max(0, Math.round(logTalkSeconds));
  }
  // The call log counts from the answer to its own end time; never let talk exceed the total.
  if (talk !== null) talk = Math.min(talk, total);

  return {
    totalDurationSeconds: total,
    talkTimeSeconds: talk,
    ringTimeSeconds: talk === null ? null : total - talk,
    answered: talk === null ? (s.connected ?? null) : talk > 0,
  };
}

/** "3 min 12 s", "45 s", "0 s", "1 h 2 min". */
export function formatDuration(seconds: number | null): string {
  if (seconds === null) return "";
  if (seconds < 60) return `${seconds} s`;
  const m = Math.floor(seconds / 60);
  if (m < 60) return `${m} min ${seconds % 60} s`;
  return `${Math.floor(m / 60)} h ${m % 60} min`;
}

/**
 * Call → Compass "Manual Outbound Call" activity (ADR 0005 + 0006). Pure functions, covered by
 * callLog.test.ts.
 */
import type { CallTimes } from "./callState";

export const CALL_ACTIVITY_TYPE = "manual_outbound_call";

/** What the app knows about a finished call (a subset of the stored FinishedCall). */
export interface CallForLog extends CallTimes {
  id: string;
  userId: string | null;
  agentName: string | null;
  /** E.164 */
  phone: string;
  opportunityId: string | null;
  platform: "android" | "ios" | "fallback";
  simId: string | null;
  /** epoch ms: tap on Call */
  tappedAt: number;
  /** epoch ms: the call went live (null when no event arrived) */
  startedAt: number | null;
  endedAt: number;
  approximate: boolean;
}

export interface CallLogRequest {
  phone: string;
  activity_type: typeof CALL_ACTIVITY_TYPE;
  opportunity_id?: string;
  /**
   * When the call happened (its end), ISO UTC. Compass uses it as the activity time when it is at
   * most 2 days old, so a call sent late after being offline still lands at the right time.
   */
  occurred_at: string;
  data: Record<string, string | number>;
}

/**
 * Compass finds the lead with `LIKE '%<digits>'`, so send the last 10 digits only: a leading 91
 * can miss leads stored without it.
 */
export function compassPhone(e164: string): string {
  return e164.replace(/\D/g, "").slice(-10);
}

const iso = (ms: number) => new Date(ms).toISOString();

/**
 * POST /api/activities/log body. Never sends `create_if_missing` (the app must not create leads).
 *   call_duration_seconds  total: call start → end (tap time only if no start event)
 *   call_talk_seconds      talk time (iOS: answer → end; Android: call log)
 *   call_ring_seconds      total − talk
 * Talk and ring are left out when unknown.
 */
export function buildCallLogRequest(call: CallForLog): CallLogRequest {
  const data: Record<string, string | number> = {
    call_tapped_at: iso(call.tappedAt),
    call_started_at: iso(call.startedAt ?? call.tappedAt),
    call_ended_at: iso(call.endedAt),
    call_duration_seconds: call.totalDurationSeconds,
    call_answered: call.answered === null ? "unknown" : call.answered ? "yes" : "no",
    call_end_estimated: call.approximate ? "yes" : "no",
    call_platform: call.platform,
    call_source: "mobile_app",
    app_session_id: call.id,
  };
  if (call.userId) data.agent_user_id = call.userId;
  if (call.agentName) data.agent_name = call.agentName;
  if (call.talkTimeSeconds !== null) data.call_talk_seconds = call.talkTimeSeconds;
  if (call.ringTimeSeconds !== null) data.call_ring_seconds = call.ringTimeSeconds;
  if (call.simId) data.call_sim = call.simId;

  return {
    phone: compassPhone(call.phone),
    activity_type: CALL_ACTIVITY_TYPE,
    ...(call.opportunityId ? { opportunity_id: call.opportunityId } : {}),
    occurred_at: iso(call.endedAt),
    data,
  };
}

/** Retry delay after `attempts` failed sends: 1 min, 2, 4, … capped at 30 min. */
export function retryDelayMs(attempts: number): number {
  return Math.min(60_000 * 2 ** Math.max(0, attempts - 1), 30 * 60_000);
}

/**
 * What to do with a failed send. Network trouble, 401 (the agent logs in again), 408, 429 and 5xx
 * are retried; anything else (400 validation, 403, 404) won't succeed by retrying.
 */
export function isRetryable(status: number): boolean {
  return status === 0 || status === 401 || status === 408 || status === 429 || status >= 500;
}

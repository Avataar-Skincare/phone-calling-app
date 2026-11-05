/**
 * Offline outcome queue rules. Pure functions, covered by outcome.test.ts.
 *
 * An outcome is queued only when Compass couldn't be reached or had a temporary problem, or the
 * session ended (401) mid-save. Anything Compass actively rejected (400, 403, 404) is a real error
 * the agent has to see, so it is never retried blindly.
 */
import type { ActivityFormPayload } from "@/types/compass";

export interface QueuedOutcome {
  id: string;
  /** Compass user who recorded it; only that user's session sends it. */
  userId: string;
  opportunityId: string;
  leadName: string;
  payload: ActivityFormPayload;
  createdAt: number;
  attempts: number;
  /** epoch ms; not retried automatically before this */
  nextAttemptAt: number;
  status: "pending" | "failed";
  lastError: string | null;
}

const BASE_DELAY_MS = 30_000;
const MAX_DELAY_MS = 10 * 60_000;

/** 30 s, 1 min, 2 min, 4 min, 8 min, then every 10 min. */
export function retryDelayMs(attempts: number): number {
  return Math.min(MAX_DELAY_MS, BASE_DELAY_MS * 2 ** Math.max(0, attempts - 1));
}

export type FailureKind = "retry" | "reject";

/**
 * How to treat a failed save, from its HTTP status (0 = never reached Compass).
 *  retry : no network, timeout, rate limit, server error, or logged out (401) mid-save
 *  reject: Compass refused it (validation, not your lead, not found)
 */
export function classifyFailure(status: number): FailureKind {
  if (status === 0 || status === 401 || status === 408 || status === 429 || status >= 500) return "retry";
  return "reject";
}

/** Items the current user's session should send now, oldest first. */
export function dueItems(items: QueuedOutcome[], userId: string, now: number): QueuedOutcome[] {
  return items
    .filter((i) => i.userId === userId && i.status === "pending" && i.nextAttemptAt <= now)
    .sort((a, b) => a.createdAt - b.createdAt);
}

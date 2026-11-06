import { logCallActivity } from "@/api/activities";
import { ApiError } from "@/api/client";
import { buildCallLogRequest, isRetryable, retryDelayMs } from "@/lib/callLog";
import { useAuthStore } from "@/store/auth.store";
import { useCallLog } from "@/store/callLog.store";

let flushing: Promise<void> | null = null;

/**
 * Send the logged-in agent's due calls to Compass, oldest first (ADR 0005). Each call is sent with
 * the agent's own token, so other agents' calls on a shared phone wait for them to log in.
 * Compass replies 200 even on failure: success is a non-null `activity_id`.
 */
export function flushCallLog(): Promise<void> {
  flushing ??= run().finally(() => {
    flushing = null;
  });
  return flushing;
}

async function run() {
  const userId = useAuthStore.getState().session?.user.id;
  if (userId === undefined) return;
  const store = useCallLog.getState();
  const now = Date.now();
  const due = store.calls
    .filter((c) => c.status === "pending" && c.userId === String(userId) && c.nextAttemptAt <= now)
    .reverse();

  for (const call of due) {
    try {
      const res = await logCallActivity(buildCallLogRequest(call));
      if (res?.activity_id) {
        store.update(call.id, { status: "sent", activityId: String(res.activity_id), lastError: null });
      } else {
        store.update(call.id, {
          status: "failed",
          lastError: res?.message || "Compass didn't save the call.",
        });
      }
    } catch (e) {
      const status = e instanceof ApiError ? e.status : 0;
      const message = e instanceof Error ? e.message : "Couldn't reach Compass.";
      if (isRetryable(status)) {
        const attempts = call.attempts + 1;
        store.update(call.id, {
          attempts,
          nextAttemptAt: Date.now() + retryDelayMs(attempts),
          lastError: message,
        });
        // Offline or logged out: the rest would fail the same way.
        if (status === 0 || status === 401) break;
      } else {
        store.update(call.id, { status: "failed", lastError: message });
      }
    }
  }
}

/** Try every unsent call of the logged-in agent again, now. */
export function retryAllCalls(): Promise<void> {
  const userId = String(useAuthStore.getState().session?.user.id ?? "");
  const store = useCallLog.getState();
  for (const c of store.calls) {
    if (c.userId === userId && c.status !== "sent")
      store.update(c.id, { status: "pending", nextAttemptAt: 0 });
  }
  return flushCallLog();
}

/** Drop the logged-in agent's calls that Compass refused. */
export function discardFailedCalls(): void {
  const userId = String(useAuthStore.getState().session?.user.id ?? "");
  const store = useCallLog.getState();
  for (const c of store.calls) if (c.userId === userId && c.status === "failed") store.remove(c.id);
}

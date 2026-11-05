import { submitActivityForm } from "@/api/activityForm";
import { ApiError } from "@/api/client";
import { queryClient } from "@/api/queryClient";
import { useAuthStore } from "@/store/auth.store";
import { useOutcomeQueue } from "@/store/outcomeQueue.store";
import type { ActivityFormPayload } from "@/types/compass";
import { classifyFailure, dueItems, retryDelayMs } from "./queue";

export type SaveResult =
  { kind: "saved" } | { kind: "queued" } | { kind: "rejected"; status: number; message: string };

function errorInfo(e: unknown): { status: number; message: string } {
  if (e instanceof ApiError) return { status: e.status, message: e.message };
  return { status: 0, message: e instanceof Error ? e.message : "Unknown error" };
}

function refreshAfterSave(opportunityId: string) {
  void queryClient.invalidateQueries({ queryKey: ["smart-views"] });
  void queryClient.invalidateQueries({ queryKey: ["opportunity", opportunityId] });
}

/**
 * Send an outcome now. If Compass can't be reached (or had a temporary problem), queue it and
 * report "queued"; it is retried in the background. If Compass refuses it, report "rejected" so
 * the agent can see why.
 */
export async function saveOutcome(args: {
  opportunityId: string;
  leadName: string;
  userId: string;
  payload: ActivityFormPayload;
}): Promise<SaveResult> {
  try {
    await submitActivityForm(args.opportunityId, args.payload);
    refreshAfterSave(args.opportunityId);
    return { kind: "saved" };
  } catch (e) {
    const { status, message } = errorInfo(e);
    if (classifyFailure(status) === "reject") return { kind: "rejected", status, message };

    const now = Date.now();
    useOutcomeQueue.getState().add({
      id: `${now.toString(36)}-${Math.random().toString(36).slice(2, 8)}`,
      userId: args.userId,
      opportunityId: args.opportunityId,
      leadName: args.leadName,
      payload: args.payload,
      createdAt: now,
      attempts: 1,
      nextAttemptAt: now + retryDelayMs(1),
      status: "pending",
      lastError: message,
    });
    return { kind: "queued" };
  }
}

let flushing = false;

/** Send every due queued outcome for the logged-in user, one at a time. Safe to call often. */
export async function flushOutcomeQueue(): Promise<void> {
  const userId = useAuthStore.getState().session?.user.id;
  if (flushing || userId === undefined) return;
  flushing = true;
  try {
    const queue = useOutcomeQueue.getState();
    for (const item of dueItems(queue.items, String(userId), Date.now())) {
      // Stop if the session ended part-way (401 signs the agent out).
      if (!useAuthStore.getState().session) break;
      try {
        await submitActivityForm(item.opportunityId, item.payload);
        useOutcomeQueue.getState().remove(item.id);
        refreshAfterSave(item.opportunityId);
      } catch (e) {
        const { status, message } = errorInfo(e);
        if (classifyFailure(status) === "retry")
          useOutcomeQueue.getState().retryLater(item.id, message, Date.now());
        else useOutcomeQueue.getState().fail(item.id, message);
      }
    }
  } finally {
    flushing = false;
  }
}

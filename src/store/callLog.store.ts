import { create } from "zustand";
import { persist } from "zustand/middleware";

import type { CallForLog } from "@/lib/callLog";
import { persistStorage } from "./persistStorage";

/**
 * A call placed from the app, with its times, and whether it has reached Compass as a
 * "Manual Outbound Call" activity (ADR 0005). Kept on the phone so nothing is lost offline.
 */
export interface FinishedCall extends CallForLog {
  name: string;
  leadId: string | null;
  taskId: string | null;
  /** pending = not in Compass yet (retried); sent = logged; failed = Compass refused it. */
  status: "pending" | "sent" | "failed";
  attempts: number;
  /** epoch ms; 0 = send now */
  nextAttemptAt: number;
  lastError: string | null;
  activityId: string | null;
  /** The agent closed the summary card. */
  dismissed: boolean;
}

/** Oldest calls drop off beyond this (sent ones first in practice, since they're older). */
export const MAX_FINISHED_CALLS = 200;

interface CallLogState {
  /** Newest first. */
  calls: FinishedCall[];
  add: (call: FinishedCall) => void;
  update: (id: string, patch: Partial<FinishedCall>) => void;
  remove: (id: string) => void;
  dismiss: (id: string) => void;
}

export const useCallLog = create<CallLogState>()(
  persist(
    (set) => ({
      calls: [],
      add: (call) =>
        set((s) => ({
          calls: [call, ...s.calls.filter((c) => c.id !== call.id)].slice(0, MAX_FINISHED_CALLS),
        })),
      update: (id, patch) =>
        set((s) => ({ calls: s.calls.map((c) => (c.id === id ? { ...c, ...patch } : c)) })),
      remove: (id) => set((s) => ({ calls: s.calls.filter((c) => c.id !== id) })),
      dismiss: (id) =>
        set((s) => ({ calls: s.calls.map((c) => (c.id === id ? { ...c, dismissed: true } : c)) })),
    }),
    { name: "call-log", storage: persistStorage, version: 1 },
  ),
);

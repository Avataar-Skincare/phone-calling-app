import { create } from "zustand";
import { persist } from "zustand/middleware";

import { retryDelayMs, type QueuedOutcome } from "@/features/outcome/queue";
import { persistStorage } from "./persistStorage";

interface OutcomeQueueState {
  items: QueuedOutcome[];
  add: (item: QueuedOutcome) => void;
  remove: (id: string) => void;
  /** Temporary failure: count the attempt and schedule the next one. */
  retryLater: (id: string, error: string, now: number) => void;
  /** Compass refused it: stop retrying, show it to the agent. */
  fail: (id: string, error: string) => void;
  /** Agent tapped Retry: make every item due now (failed ones too). */
  makeAllDue: () => void;
}

/** Outcomes waiting to reach Compass. Persisted, so nothing is lost if the app is closed. */
export const useOutcomeQueue = create<OutcomeQueueState>()(
  persist(
    (set) => ({
      items: [],
      add: (item) => set((s) => ({ items: [...s.items, item] })),
      remove: (id) => set((s) => ({ items: s.items.filter((i) => i.id !== id) })),
      retryLater: (id, error, now) =>
        set((s) => ({
          items: s.items.map((i) =>
            i.id === id
              ? {
                  ...i,
                  attempts: i.attempts + 1,
                  nextAttemptAt: now + retryDelayMs(i.attempts + 1),
                  lastError: error,
                  status: "pending",
                }
              : i,
          ),
        })),
      fail: (id, error) =>
        set((s) => ({
          items: s.items.map((i) => (i.id === id ? { ...i, status: "failed", lastError: error } : i)),
        })),
      makeAllDue: () =>
        set((s) => ({ items: s.items.map((i) => ({ ...i, status: "pending", nextAttemptAt: 0 })) })),
    }),
    { name: "outcome-queue", storage: persistStorage, version: 1 },
  ),
);

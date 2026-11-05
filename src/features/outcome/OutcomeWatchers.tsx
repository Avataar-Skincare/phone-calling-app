import { useEffect, useRef } from "react";
import { AppState } from "react-native";
import { router, usePathname } from "expo-router";

import { useAuthStore } from "@/store/auth.store";
import { useCallStore } from "@/store/call.store";
import { useOutcomeQueue } from "@/store/outcomeQueue.store";
import { flushOutcomeQueue } from "./saveOutcome";

const FLUSH_INTERVAL_MS = 15_000;

/**
 * Background helpers for signed-in users. Renders nothing.
 *  - Opens the outcome sheet as soon as a call ends (once per call).
 *  - Sends queued outcomes: on start, on every return to the foreground, and every 15 s while
 *    anything is waiting.
 */
export function OutcomeWatchers() {
  const pathname = usePathname();
  const session = useCallStore((s) => s.session);
  const prompted = useRef<string | null>(null);

  useEffect(() => {
    if (!session || session.status !== "ended") return;
    if (pathname === "/outcome" || prompted.current === session.id) return;
    if (AppState.currentState !== "active") return;
    prompted.current = session.id;
    router.push("/outcome");
  }, [session, pathname]);

  const userId = useAuthStore((s) => s.session?.user.id);
  const waiting = useOutcomeQueue((s) => s.items.some((i) => i.status === "pending"));

  useEffect(() => {
    if (userId === undefined) return;
    void flushOutcomeQueue();
    const sub = AppState.addEventListener("change", (s) => {
      if (s === "active") void flushOutcomeQueue();
    });
    return () => sub.remove();
  }, [userId]);

  useEffect(() => {
    if (!waiting || userId === undefined) return;
    const t = setInterval(() => void flushOutcomeQueue(), FLUSH_INTERVAL_MS);
    return () => clearInterval(t);
  }, [waiting, userId]);

  return null;
}

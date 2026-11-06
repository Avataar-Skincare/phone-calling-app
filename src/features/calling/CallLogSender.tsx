import { useEffect } from "react";
import { AppState } from "react-native";

import { useAuthStore } from "@/store/auth.store";
import { useCallLog } from "@/store/callLog.store";
import { flushCallLog } from "./sendCalls";

const FLUSH_INTERVAL_MS = 15_000;

/**
 * Sends finished calls to Compass in the background. Renders nothing; mounted once for signed-in
 * users. Sends on start, on every return to the foreground, and every 15 s while any are waiting.
 */
export function CallLogSender() {
  const userId = useAuthStore((s) => s.session?.user.id);
  const waiting = useCallLog((s) =>
    s.calls.some((c) => c.status === "pending" && c.userId === String(userId)),
  );

  useEffect(() => {
    if (userId === undefined) return;
    void flushCallLog();
    const sub = AppState.addEventListener("change", (s) => {
      if (s === "active") void flushCallLog();
    });
    return () => sub.remove();
  }, [userId]);

  useEffect(() => {
    if (!waiting) return;
    const t = setInterval(() => void flushCallLog(), FLUSH_INTERVAL_MS);
    return () => clearInterval(t);
  }, [waiting]);

  return null;
}

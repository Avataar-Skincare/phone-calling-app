import { useEffect } from "react";
import { AppState } from "react-native";
import { router } from "expo-router";

import { promptExpired, shouldPromptRecording } from "@/lib/recordingPrompt";
import { useAuthStore } from "@/store/auth.store";
import { useCallLog } from "@/store/callLog.store";
import { canUploadRecording } from "./useCallRecording";

/**
 * Opens the Upload call recording screen by itself when a call has just ended. Renders nothing;
 * mounted once for signed-in users.
 *  - Only calls that appear after the app started (old calls never open it).
 *  - Only for the signed-in agent's answered Android calls with no recording uploaded yet.
 *  - Once per call: Skip never brings it back.
 *  - If the app is in the background when the call is saved, it opens when the app is active again
 *    (within 10 minutes of the call end).
 */
export function RecordingPrompt() {
  useEffect(() => {
    const known = new Set(useCallLog.getState().calls.map((c) => c.id));
    /** Calls waiting to be prompted: id → whether the app was in the background when saved. */
    const pending = new Map<string, boolean>();

    const check = () => {
      const now = Date.now();
      const userId = useAuthStore.getState().session?.user.id;
      const active = AppState.currentState === "active";
      const { calls } = useCallLog.getState();

      for (const [id, inBackground] of [...pending]) {
        const call = calls.find((c) => c.id === id);
        if (!call || promptExpired({ endedAt: call.endedAt, now, finishedInBackground: inBackground })) {
          pending.delete(id);
          continue;
        }
        const mine = call.userId === null || call.userId === String(userId);
        if (!mine || !canUploadRecording(call) || call.recording?.status === "uploaded") {
          pending.delete(id);
          continue;
        }
        if (
          shouldPromptRecording({
            endedAt: call.endedAt,
            now,
            appActive: active,
            finishedInBackground: inBackground,
          })
        ) {
          pending.delete(id);
          router.push({ pathname: "/recording", params: { callId: id } });
          return; // one screen at a time
        }
      }
    };

    const unsubscribe = useCallLog.subscribe((state) => {
      for (const call of state.calls) {
        if (known.has(call.id)) continue;
        known.add(call.id);
        pending.set(call.id, AppState.currentState !== "active");
      }
      check();
    });
    const sub = AppState.addEventListener("change", (s) => {
      if (s === "active") check();
    });
    return () => {
      unsubscribe();
      sub.remove();
    };
  }, []);

  return null;
}

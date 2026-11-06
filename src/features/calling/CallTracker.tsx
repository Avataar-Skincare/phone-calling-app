import { useEffect } from "react";
import { AppState } from "react-native";

import * as SimDialer from "@modules/sim-dialer";
import { useCallStore } from "@/store/call.store";
import { finishCall } from "./callFlow";

/**
 * Wakes the call session up. Renders nothing; mounted once for signed-in users.
 *  - Forwards native call-state events to the session.
 *  - When the app returns to the foreground (or starts after being killed), settles a session
 *    whose end event was missed, using the phone's current call state.
 *  - Once a call has ended, records its talk, ringing and total time (finishCall).
 *
 * The resume check waits briefly: on iOS, call-observer callbacks queued while the app was in the
 * background are delivered just after it becomes active, and they are more precise than a guess.
 */
const RESUME_SETTLE_MS = 800;

export function CallTracker() {
  useEffect(() => {
    const sub = SimDialer.addCallStateListener((e) => useCallStore.getState().applyEvent(e));

    const finishIfEnded = () => {
      const s = useCallStore.getState().session;
      if (s?.status === "ended") void finishCall(s);
    };
    finishIfEnded(); // a call that ended while the app was closed
    const unsubscribe = useCallStore.subscribe(finishIfEnded);

    let timer: ReturnType<typeof setTimeout> | null = null;
    const settle = () => {
      if (timer) clearTimeout(timer);
      timer = setTimeout(async () => {
        if (!useCallStore.getState().session) return;
        const state = await SimDialer.getCallState().catch(() => "unknown" as const);
        useCallStore.getState().resume(state, Date.now());
      }, RESUME_SETTLE_MS);
    };

    // Tracking may only be possible once permissions exist (Android 12+); retry on every resume.
    void SimDialer.startTracking();
    settle();

    const appSub = AppState.addEventListener("change", (s) => {
      if (s === "active") {
        void SimDialer.startTracking();
        settle();
      }
    });

    return () => {
      sub.remove();
      unsubscribe();
      appSub.remove();
      if (timer) clearTimeout(timer);
    };
  }, []);

  return null;
}

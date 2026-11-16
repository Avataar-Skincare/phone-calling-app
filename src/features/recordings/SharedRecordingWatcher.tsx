import { useEffect } from "react";
import { AppState } from "react-native";
import { router } from "expo-router";

import * as SimDialer from "@modules/sim-dialer";
import type { SharedRecording } from "@modules/sim-dialer";
import { useSharedRecording } from "@/store/sharedRecording.store";

/**
 * Opens the Upload call recording screen when the agent shares a recording to the app
 * (Phone → Recents → call → recording → Share → Compass Dialer; ADR 0010). Renders nothing;
 * mounted once in the signed-in part of the app, so a file shared while signed out waits in the
 * native module until the agent has signed in.
 *  - On start and whenever the app comes to the front: take a file the native side is holding
 *    (this is also how a share that started the app arrives).
 *  - While running: the native "sharedRecording" event.
 *  - A file already on screen is not opened twice.
 */
export function SharedRecordingWatcher() {
  useEffect(() => {
    let alive = true;

    const receive = (file: SharedRecording) => {
      if (!alive) return;
      const store = useSharedRecording.getState();
      const current = store.file;
      if (current && current.uri === file.uri && current.sharedAt === file.sharedAt) return;
      store.set(file);
      // The screen is already open for an earlier file: it shows the new one in place.
      if (!current) router.push({ pathname: "/recording", params: { shared: "1" } });
    };

    const take = () => {
      void SimDialer.takeSharedRecording().then((file) => {
        if (file) receive(file);
      });
    };

    take();
    const event = SimDialer.addSharedRecordingListener((file) => {
      receive(file);
      // The native side also holds it as "pending": take it so it isn't delivered again.
      void SimDialer.takeSharedRecording();
    });
    const appState = AppState.addEventListener("change", (s) => {
      if (s === "active") take();
    });
    return () => {
      alive = false;
      event.remove();
      appState.remove();
    };
  }, []);

  return null;
}

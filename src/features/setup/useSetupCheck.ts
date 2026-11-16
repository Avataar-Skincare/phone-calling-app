import { useCallback, useEffect, useState } from "react";
import { AppState } from "react-native";

import * as SimDialer from "@modules/sim-dialer";
import { evaluateStartup, isGooglePhone, type StartupIssue } from "@/lib/startupCheck";
import { useSettingsStore } from "@/store/settings.store";
import { gatherStartupInput } from "./gatherStartupInput";

/**
 * The current issues for the "Before you start" screen. null until the first answer. Looks again
 * when the app comes back to the foreground (the agent may have used Settings) and whenever the
 * skip changes.
 */
export function useSetupCheck() {
  const [issues, setIssues] = useState<StartupIssue[] | null>(null);
  const skippedAt = useSettingsStore((s) => s.hiddenLogSkippedAt);

  const [tick, setTick] = useState(0);
  /** Look again now. */
  const refresh = useCallback(() => setTick((t) => t + 1), []);

  useEffect(() => {
    let live = true;
    void gatherStartupInput().then((input) => {
      if (live) setIssues(input ? evaluateStartup(input, Date.now()) : []);
    });
    return () => {
      live = false;
    };
  }, [tick, skippedAt]);

  useEffect(() => {
    const sub = AppState.addEventListener("change", (state) => {
      if (state === "active") refresh();
    });
    return () => sub.remove();
  }, [refresh]);

  return { issues, refresh };
}

/** Whether the phone's own dialer is Google Phone (recordings are shared from it). */
export function useIsGooglePhone(): boolean {
  const [google, setGoogle] = useState(false);
  useEffect(() => {
    let live = true;
    void SimDialer.getDefaultDialerPackage().then((p) => {
      if (live) setGoogle(isGooglePhone(p));
    });
    return () => {
      live = false;
    };
  }, []);
  return google;
}

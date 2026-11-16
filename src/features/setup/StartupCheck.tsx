import { useEffect, useRef } from "react";
import { AppState } from "react-native";
import { router, usePathname } from "expo-router";

import { evaluateStartup, shouldShowSetup } from "@/lib/startupCheck";
import { gatherStartupInput } from "./gatherStartupInput";

/** App-open and return-to-foreground checks closer than this are one check. */
const MIN_GAP_MS = 1_000;
/** Screens the check must not cover: it is already there, or the agent is fixing permissions. */
const LEAVE_ALONE = ["/setup-check", "/permissions"];

/**
 * "Before you start" (ADR 0011). Runs when the main stack mounts (the agent is signed in) and each
 * time the app returns to the foreground, and opens the setup screen when something REQUIRED is
 * missing or the phone is hiding call logs (and the agent has not skipped that in the last 24 h).
 * Renders nothing. Android with the native module only.
 */
export function StartupCheck() {
  const pathname = usePathname();
  const pathRef = useRef(pathname);
  useEffect(() => {
    pathRef.current = pathname;
  }, [pathname]);

  useEffect(() => {
    let last = 0;
    let live = true;
    const run = async () => {
      const now = Date.now();
      if (now - last < MIN_GAP_MS) return;
      last = now;
      const input = await gatherStartupInput();
      if (!live || !input) return;
      if (!shouldShowSetup(evaluateStartup(input, Date.now()))) return;
      if (LEAVE_ALONE.includes(pathRef.current)) return;
      router.push("/setup-check");
    };
    void run();
    const sub = AppState.addEventListener("change", (state) => {
      if (state === "active") void run();
    });
    return () => {
      live = false;
      sub.remove();
    };
  }, []);

  return null;
}

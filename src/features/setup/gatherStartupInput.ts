import { Platform } from "react-native";

import * as SimDialer from "@modules/sim-dialer";
import type { StartupInput } from "@/lib/startupCheck";
import { useSettingsStore } from "@/store/settings.store";

/**
 * What the phone says right now, for the "Before you start" check (ADR 0011).
 * null when the check does not apply: iOS, or a build without the native module (Expo Go).
 * Counts and package names only; nothing from the call log leaves the phone.
 */
export async function gatherStartupInput(): Promise<StartupInput | null> {
  if (Platform.OS !== "android" || !SimDialer.isNativeDialerAvailable) return null;
  const caps = await SimDialer.getCapabilities().catch(() => null);
  if (!caps) return null;

  const [callLogVisible, dialerPackage] = await Promise.all([
    caps.canReadCallLog ? SimDialer.getCallLogVisibleCount() : Promise.resolve(-1),
    SimDialer.getDefaultDialerPackage(),
  ]);
  const settings = useSettingsStore.getState();
  return {
    phone: caps.canDirectDial,
    phoneState: caps.canChooseSim,
    callLog: caps.canReadCallLog,
    callLogVisible,
    dialerPackage,
    skippedHiddenLogAt: settings.hiddenLogSkippedAt,
  };
}

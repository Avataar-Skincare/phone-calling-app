import { Platform } from "react-native";
import Constants from "expo-constants";

import * as SimDialer from "@modules/sim-dialer";
import { buildCallDiag, type CallDiag } from "@/lib/callDiag";

interface AndroidConstants {
  Brand?: string;
  Model?: string;
  Release?: string | number;
}

/**
 * Gather the diagnostics for ONE call whose talk time could not be read (ADR 0011). Counts and
 * states only. Never throws: every part falls back to "unknown".
 *
 * @param phone the lead's number, used only to ask the phone WHY its call-log lookup found nothing
 */
export async function collectCallDiag(phone: string, sinceMs: number): Promise<CallDiag> {
  const [caps, visibleCount, debug] = await Promise.all([
    SimDialer.getCapabilities().catch(() => null),
    SimDialer.getCallLogVisibleCount().catch(() => -1),
    SimDialer.getCallLogLookupDebug(phone, sinceMs).catch(() => null),
  ]);
  const device = (Platform.constants ?? {}) as AndroidConstants;
  return buildCallDiag({
    canDirectDial: caps ? caps.canDirectDial : null,
    canChooseSim: caps ? caps.canChooseSim : null,
    canReadCallLog: caps ? caps.canReadCallLog : null,
    visibleCount,
    debug,
    brand: device.Brand,
    model: device.Model,
    release: device.Release,
    appVersion: Constants.expoConfig?.version ?? null,
    nativeBuild: Constants.nativeBuildVersion ?? null,
  });
}

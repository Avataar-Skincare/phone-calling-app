import * as SimDialer from "@modules/sim-dialer";
import { prefetchActivityFormConfig } from "@/features/outcome/useActivityFormConfig";
import { createSession, type CallTarget } from "@/lib/callState";
import { useCallStore } from "@/store/call.store";
import { useSettingsStore } from "@/store/settings.store";

/**
 * Place a call and open a call session for it.
 *
 * The session is stored BEFORE dialing so the first native event (which can arrive within
 * milliseconds on Android) is never missed. If dialing fails, the session is removed again.
 */
export async function startCall(target: CallTarget): Promise<void> {
  const caps = await SimDialer.getCapabilities();
  const simId = caps.canChooseSim ? useSettingsStore.getState().simId : null;
  const session = createSession(target, {
    platform: caps.platform,
    tracked: caps.canTrack,
    simId,
  });

  const store = useCallStore.getState();
  store.start(session);
  // Load the outcome form during the call, so it opens instantly and survives a network drop.
  prefetchActivityFormConfig(target.opportunityId);
  try {
    const mode = await SimDialer.placeCall(target.phone, simId);
    useCallStore.getState().setMode(session.id, mode);
  } catch (e) {
    if (useCallStore.getState().session?.id === session.id) useCallStore.getState().clear();
    throw e;
  }
}

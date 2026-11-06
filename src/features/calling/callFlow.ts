import * as SimDialer from "@modules/sim-dialer";
import { callTimes, createSession, type CallSession, type CallTarget } from "@/lib/callState";
import { useAuthStore } from "@/store/auth.store";
import { useCallLog } from "@/store/callLog.store";
import { useCallStore } from "@/store/call.store";
import { flushCallLog } from "./sendCalls";
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
  try {
    const mode = await SimDialer.placeCall(target.phone, simId);
    useCallStore.getState().setMode(session.id, mode);
  } catch (e) {
    if (useCallStore.getState().session?.id === session.id) useCallStore.getState().clear();
    throw e;
  }
}

/** Android writes the call-log entry a moment after the call ends: look this many times, 1 s apart. */
export const CALL_LOG_ATTEMPTS = 4;
const CALL_LOG_RETRY_MS = 1_000;
/** Call-log times can sit slightly before the tap (clock rounding). */
const CALL_LOG_SLACK_MS = 5_000;

const finishing = new Set<string>();

/**
 * Record an ended call: talk time (iOS from the session, Android from the call log), ringing and
 * total time; keep it on the phone (`useCallLog`); clear the session; send it to Compass as a
 * "Manual Outbound Call" activity (ADR 0005). Runs once per call.
 */
export async function finishCall(session: CallSession): Promise<void> {
  if (session.status !== "ended" || finishing.has(session.id)) return;
  finishing.add(session.id);
  try {
    let logTalk: number | null = null;
    if (session.platform === "android") {
      for (let i = 0; i < CALL_LOG_ATTEMPTS && logTalk === null; i++) {
        if (i > 0) await new Promise((r) => setTimeout(r, CALL_LOG_RETRY_MS));
        const entry = await SimDialer.getLastCallFromLog(
          session.phone,
          session.tappedAt - CALL_LOG_SLACK_MS,
        ).catch(() => null);
        logTalk = entry?.talkSeconds ?? null;
      }
    }

    const user = useAuthStore.getState().session?.user;
    useCallLog.getState().add({
      ...callTimes(session, logTalk),
      id: session.id,
      userId: user ? String(user.id) : null,
      agentName: user?.name ?? null,
      name: session.name,
      phone: session.phone,
      opportunityId: session.opportunityId,
      leadId: session.leadId,
      taskId: session.taskId,
      platform: session.platform,
      simId: session.simId,
      tappedAt: session.tappedAt,
      startedAt: session.startedAt,
      endedAt: session.endedAt ?? session.tappedAt,
      approximate: session.endApproximate,
      status: "pending",
      attempts: 0,
      nextAttemptAt: 0,
      lastError: null,
      activityId: null,
      dismissed: false,
    });
  } finally {
    finishing.delete(session.id);
    // A new call may already have replaced this one; only clear our own.
    if (useCallStore.getState().session?.id === session.id) useCallStore.getState().clear();
  }
  void flushCallLog();
}

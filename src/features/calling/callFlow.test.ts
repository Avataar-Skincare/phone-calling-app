/// <reference types="jest" />
/// <reference types="node" />
/**
 * Integration: placing a call wires the native module and the call store; finishing a call records
 * its talk, ringing and total time.
 */
import * as SimDialer from "@modules/sim-dialer";
import { applyCallEvent, createSession, type CallSession } from "@/lib/callState";
import { useCallLog } from "@/store/callLog.store";
import { useCallStore } from "@/store/call.store";
import { useSettingsStore } from "@/store/settings.store";
import { fakeCompass } from "../../../tests/support/compass";
import { resetAppState, signedInAs } from "../../../tests/support/state";
import { CALL_LOG_ATTEMPTS, finishCall, startCall } from "./callFlow";

jest.mock("@modules/sim-dialer");
const dialer = SimDialer as typeof SimDialer & {
  __reset: () => void;
  __setCapabilities: (c: object) => void;
  __setCallLog: (e: { talkSeconds: number; startedAt: number } | null) => void;
  __setCallLogVisible: (n: number) => void;
  __setLookupDebug: (
    d: { permission: boolean; outgoingSince: number; matchedNumber: boolean } | null,
  ) => void;
};

const target = {
  name: "Asha Rao",
  phone: "+919876500001",
  opportunityId: "7001",
  leadId: "501",
  taskId: "9001",
};

beforeEach(async () => {
  await resetAppState();
  dialer.__reset();
  signedInAs();
});

describe("startCall", () => {
  it("stores the session before dialing, so the first call event is never missed", async () => {
    fakeCompass();
    let sessionWhenDialing: unknown;
    (dialer.placeCall as jest.Mock).mockImplementationOnce(async () => {
      sessionWhenDialing = useCallStore.getState().session;
      return "direct";
    });

    await startCall(target);

    expect(sessionWhenDialing).toMatchObject({ status: "dialing", name: "Asha Rao", tracked: true });
    expect(useCallStore.getState().session).toMatchObject({ mode: "direct", platform: "android" });
  });

  it("dials the E.164 number on the chosen SIM", async () => {
    fakeCompass();
    useSettingsStore.getState().setSimId("sim-2");
    await startCall(target);
    expect(dialer.placeCall).toHaveBeenCalledWith("+919876500001", "sim-2");
  });

  it("ignores the saved SIM when the phone can't choose one", async () => {
    fakeCompass();
    dialer.__setCapabilities({ canChooseSim: false });
    useSettingsStore.getState().setSimId("sim-2");
    await startCall(target);
    expect(dialer.placeCall).toHaveBeenCalledWith("+919876500001", null);
  });

  it("removes the session again if dialing fails", async () => {
    fakeCompass();
    (dialer.placeCall as jest.Mock).mockRejectedValueOnce(
      new Error("This phone has no app that can place calls."),
    );
    await expect(startCall(target)).rejects.toThrow(/no app that can place calls/);
    expect(useCallStore.getState().session).toBeNull();
  });

  it("records an untracked session when call state can't be read", async () => {
    fakeCompass();
    dialer.__setCapabilities({ canTrack: false, canDirectDial: false });
    await startCall(target);
    expect(useCallStore.getState().session).toMatchObject({ tracked: false, mode: "dialer" });
  });
});

describe("finishCall", () => {
  const T = 1_800_000_000_000;
  beforeEach(() => {
    fakeCompass();
  });
  /** A call tapped at T, dialing at T+1 s, ended at T+`endS` s (so total = endS − 1). */
  function ended(platform: "android" | "ios", endS: number, answerS?: number): CallSession {
    let s = createSession(target, { platform, tracked: true, simId: null, now: T, id: "c1" });
    if (platform === "android") {
      s = applyCallEvent(s, { state: "offhook", at: T + 1_000 });
      s = applyCallEvent(s, { state: "idle", at: T + endS * 1_000 });
    } else {
      s = applyCallEvent(s, { state: "dialing", at: T + 1_000 });
      if (answerS !== undefined) s = applyCallEvent(s, { state: "connected", at: T + answerS * 1_000 });
      s = applyCallEvent(s, { state: "ended", at: T + endS * 1_000, connected: answerS !== undefined });
    }
    useCallStore.getState().start(s);
    return s;
  }

  it("Android: takes talk time from the call log; ringing = total − talk", async () => {
    dialer.__setCallLog({ talkSeconds: 80, startedAt: T + 500 });
    await finishCall(ended("android", 100));

    expect(dialer.getLastCallFromLog).toHaveBeenCalledWith("+919876500001", T - 5_000);
    expect(useCallLog.getState().calls[0]).toMatchObject({
      id: "c1",
      userId: "31",
      name: "Asha Rao",
      opportunityId: "7001",
      taskId: "9001",
      totalDurationSeconds: 99,
      talkTimeSeconds: 80,
      ringTimeSeconds: 19,
      answered: true,
    });
    expect(useCallStore.getState().session).toBeNull();
  });

  it("Android: a call log entry with 0 s talk time is a call that wasn't answered", async () => {
    dialer.__setCallLog({ talkSeconds: 0, startedAt: T + 500 });
    await finishCall(ended("android", 35));
    expect(useCallLog.getState().calls[0]).toMatchObject({
      totalDurationSeconds: 34,
      talkTimeSeconds: 0,
      ringTimeSeconds: 34,
      answered: false,
    });
  });

  it("Android: waits for the call log entry, then keeps the total only if it never appears", async () => {
    jest.useFakeTimers();
    try {
      const done = finishCall(ended("android", 60));
      await jest.advanceTimersByTimeAsync(10_000);
      await done;
    } finally {
      jest.useRealTimers();
    }
    expect(dialer.getLastCallFromLog).toHaveBeenCalledTimes(CALL_LOG_ATTEMPTS);
    expect(useCallLog.getState().calls[0]).toMatchObject({
      totalDurationSeconds: 59,
      talkTimeSeconds: null,
      ringTimeSeconds: null,
      answered: null,
    });
    expect(useCallStore.getState().session).toBeNull();
  });

  it("iOS: uses the answer time the phone reported, no call log", async () => {
    await finishCall(ended("ios", 200, 9));
    expect(dialer.getLastCallFromLog).not.toHaveBeenCalled();
    expect(useCallLog.getState().calls[0]).toMatchObject({
      totalDurationSeconds: 199,
      talkTimeSeconds: 191,
      ringTimeSeconds: 8,
      answered: true,
    });
  });

  it("records each call once and leaves a newer call alone", async () => {
    dialer.__setCallLog({ talkSeconds: 10, startedAt: T });
    const first = ended("android", 30);
    const next = { ...first, id: "c2", status: "in_call" as const };
    const running = finishCall(first);
    useCallStore.getState().start(next); // the agent already dialed the next lead
    await Promise.all([running, finishCall(first)]);

    expect(useCallLog.getState().calls).toHaveLength(1);
    expect(useCallStore.getState().session?.id).toBe("c2");
  });

  it("Android: marks granted when the call log is readable", async () => {
    dialer.__setCallLog({ talkSeconds: 10, startedAt: T });
    await finishCall(ended("android", 30));
    expect(useCallLog.getState().calls[0]).toMatchObject({ callLogPermission: "granted" });
  });

  it("Android: marks denied when call log is unreadable", async () => {
    // Access revoked after the pre-call check: the call is still logged, flagged for the audit.
    dialer.__setCapabilities({ canReadCallLog: false });
    jest.useFakeTimers();
    try {
      const done = finishCall(ended("android", 30));
      await jest.advanceTimersByTimeAsync(10_000);
      await done;
    } finally {
      jest.useRealTimers();
    }
    expect(useCallLog.getState().calls[0]).toMatchObject({
      callLogPermission: "denied",
      talkTimeSeconds: null,
    });
  });

  describe("call_diag (ADR 0011)", () => {
    async function finishWithoutLogEntry(endS = 30) {
      jest.useFakeTimers();
      try {
        const done = finishCall(ended("android", endS));
        await jest.advanceTimersByTimeAsync(10_000);
        await done;
      } finally {
        jest.useRealTimers();
      }
    }

    it("is kept when talk time is missing: the phone shows no call log", async () => {
      dialer.__setCallLogVisible(0);
      await finishWithoutLogEntry();
      expect(dialer.getCallLogLookupDebug).toHaveBeenCalledWith("+919876500001", T - 5_000);
      expect(useCallLog.getState().calls[0]).toMatchObject({
        talkTimeSeconds: null,
        callDiag: {
          phone: "granted",
          phone_state: "granted",
          call_log: "granted",
          call_log_visible: "no",
          lookup: "not_found",
        },
      });
      expect(useCallLog.getState().calls[0]?.callDiag?.device).toMatch(/Android|Unknown phone/);
    });

    it("says why: outgoing calls seen but none to this number", async () => {
      dialer.__setLookupDebug({ permission: true, outgoingSince: 2, matchedNumber: false });
      await finishWithoutLogEntry();
      expect(useCallLog.getState().calls[0]?.callDiag).toMatchObject({
        call_log_visible: "yes",
        lookup: "number_mismatch",
      });
    });

    it("says why: access revoked", async () => {
      dialer.__setCapabilities({ canReadCallLog: false });
      await finishWithoutLogEntry();
      expect(useCallLog.getState().calls[0]?.callDiag).toMatchObject({
        call_log: "denied",
        call_log_visible: "unknown",
        lookup: "no_permission",
      });
    });

    it("falls back to error when the phone cannot explain", async () => {
      (dialer.getCallLogLookupDebug as jest.Mock).mockResolvedValue(null);
      await finishWithoutLogEntry();
      expect(useCallLog.getState().calls[0]?.callDiag).toMatchObject({ lookup: "error" });
    });

    it("is not collected when talk time was read (not even a 0 s answer)", async () => {
      dialer.__setCallLog({ talkSeconds: 0, startedAt: T + 500 });
      await finishCall(ended("android", 35));
      expect(dialer.getCallLogLookupDebug).not.toHaveBeenCalled();
      expect(dialer.getCallLogVisibleCount).not.toHaveBeenCalled();
      expect(useCallLog.getState().calls[0]?.callDiag).toBeNull();
    });

    it("is not collected on iOS", async () => {
      await finishCall(ended("ios", 200, 9));
      expect(dialer.getCallLogLookupDebug).not.toHaveBeenCalled();
      expect(useCallLog.getState().calls[0]?.callDiag).toBeNull();
    });
  });

  it("iOS: leaves call_log_permission unset", async () => {
    await finishCall(ended("ios", 200, 9));
    expect(useCallLog.getState().calls[0]?.callLogPermission).toBeNull();
  });

  it("ignores a call that hasn't ended", async () => {
    const s = createSession(target, { platform: "android", tracked: true, simId: null, now: T, id: "c3" });
    await finishCall(s);
    expect(useCallLog.getState().calls).toEqual([]);
  });
});

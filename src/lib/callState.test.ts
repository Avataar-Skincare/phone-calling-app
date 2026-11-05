/// <reference types="jest" />
import {
  applyCallEvent,
  callDurations,
  CANCEL_WINDOW_MS,
  createSession,
  formatDuration,
  resolveOnResume,
  type CallSession,
} from "./callState";

const target = {
  name: "Asha Rao",
  phone: "+919876500001",
  opportunityId: "7001",
  leadId: "501",
  taskId: null,
};
const T = 1_800_000_000_000;
const android = () =>
  createSession(target, { platform: "android", tracked: true, simId: null, now: T, id: "a" });
const ios = () => createSession(target, { platform: "ios", tracked: true, simId: null, now: T, id: "i" });
const run = (s: CallSession, events: [string, number, boolean?][]) =>
  events.reduce(
    (acc, [state, dt, connected]) => applyCallEvent(acc, { state: state as never, at: T + dt, connected }),
    s,
  );

describe("createSession", () => {
  it("starts dialing with nothing recorded yet", () => {
    const s = android();
    expect(s).toMatchObject({
      status: "dialing",
      tappedAt: T,
      startedAt: null,
      endedAt: null,
      connected: null,
    });
  });
});

describe("Android events", () => {
  it("offhook → idle ends the call with a duration", () => {
    const s = run(android(), [
      ["idle", 10],
      ["offhook", 500],
      ["idle", 95_500],
    ]);
    expect(s).toMatchObject({ status: "ended", startedAt: T + 500, endedAt: T + 95_500, connected: null });
    expect(callDurations(s)).toEqual({ totalSeconds: 95, talkSeconds: null });
  });

  it("ignores the idle Android reports when tracking starts", () => {
    expect(run(android(), [["idle", 10]]).status).toBe("dialing");
  });

  it("ignores an incoming call ringing during the call", () => {
    expect(
      run(android(), [
        ["offhook", 500],
        ["ringing", 1000],
      ]).status,
    ).toBe("in_call");
  });
});

describe("iOS events", () => {
  it("dialing → connected → ended records answer and talk time", () => {
    const s = run(ios(), [
      ["dialing", 3_000],
      ["connected", 9_000],
      ["ended", 201_000, true],
    ]);
    expect(s).toMatchObject({ status: "ended", connected: true });
    expect(callDurations(s)).toEqual({ totalSeconds: 198, talkSeconds: 192 });
  });

  it("records an unanswered call", () => {
    const s = run(ios(), [
      ["dialing", 3_000],
      ["ended", 33_000, false],
    ]);
    expect(s.connected).toBe(false);
    expect(callDurations(s)).toEqual({ totalSeconds: 30, talkSeconds: null });
  });

  it("ignores an end event without a start (another call)", () => {
    expect(run(ios(), [["ended", 2_000, false]]).status).toBe("dialing");
  });
});

describe("event hygiene", () => {
  it("ignores events from before the tap", () => {
    expect(run(android(), [["offhook", -5_000]]).status).toBe("dialing");
  });

  it("never changes an ended session", () => {
    const done = run(android(), [
      ["offhook", 100],
      ["idle", 200],
    ]);
    expect(run(done, [["offhook", 300]])).toBe(done);
  });
});

describe("resolveOnResume", () => {
  it("discards a tracked call that never started (iOS prompt cancelled)", () => {
    expect(resolveOnResume(ios(), "idle", T + 4_000)).toBeNull();
  });

  it("leaves a live call alone", () => {
    const live = run(android(), [["offhook", 500]]);
    expect(resolveOnResume(live, "offhook", T + 60_000)).toBe(live);
  });

  it("ends a started call whose end event was lost, marked approximate", () => {
    const live = run(android(), [["offhook", 500]]);
    expect(resolveOnResume(live, "idle", T + 60_000)).toMatchObject({
      status: "ended",
      endedAt: T + 60_000,
      endApproximate: true,
    });
  });

  it("keeps a tracked call with no start after the cancel window", () => {
    const s = resolveOnResume(ios(), "idle", T + CANCEL_WINDOW_MS + 1)!;
    expect(s).toMatchObject({ status: "ended", startedAt: null });
    expect(callDurations(s)).toEqual({ totalSeconds: 15, talkSeconds: null });
  });

  it("keeps an untracked call for the agent to confirm", () => {
    const untracked = createSession(target, { platform: "fallback", tracked: false, simId: null, now: T });
    expect(resolveOnResume(untracked, "unknown", T + 2_000)?.status).toBe("ended");
  });
});

describe("formatDuration", () => {
  it.each([
    [45, "45 s"],
    [192, "3 min 12 s"],
    [3_720, "1 h 2 min"],
    [null, ""],
  ])("%s → %s", (secs, label) => {
    expect(formatDuration(secs as number | null)).toBe(label);
  });
});

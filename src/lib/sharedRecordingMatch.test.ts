/// <reference types="jest" />
import { matchSharedRecording, recordingTimeFromName, type CallForShare } from "./sharedRecordingMatch";

/** 2026-11-13 16:04:35 IST = 10:34:35 UTC */
const REAL = Date.UTC(2026, 10, 13, 10, 34, 35);

function call(id: string, tapped: number, ended: number, extra: Partial<CallForShare> = {}): CallForShare {
  return { id, userId: "31", tappedAt: tapped, startedAt: null, endedAt: ended, ...extra };
}

describe("recordingTimeFromName", () => {
  it("reads the Google Phone name: epoch ms", () => {
    expect(recordingTimeFromName("record-1794566075519.wav")).toBe(1794566075519);
    // 16:04:35 IST on 13 Nov 2026
    expect(new Date(1794566075519 + 5.5 * 3600_000).toISOString()).toBe("2026-11-13T16:04:35.519Z");
  });

  it("reads date and time names as IST", () => {
    expect(recordingTimeFromName("20261113_160435.m4a")).toBe(REAL);
    expect(recordingTimeFromName("Call 2026-11-13 16-04-35.mp3")).toBe(REAL);
    expect(recordingTimeFromName("rec_2026-11-13T16:04:35.amr")).toBe(REAL);
  });

  it("returns null for names with no time", () => {
    expect(recordingTimeFromName("voice.wav")).toBeNull();
    expect(recordingTimeFromName("record-12345.wav")).toBeNull();
    // 13 digits but not a plausible date
    expect(recordingTimeFromName("record-0000000000000.wav")).toBeNull();
    expect(recordingTimeFromName("20261313_160435.m4a")).toBeNull();
  });
});

describe("matchSharedRecording", () => {
  const t = 1794566075519;
  const a = call("a", t - 15_000, t + 85_000); // 16:04:20 - 16:06:00
  const time = recordingTimeFromName("record-1794566075519.wav");

  it("matches the call that holds the recording start", () => {
    const m = matchSharedRecording(time, [a], t + 3_600_000, "31");
    expect(m.best?.id).toBe("a");
    expect(m.candidates.map((c) => c.id)).toEqual(["a"]);
  });

  it("allows a minute of slack on both sides", () => {
    expect(matchSharedRecording(t - 70_000, [a], t + 3_600_000, "31").best?.id).toBe("a");
    expect(matchSharedRecording(t + 140_000, [a], t + 3_600_000, "31").best?.id).toBe("a");
    expect(matchSharedRecording(t - 90_000, [a], t + 3_600_000, "31").best).toBeNull();
  });

  it("gives no best when the time is outside every call, but lists the calls", () => {
    const b = call("b", t + 600_000, t + 700_000);
    const m = matchSharedRecording(t + 3_000_000, [a, b], t + 3_600_000, "31");
    expect(m.best).toBeNull();
    expect(m.candidates.map((c) => c.id)).toEqual(["b", "a"]);
  });

  it("picks the call that started closest when several match", () => {
    const early = call("early", t - 100_000, t + 30_000, { startedAt: t - 90_000 });
    const close = call("close", t - 20_000, t + 60_000, { startedAt: t - 10_000 });
    expect(matchSharedRecording(t, [early, close], t + 1000, "31").best?.id).toBe("close");
  });

  it("without a time, uses the newest call that ended in the last 30 minutes", () => {
    const now = t + 20 * 60_000;
    expect(matchSharedRecording(null, [a], now, "31").best?.id).toBe("a");
    expect(matchSharedRecording(null, [a], t + 40 * 60_000, "31").best).toBeNull();
    const newer = call("newer", t + 200_000, t + 260_000);
    expect(matchSharedRecording(null, [a, newer], now, "31").best?.id).toBe("newer");
  });

  it("ignores another agent's calls, and counts calls with no user as mine", () => {
    const other = call("other", t - 15_000, t + 85_000, { userId: "99" });
    expect(matchSharedRecording(t, [other], t + 1000, "31")).toEqual({ best: null, candidates: [] });
    const noUser = call("nu", t - 15_000, t + 85_000, { userId: null });
    expect(matchSharedRecording(t, [noUser], t + 1000, "31").best?.id).toBe("nu");
  });

  it("ignores calls older than 2 days", () => {
    const now = t + 3 * 24 * 3600_000;
    expect(matchSharedRecording(t, [a], now, "31")).toEqual({ best: null, candidates: [] });
  });
});

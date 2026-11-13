/// <reference types="jest" />
import { promptExpired, shouldPromptRecording } from "./recordingPrompt";

const base = { endedAt: 1_000_000, appActive: true, finishedInBackground: false };

describe("shouldPromptRecording", () => {
  it("prompts a call that just ended", () => {
    expect(shouldPromptRecording({ ...base, now: base.endedAt + 5_000 })).toBe(true);
  });
  it("does not prompt after 2 minutes", () => {
    expect(shouldPromptRecording({ ...base, now: base.endedAt + 121_000 })).toBe(false);
  });
  it("waits while the app is in the background", () => {
    expect(shouldPromptRecording({ ...base, appActive: false, now: base.endedAt + 1_000 })).toBe(false);
  });
  it("gives 10 minutes to a call that ended in the background", () => {
    const b = { ...base, finishedInBackground: true };
    expect(shouldPromptRecording({ ...b, now: base.endedAt + 9 * 60_000 })).toBe(true);
    expect(shouldPromptRecording({ ...b, now: base.endedAt + 11 * 60_000 })).toBe(false);
  });
});

describe("promptExpired", () => {
  it("expires after the limit", () => {
    expect(promptExpired({ endedAt: 0, now: 119_000, finishedInBackground: false })).toBe(false);
    expect(promptExpired({ endedAt: 0, now: 121_000, finishedInBackground: false })).toBe(true);
    expect(promptExpired({ endedAt: 0, now: 121_000, finishedInBackground: true })).toBe(false);
  });
});

/// <reference types="jest" />
import type { RecordingFile } from "@modules/sim-dialer";
import {
  MAX_RECORDING_BYTES,
  matchRecording,
  recordingContentType,
  recordingProblem,
  recordingWindow,
} from "./recordingMatch";

const MIN = 60_000;
const call = { tappedAt: 1_000_000_000_000, endedAt: 1_000_000_000_000 + 2 * MIN, phone: "+919876500001" };

const file = (over: Partial<RecordingFile>): RecordingFile => ({
  uri: "content://f/" + (over.name ?? "x"),
  name: "rec.m4a",
  sizeBytes: 2_000_000,
  lastModified: call.endedAt + 5_000,
  mimeType: "audio/mp4",
  ...over,
});

describe("recordingWindow", () => {
  it("runs from 1 minute before the tap to 10 minutes after the end", () => {
    expect(recordingWindow(call)).toEqual({ from: call.tappedAt - MIN, to: call.endedAt + 10 * MIN });
  });
});

describe("matchRecording", () => {
  it("returns nothing for no files", () => {
    expect(matchRecording(call, [])).toEqual({ best: null, candidates: [] });
  });

  it("ignores files outside the window", () => {
    const early = file({ name: "a.m4a", lastModified: call.tappedAt - 2 * MIN });
    const late = file({ name: "b.m4a", lastModified: call.endedAt + 11 * MIN });
    expect(matchRecording(call, [early, late])).toEqual({ best: null, candidates: [] });
  });

  it("includes the window edges", () => {
    const a = file({ name: "a.m4a", lastModified: call.tappedAt - MIN });
    const b = file({ name: "b.m4a", lastModified: call.endedAt + 10 * MIN });
    expect(matchRecording(call, [a, b]).candidates).toHaveLength(2);
  });

  it("prefers the file closest to the call end", () => {
    const near = file({ name: "near.m4a", lastModified: call.endedAt + 1_000 });
    const far = file({ name: "far.m4a", lastModified: call.endedAt + 4 * MIN });
    const m = matchRecording(call, [far, near]);
    expect(m.best).toBe(near);
    expect(m.candidates).toEqual([near, far]);
  });

  it("prefers a file named with the number over a closer one without", () => {
    const named = file({
      name: "Call recording Asha_9876500001_261106.m4a",
      lastModified: call.endedAt + 4 * MIN,
    });
    const closer = file({ name: "Call recording Someone_261106.m4a", lastModified: call.endedAt + 1_000 });
    expect(matchRecording(call, [closer, named]).best).toBe(named);
  });

  it("matches on 7 digits when the name has no country code", () => {
    const named = file({ name: "Rec_6500001.m4a", lastModified: call.endedAt + 3 * MIN });
    const closer = file({ name: "other.m4a", lastModified: call.endedAt + 1_000 });
    expect(matchRecording(call, [closer, named]).best).toBe(named);
  });

  it("does not match on fewer than 7 digits", () => {
    const short = file({ name: "Rec_500001.m4a", lastModified: call.endedAt + 3 * MIN });
    const closer = file({ name: "other.m4a", lastModified: call.endedAt + 1_000 });
    expect(matchRecording(call, [short, closer]).best).toBe(closer);
  });

  it("never picks a file that can't be uploaded as best", () => {
    const huge = file({ name: "big.m4a", sizeBytes: MAX_RECORDING_BYTES + 1, lastModified: call.endedAt });
    const ok = file({ name: "ok.m4a", lastModified: call.endedAt + 2 * MIN });
    const m = matchRecording(call, [huge, ok]);
    expect(m.best).toBe(ok);
    expect(m.candidates).toHaveLength(2);
    expect(matchRecording(call, [huge]).best).toBeNull();
  });
});

describe("recordingContentType", () => {
  it("keeps an allowed mime and normalises aliases", () => {
    expect(recordingContentType({ name: "a", mimeType: "audio/mp4" })).toBe("audio/mp4");
    expect(recordingContentType({ name: "a", mimeType: "audio/x-m4a" })).toBe("audio/mp4");
    expect(recordingContentType({ name: "a", mimeType: "audio/mp3" })).toBe("audio/mpeg");
    expect(recordingContentType({ name: "a", mimeType: "audio/x-wav" })).toBe("audio/wav");
    expect(recordingContentType({ name: "a", mimeType: "audio/AMR; charset=x" })).toBe("audio/amr");
  });

  it("falls back to the extension when the mime is missing or unknown", () => {
    expect(recordingContentType({ name: "x.m4a", mimeType: "" })).toBe("audio/mp4");
    expect(recordingContentType({ name: "x.3gp", mimeType: "application/octet-stream" })).toBe("audio/3gpp");
    expect(recordingContentType({ name: "X.MP3", mimeType: "" })).toBe("audio/mpeg");
    expect(recordingContentType({ name: "x.ogg", mimeType: "" })).toBe("audio/ogg");
  });

  it("is null for non-audio files", () => {
    expect(recordingContentType({ name: "notes.txt", mimeType: "text/plain" })).toBeNull();
    expect(recordingContentType({ name: "noext", mimeType: "" })).toBeNull();
  });
});

describe("recordingProblem", () => {
  it("accepts a normal recording", () => {
    expect(recordingProblem(file({}))).toBeNull();
    expect(recordingProblem(file({ sizeBytes: MAX_RECORDING_BYTES }))).toBeNull();
  });
  it("rejects empty, oversize and unsupported files", () => {
    expect(recordingProblem(file({ sizeBytes: 0 }))).toMatch(/empty/);
    expect(recordingProblem(file({ sizeBytes: MAX_RECORDING_BYTES + 1 }))).toMatch(/25 MB/);
    expect(recordingProblem(file({ name: "a.txt", mimeType: "text/plain" }))).toMatch(/supported/);
  });
});

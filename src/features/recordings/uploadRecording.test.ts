/// <reference types="jest" />
/// <reference types="node" />
/**
 * Uploading a call recording (ADR 0007): upload link → PUT to S3 → complete.
 */
import * as SimDialer from "@modules/sim-dialer";
import type { RecordingFile } from "@modules/sim-dialer";
import { useCallLog, type FinishedCall } from "@/store/callLog.store";
import { fakeCompass } from "../../../tests/support/compass";
import { resetAppState, signedInAs } from "../../../tests/support/state";
import { isUploadInFlight, uploadRecording } from "./uploadRecording";

jest.mock("@modules/sim-dialer");
const dialer = SimDialer as typeof SimDialer & {
  __reset: () => void;
  __setUploadStatus: (s: number) => void;
};

const T = Date.parse("2026-11-06T10:15:00.000Z");
const call = (over: Partial<FinishedCall> = {}): FinishedCall => ({
  id: "c1",
  userId: "31",
  agentName: "Test Agent",
  name: "Asha Rao",
  phone: "+919876500001",
  opportunityId: "7001",
  leadId: "501",
  taskId: null,
  platform: "android",
  simId: null,
  tappedAt: T,
  startedAt: T + 1_000,
  endedAt: T + 90_000,
  approximate: false,
  totalDurationSeconds: 90,
  talkTimeSeconds: 70,
  ringTimeSeconds: 20,
  answered: true,
  status: "sent",
  attempts: 1,
  nextAttemptAt: 0,
  lastError: null,
  activityId: "8001",
  dismissed: false,
  ...over,
});

const file: RecordingFile = {
  uri: "content://tree/rec1",
  name: "Call_9876500001.m4a",
  sizeBytes: 2_100_000,
  lastModified: T + 95_000,
  mimeType: "audio/x-m4a",
};

const recording = () => useCallLog.getState().calls[0]?.recording;

beforeEach(async () => {
  await resetAppState();
  dialer.__reset();
  signedInAs();
  useCallLog.setState({ calls: [call()] });
});

describe("uploadRecording", () => {
  it("asks for a link, PUTs the file with the signed type, then completes", async () => {
    const server = fakeCompass();
    await uploadRecording("c1", file);

    expect(server.find("POST", "/mobile-dialer/recordings/8001/upload-url")[0]?.body).toEqual({
      content_type: "audio/mp4", // audio/x-m4a is normalised
      size_bytes: 2_100_000,
    });
    expect(dialer.uploadRecording).toHaveBeenCalledWith(
      "content://tree/rec1",
      "https://s3.example/recordings/manual/8001.m4a?X-Amz-Signature=sig",
      "audio/mp4",
      2_100_000,
    );
    expect(server.find("POST", "/mobile-dialer/recordings/8001/complete")[0]?.body).toEqual({
      key: "recordings/manual/8001.m4a",
    });
    expect(recording()).toMatchObject({ status: "uploaded", error: null, fileName: "Call_9876500001.m4a" });
    expect(recording()?.uploadedAt).toEqual(expect.any(Number));
    expect(isUploadInFlight("c1")).toBe(false);
  });

  it("fails with a retryable message when storage refuses the PUT (403), without calling complete", async () => {
    const server = fakeCompass();
    dialer.__setUploadStatus(403);
    await uploadRecording("c1", file);

    expect(recording()).toMatchObject({ status: "failed", error: "Upload refused by storage (403)" });
    expect(server.find("POST", /complete$/)).toHaveLength(0);

    // Retry works once storage accepts it
    dialer.__setUploadStatus(200);
    await uploadRecording("c1", file);
    expect(recording()?.status).toBe("uploaded");
  });

  it("fails when the phone can't read or send the file", async () => {
    fakeCompass();
    (dialer.uploadRecording as jest.Mock).mockRejectedValueOnce(new Error("Can't open the recording file."));
    await uploadRecording("c1", file);
    expect(recording()).toMatchObject({
      status: "failed",
      error: "Upload failed: Can't open the recording file.",
    });
  });

  it("shows the server's message when Compass refuses the link", async () => {
    const server = fakeCompass();
    server.on("POST", /upload-url$/, {
      status: 400,
      body: { statusCode: 400, message: { code: "TOO_OLD", message: "This call is more than 7 days old." } },
    });
    await uploadRecording("c1", file);
    expect(recording()).toMatchObject({ status: "failed", error: "This call is more than 7 days old." });
    expect(dialer.uploadRecording).not.toHaveBeenCalled();
  });

  it("fails when Compass says the file never arrived", async () => {
    const server = fakeCompass();
    server.on("POST", /complete$/, {
      status: 400,
      body: {
        statusCode: 400,
        message: { code: "NOT_UPLOADED", message: "The recording isn't in storage." },
      },
    });
    await uploadRecording("c1", file);
    expect(recording()).toMatchObject({ status: "failed", error: "The recording isn't in storage." });
  });

  it("fails when the call isn't in Compass yet, without any request", async () => {
    const server = fakeCompass();
    useCallLog.setState({ calls: [call({ activityId: null, status: "pending" })] });
    await uploadRecording("c1", file);
    expect(recording()).toMatchObject({
      status: "failed",
      error: "Call not in Compass yet — try again in a moment",
    });
    expect(server.requests).toHaveLength(0);
  });

  it("refuses a file Compass would reject, without any request", async () => {
    const server = fakeCompass();
    await uploadRecording("c1", { ...file, sizeBytes: 30_000_000 });
    expect(recording()).toMatchObject({ status: "failed", error: expect.stringMatching(/25 MB/) });
    expect(server.requests).toHaveLength(0);
  });

  it("ignores a second tap while uploading", async () => {
    const server = fakeCompass();
    const first = uploadRecording("c1", file);
    expect(isUploadInFlight("c1")).toBe(true);
    await uploadRecording("c1", file);
    await first;
    expect(server.find("POST", /upload-url$/)).toHaveLength(1);
    expect(dialer.uploadRecording).toHaveBeenCalledTimes(1);
  });
});

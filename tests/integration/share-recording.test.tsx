/// <reference types="jest" />
/// <reference types="node" />
/**
 * Integration: a recording shared from the phone's Phone app (Share → Compass Dialer, ADR 0010)
 * opens the Upload call recording screen, is matched to the call by the time in its file name,
 * and is uploaded with the same code as a folder recording.
 */
import { Platform } from "react-native";
import { act, fireEvent, screen, waitFor } from "@testing-library/react-native";
import { renderRouter } from "expo-router/testing-library";

import * as SimDialer from "@modules/sim-dialer";
import { useCallLog, type FinishedCall } from "@/store/callLog.store";
import { useSharedRecording } from "@/store/sharedRecording.store";
import { fakeCompass } from "../support/compass";
import { resetAppState, signedInAs } from "../support/state";

jest.mock("@modules/sim-dialer");
const dialer = SimDialer as typeof SimDialer & {
  __reset: () => void;
  __shareRecording: (f: SimDialer.SharedRecording, o?: { emit?: boolean }) => void;
};

const TITLE = "Upload call recording";
let os: { restore: () => void };

beforeEach(async () => {
  os = jest.replaceProperty(Platform, "OS", "android");
  await resetAppState();
  useSharedRecording.setState({ file: null });
  dialer.__reset();
  signedInAs();
});
afterEach(() => os.restore());

/** A logged call that started 5 minutes ago and lasted 100 s. */
function loggedCall(over: Partial<FinishedCall> = {}): FinishedCall {
  const tapped = Date.now() - 5 * 60_000;
  return {
    id: "call-1",
    userId: "31",
    agentName: "Test Agent",
    name: "Asha Rao",
    phone: "+919876500001",
    opportunityId: null,
    leadId: null,
    taskId: null,
    platform: "android",
    simId: null,
    tappedAt: tapped,
    startedAt: tapped + 5_000,
    endedAt: tapped + 100_000,
    answered: true,
    totalDurationSeconds: 95,
    talkTimeSeconds: 80,
    ringTimeSeconds: 15,
    approximate: false,
    status: "sent",
    attempts: 1,
    nextAttemptAt: 0,
    lastError: null,
    activityId: "8001",
    dismissed: true,
    ...over,
  } as FinishedCall;
}

function shared(name: string): SimDialer.SharedRecording {
  return {
    uri: `file:///cache/shared-recordings/${name}`,
    name,
    sizeBytes: 1_200_000,
    mimeType: "audio/x-wav",
    sharedAt: Date.now(),
  };
}

const nameAt = (ms: number) => `record-${ms}.wav`;

describe("Share a recording to the app", () => {
  it("opens, shows the matched call, and uploads", async () => {
    const call = loggedCall();
    useCallLog.setState({ calls: [call] });
    const server = fakeCompass();
    renderRouter("./src/app", { initialUrl: "/" });
    await screen.findByLabelText("Asha Rao, open lead");

    act(() => dialer.__shareRecording(shared(nameAt(call.tappedAt + 20_000))));

    expect(await screen.findByText(TITLE)).toBeTruthy();
    expect(await screen.findByText("This recording is for:")).toBeTruthy();
    expect(screen.getByText("Call to Asha Rao")).toBeTruthy();

    fireEvent.press(screen.getByLabelText("Upload"));
    expect(await screen.findByText("Uploaded. Thank you!")).toBeTruthy();
    expect(server.find("POST", "/mobile-dialer/recordings/8001/upload-url")).toHaveLength(1);
    expect(server.find("POST", "/mobile-dialer/recordings/8001/complete")).toHaveLength(1);
    expect(dialer.uploadRecording).toHaveBeenCalledWith(
      expect.stringContaining("file:///cache/shared-recordings/record-"),
      expect.any(String),
      expect.any(String),
      1_200_000,
    );
    expect(useCallLog.getState().calls[0]?.recording?.status).toBe("uploaded");
  });

  it("takes Google Phone's share with no audio type, judging the file by its .wav name", async () => {
    // Seen on a Nothing CMF phone: Google Phone shares record-<ms>.wav with a generic type, so
    // the native module reports no mime type. The upload must still be signed as audio/wav.
    const call = loggedCall();
    useCallLog.setState({ calls: [call] });
    const server = fakeCompass();
    renderRouter("./src/app", { initialUrl: "/" });
    await screen.findByLabelText("Asha Rao, open lead");

    act(() => dialer.__shareRecording({ ...shared(nameAt(call.tappedAt + 20_000)), mimeType: "" }));

    expect(await screen.findByText("This recording is for:")).toBeTruthy();
    fireEvent.press(screen.getByLabelText("Upload"));
    expect(await screen.findByText("Uploaded. Thank you!")).toBeTruthy();
    const [req] = server.find("POST", "/mobile-dialer/recordings/8001/upload-url");
    expect(req?.body).toMatchObject({ content_type: "audio/wav", size_bytes: 1_200_000 });
  });

  it("turns away a shared file that is not audio, in plain words", async () => {
    const call = loggedCall();
    useCallLog.setState({ calls: [call] });
    const server = fakeCompass();
    renderRouter("./src/app", { initialUrl: "/" });
    await screen.findByLabelText("Asha Rao, open lead");

    act(() =>
      dialer.__shareRecording({
        uri: "",
        name: "IMG_2041.jpg",
        sizeBytes: 0,
        mimeType: "",
        sharedAt: Date.now(),
        error: "not_audio",
      }),
    );

    expect(await screen.findByText("This file is not a supported audio file.")).toBeTruthy();
    expect(server.find("POST", "/mobile-dialer/recordings/8001/upload-url")).toHaveLength(0);
  });

  it("asks which call when none matches, then uploads for the chosen call", async () => {
    const call = loggedCall();
    useCallLog.setState({ calls: [call] });
    const server = fakeCompass();
    renderRouter("./src/app", { initialUrl: "/" });
    await screen.findByLabelText("Asha Rao, open lead");

    // A recording made an hour before the call
    act(() => dialer.__shareRecording(shared(nameAt(call.tappedAt - 3_600_000))));

    expect(await screen.findByText("Which call is this recording for?")).toBeTruthy();
    fireEvent.press(screen.getByLabelText(/^Choose call to Asha Rao/));
    expect(await screen.findByText("This recording is for:")).toBeTruthy();

    fireEvent.press(screen.getByLabelText("Upload"));
    expect(await screen.findByText("Uploaded. Thank you!")).toBeTruthy();
    expect(server.find("POST", "/mobile-dialer/recordings/8001/complete")).toHaveLength(1);
  });

  it("works when the share started the app (cold start)", async () => {
    const call = loggedCall();
    useCallLog.setState({ calls: [call] });
    const server = fakeCompass();
    // Waiting in the native module before the app's JavaScript ran: no event
    dialer.__shareRecording(shared(nameAt(call.tappedAt + 20_000)), { emit: false });
    renderRouter("./src/app", { initialUrl: "/" });

    expect(await screen.findByText("This recording is for:")).toBeTruthy();
    expect(dialer.takeSharedRecording).toHaveBeenCalled();
    fireEvent.press(screen.getByLabelText("Upload"));
    expect(await screen.findByText("Uploaded. Thank you!")).toBeTruthy();
    expect(server.find("POST", "/mobile-dialer/recordings/8001/upload-url")).toHaveLength(1);
  });

  it("says so when the call is not in Compass yet, and lets the agent try again", async () => {
    const call = loggedCall({ activityId: null, status: "failed" });
    useCallLog.setState({ calls: [call] });
    const server = fakeCompass();
    renderRouter("./src/app", { initialUrl: "/" });
    await screen.findByLabelText("Asha Rao, open lead");
    act(() => dialer.__shareRecording(shared(nameAt(call.tappedAt + 20_000))));

    fireEvent.press(await screen.findByLabelText("Upload"));
    expect(
      await screen.findByText("This call is not in Compass yet. Wait a moment and try again."),
    ).toBeTruthy();
    expect(screen.getByText("Try again")).toBeTruthy();
    expect(server.find("POST", "/mobile-dialer/recordings/8001/upload-url")).toHaveLength(0);
  });

  it("refuses a file that is not audio or too big, in plain words", async () => {
    const call = loggedCall();
    useCallLog.setState({ calls: [call] });
    fakeCompass();
    renderRouter("./src/app", { initialUrl: "/" });
    await screen.findByLabelText("Asha Rao, open lead");
    act(() =>
      dialer.__shareRecording({
        uri: "",
        name: nameAt(call.tappedAt + 20_000),
        sizeBytes: 30_000_000,
        mimeType: "audio/wav",
        sharedAt: Date.now(),
        error: "too_big",
      }),
    );
    expect(await screen.findByText("This recording is too big. The limit is 25 MB.")).toBeTruthy();
    expect(screen.queryByLabelText("Upload")).toBeNull();
    await waitFor(() => expect(screen.getByLabelText("Skip")).toBeTruthy());
  });
});

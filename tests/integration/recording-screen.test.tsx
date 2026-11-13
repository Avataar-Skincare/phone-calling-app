/// <reference types="jest" />
/// <reference types="node" />
/**
 * Integration: after an answered Android call the Upload call recording screen opens by itself
 * (ADR 0007). It finds the file, uploads it, and never comes back after Skip.
 */
import { Platform } from "react-native";
import { act, fireEvent, screen, waitFor } from "@testing-library/react-native";
import { renderRouter } from "expo-router/testing-library";

import * as SimDialer from "@modules/sim-dialer";
import { useCallLog, type FinishedCall } from "@/store/callLog.store";
import { useSettingsStore } from "@/store/settings.store";
import { fakeCompass } from "../support/compass";
import { resetAppState, signedInAs } from "../support/state";

jest.mock("@modules/sim-dialer");
const dialer = SimDialer as typeof SimDialer & {
  __reset: () => void;
  __emit: (e: { state: string; at: number }) => void;
  __setCallLog: (e: { talkSeconds: number; startedAt: number } | null) => void;
  __setRecordingsFolder: (f: { uri: string; name: string } | null) => void;
  __setRecordings: (r: SimDialer.RecordingFile[]) => void;
};

const FOLDER = { uri: "content://tree/Call", name: "Call" };
const TITLE = "Upload call recording";
let os: { restore: () => void };

beforeEach(async () => {
  os = jest.replaceProperty(Platform, "OS", "android");
  await resetAppState();
  dialer.__reset();
  signedInAs();
  useSettingsStore.setState({ permissionIntroSeen: true });
});
afterEach(() => os.restore());

function fileJustSaved(): SimDialer.RecordingFile {
  return {
    uri: "content://tree/Call/Call_9876500001.m4a",
    name: "Call_9876500001.m4a",
    sizeBytes: 2_100_000,
    lastModified: Date.now() + 93_000,
    mimeType: "audio/mp4",
  };
}

/** Call Asha and hang up. `talk` 0 = nobody answered. */
async function callAndHangUp(talk: number) {
  renderRouter("./src/app", { initialUrl: "/" });
  await screen.findByLabelText("Asha Rao, open lead");
  fireEvent.press(screen.getByLabelText("Call Asha Rao"));
  await waitFor(() => expect(dialer.placeCall).toHaveBeenCalled());
  const start = Date.now();
  act(() => dialer.__emit({ state: "offhook", at: start + 1_000 }));
  dialer.__setCallLog({ talkSeconds: talk, startedAt: start });
  act(() => dialer.__emit({ state: "idle", at: start + 92_000 }));
}

describe("Upload call recording screen", () => {
  it("opens by itself, finds the file, and uploads it", async () => {
    dialer.__setRecordingsFolder(FOLDER);
    useSettingsStore.setState({ recordingsFolder: FOLDER });
    dialer.__setRecordings([fileJustSaved()]);
    const server = fakeCompass();
    await callAndHangUp(80);

    expect(await screen.findByText(TITLE)).toBeTruthy();
    expect(screen.getByText("Call to Asha Rao")).toBeTruthy();
    expect(await screen.findByText("Recording found")).toBeTruthy();
    // The call must be in Compass before uploading
    await waitFor(() => expect(useCallLog.getState().calls[0]?.activityId).toBe("8001"));

    fireEvent.press(screen.getByLabelText("Upload"));
    expect(await screen.findByText("Uploaded. Thank you!")).toBeTruthy();
    expect(server.find("POST", "/mobile-dialer/recordings/8001/upload-url")).toHaveLength(1);
    expect(server.find("POST", "/mobile-dialer/recordings/8001/complete")).toHaveLength(1);
    expect(useCallLog.getState().calls[0]?.recording?.status).toBe("uploaded");
  });

  it("asks for the folder first, and uses the picker on this screen", async () => {
    dialer.__setRecordingsFolder(FOLDER);
    fakeCompass();
    await callAndHangUp(80);

    expect(
      await screen.findByText("First, choose the folder where your phone saves call recordings."),
    ).toBeTruthy();
    fireEvent.press(screen.getByText("Choose folder"));
    await waitFor(() => expect(dialer.pickRecordingsFolder).toHaveBeenCalled());
    await waitFor(() => expect(useSettingsStore.getState().recordingsFolder).toEqual(FOLDER));
    // Nothing saved yet: it looks for the file
    expect(await screen.findByText("Looking for the recording…")).toBeTruthy();
  });

  it("Skip closes it and it does not open again", async () => {
    dialer.__setRecordingsFolder(FOLDER);
    useSettingsStore.setState({ recordingsFolder: FOLDER });
    dialer.__setRecordings([fileJustSaved()]);
    fakeCompass();
    await callAndHangUp(80);

    fireEvent.press(await screen.findByLabelText("Skip"));
    await waitFor(() => expect(screen.queryByText(TITLE)).toBeNull());
    // The summary card is still there as the fallback
    expect(await screen.findByText("Call to Asha Rao · Connected")).toBeTruthy();
    // Another change to the call (it reaches Compass) does not bring the screen back
    await waitFor(() => expect(useCallLog.getState().calls[0]?.activityId).toBe("8001"));
    expect(screen.queryByText(TITLE)).toBeNull();
  });

  it("does not open for a call nobody answered", async () => {
    dialer.__setRecordingsFolder(FOLDER);
    useSettingsStore.setState({ recordingsFolder: FOLDER });
    fakeCompass();
    await callAndHangUp(0);

    await waitFor(() => expect(useCallLog.getState().calls).toHaveLength(1));
    expect(useCallLog.getState().calls[0]?.answered).toBe(false);
    expect(screen.queryByText(TITLE)).toBeNull();
  });

  it("does not open for an old call already stored when the app starts", async () => {
    dialer.__setRecordingsFolder(FOLDER);
    useSettingsStore.setState({ recordingsFolder: FOLDER });
    const now = Date.now();
    const old = {
      id: "old-1",
      userId: "31",
      agentName: "Test Agent",
      name: "Old Lead",
      phone: "+919876500009",
      opportunityId: null,
      leadId: null,
      taskId: null,
      platform: "android",
      simId: null,
      tappedAt: now - 30_000,
      startedAt: now - 20_000,
      endedAt: now - 5_000,
      answered: true,
      status: "sent",
      attempts: 1,
      nextAttemptAt: 0,
      lastError: null,
      activityId: "7999",
      dismissed: true,
    } as unknown as FinishedCall;
    useCallLog.setState({ calls: [old] });
    fakeCompass();
    renderRouter("./src/app", { initialUrl: "/" });
    await screen.findByLabelText("Asha Rao, open lead");
    expect(screen.queryByText(TITLE)).toBeNull();
  });
});

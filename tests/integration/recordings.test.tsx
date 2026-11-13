/// <reference types="jest" />
/// <reference types="node" />
/**
 * Integration: after an Android call, the summary card finds the phone dialer's recording in the
 * folder the agent picked in Settings and uploads it on one tap (ADR 0007).
 */
import { Platform } from "react-native";
import { act, fireEvent, screen, waitFor } from "@testing-library/react-native";
import { renderRouter } from "expo-router/testing-library";

import * as SimDialer from "@modules/sim-dialer";
import { useCallLog } from "@/store/callLog.store";
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
  __setUploadStatus: (s: number) => void;
};

const FOLDER = { uri: "content://tree/Call", name: "Call" };
let os: { restore: () => void };

beforeEach(async () => {
  os = jest.replaceProperty(Platform, "OS", "android");
  await resetAppState();
  dialer.__reset();
  signedInAs();
  useSettingsStore.setState({ permissionIntroSeen: true });
});
afterEach(() => os.restore());

/** Call Asha, talk for 80 s, hang up. Returns when the summary card is up. */
async function callAndHangUp(server = fakeCompass()) {
  renderRouter("./src/app", { initialUrl: "/" });
  await screen.findByLabelText("Asha Rao, open lead");
  fireEvent.press(screen.getByLabelText("Call Asha Rao"));
  await waitFor(() => expect(dialer.placeCall).toHaveBeenCalled());
  const start = Date.now();
  act(() => dialer.__emit({ state: "offhook", at: start + 1_000 }));
  dialer.__setCallLog({ talkSeconds: 80, startedAt: start });
  act(() => dialer.__emit({ state: "idle", at: start + 92_000 }));
  expect(await screen.findByText("Call to Asha Rao · Connected")).toBeTruthy();
  // The call is in Compass before the agent can upload
  await waitFor(() => expect(useCallLog.getState().calls[0]?.activityId).toBe("8001"));
  return { server, start };
}

describe("call recording upload", () => {
  it("finds the recording, uploads it on one tap, and shows it uploaded", async () => {
    dialer.__setRecordingsFolder(FOLDER);
    useSettingsStore.setState({ recordingsFolder: FOLDER });
    const server = fakeCompass();
    // The dialer saved the file right after the call ended (now is just after the hang-up)
    dialer.__setRecordings([
      {
        uri: "content://tree/Call/Call_9876500001.m4a",
        name: "Call_9876500001.m4a",
        sizeBytes: 2_100_000,
        lastModified: Date.now() + 93_000,
        mimeType: "audio/mp4",
      },
    ]);
    await callAndHangUp(server);

    expect(await screen.findByText(/^Recording found · \d{1,2}:\d{2} (am|pm) · 2\.1 MB$/)).toBeTruthy();
    fireEvent.press(screen.getByLabelText("Upload recording"));

    expect(await screen.findByText("Recording uploaded ✓")).toBeTruthy();
    const nonGet = server.requests.filter((r) => r.method !== "GET").map((r) => r.path);
    expect(nonGet).toEqual([
      "/activities/log",
      "/mobile-dialer/recordings/8001/upload-url",
      "/mobile-dialer/recordings/8001/complete",
    ]);
    expect(server.find("POST", "/mobile-dialer/recordings/8001/upload-url")[0]?.body).toEqual({
      content_type: "audio/mp4",
      size_bytes: 2_100_000,
    });
    expect(server.find("POST", "/mobile-dialer/recordings/8001/complete")[0]?.body).toEqual({
      key: "recordings/manual/8001.m4a",
    });
    expect(dialer.uploadRecording).toHaveBeenCalledWith(
      "content://tree/Call/Call_9876500001.m4a",
      expect.stringContaining("https://s3.example/"),
      "audio/mp4",
      2_100_000,
    );
    expect(useCallLog.getState().calls[0]?.recording?.status).toBe("uploaded");
  });

  it("shows the error and Retry when storage refuses the upload", async () => {
    dialer.__setRecordingsFolder(FOLDER);
    useSettingsStore.setState({ recordingsFolder: FOLDER });
    dialer.__setUploadStatus(403);
    dialer.__setRecordings([
      {
        uri: "content://tree/Call/a.m4a",
        name: "a.m4a",
        sizeBytes: 1_000_000,
        lastModified: Date.now() + 93_000,
        mimeType: "audio/mp4",
      },
    ]);
    await callAndHangUp();

    fireEvent.press(await screen.findByLabelText("Upload recording"));
    expect(await screen.findByText("Upload refused by storage (403)")).toBeTruthy();

    dialer.__setUploadStatus(200);
    fireEvent.press(screen.getByLabelText("Retry"));
    expect(await screen.findByText("Recording uploaded ✓")).toBeTruthy();
  });

  it("offers Choose file when nothing matched, and uploads the chosen file", async () => {
    dialer.__setRecordingsFolder(FOLDER);
    useSettingsStore.setState({ recordingsFolder: FOLDER });
    await callAndHangUp();
    expect(await screen.findByText("No recording found")).toBeTruthy();

    // A file from an hour ago is not a match, but is in the picker's 2-hour list
    dialer.__setRecordings([
      {
        uri: "content://tree/Call/old.m4a",
        name: "old.m4a",
        sizeBytes: 500_000,
        lastModified: Date.now() - 60 * 60_000,
        mimeType: "audio/mp4",
      },
    ]);
    fireEvent.press(screen.getByLabelText("Choose file"));
    fireEvent.press(await screen.findByLabelText("Upload old.m4a"));
    expect(await screen.findByText("Recording uploaded ✓")).toBeTruthy();
  });

  it("links to Settings when no recordings folder is set, and uploads nothing", async () => {
    const server = fakeCompass();
    await callAndHangUp(server);

    fireEvent.press(await screen.findByText("Set your recordings folder to upload call recordings"));
    expect(await screen.findByText("Call recordings folder")).toBeTruthy();
    expect(server.requests.filter((r) => r.method !== "GET").map((r) => r.path)).toEqual(["/activities/log"]);
  });

  it("lets the agent choose the folder in Settings, and forgets it when access is lost", async () => {
    fakeCompass();
    dialer.__setRecordingsFolder(FOLDER);
    renderRouter("./src/app", { initialUrl: "/settings" });

    expect(await screen.findByText("Not set")).toBeTruthy();
    fireEvent.press(screen.getByText("Choose folder"));
    expect(await screen.findByText("Call")).toBeTruthy();
    expect(useSettingsStore.getState().recordingsFolder).toEqual(FOLDER);
    expect(screen.getByText("Change")).toBeTruthy();
  });

  it("shows the folder as not set when Android no longer grants access", async () => {
    fakeCompass();
    useSettingsStore.setState({ recordingsFolder: FOLDER }); // stored, but the phone has no grant
    renderRouter("./src/app", { initialUrl: "/settings" });
    expect(await screen.findByText("Not set")).toBeTruthy();
    expect(useSettingsStore.getState().recordingsFolder).toBeNull();
  });
});

/// <reference types="jest" />
/// <reference types="node" />
/**
 * Integration: the "Before you start" check when the app opens (ADR 0011), and the call_diag the
 * app sends only for calls whose talk time is missing. Renders the real app with a fake Compass
 * and the sim-dialer test double, as an Android phone.
 */
import { AppState, Platform } from "react-native";
import { act, fireEvent, screen, waitFor } from "@testing-library/react-native";
import { renderRouter } from "expo-router/testing-library";

import * as SimDialer from "@modules/sim-dialer";
import { useCallLog } from "@/store/callLog.store";
import { useSettingsStore } from "@/store/settings.store";
import { SKIP_MS } from "@/lib/startupCheck";
import { fakeCompass } from "../support/compass";
import { resetAppState, signedInAs } from "../support/state";

jest.mock("@modules/sim-dialer");
const dialer = SimDialer as typeof SimDialer & {
  __reset: () => void;
  __emit: (e: { state: string; at: number }) => void;
  __setCapabilities: (c: object) => void;
  __setCallLog: (e: { talkSeconds: number; startedAt: number } | null) => void;
  __setCallLogVisible: (n: number) => void;
  __setDialerPackage: (p: string | null) => void;
};

let os: ReturnType<typeof jest.replaceProperty>;

beforeEach(async () => {
  await resetAppState();
  dialer.__reset();
  signedInAs();
  os = jest.replaceProperty(Platform, "OS", "android");
});
afterEach(() => os.restore());

const TITLE = "Before you start";

/** Open the app. `setup`: the "Before you start" screen is expected to cover the lead list. */
async function openApp(setup = false) {
  const server = fakeCompass();
  renderRouter("./src/app", { initialUrl: "/" });
  if (setup) await screen.findByText(TITLE);
  else await screen.findByLabelText("Asha Rao, open lead");
  return server;
}

describe("when the app opens", () => {
  it("shows nothing when everything is fine", async () => {
    await openApp();
    await act(async () => {});
    expect(screen.queryByText(TITLE)).toBeNull();
    expect(dialer.getCallLogVisibleCount).toHaveBeenCalled();
  });

  it("asks for call logs first, and calling stays blocked until they are allowed", async () => {
    dialer.__setCapabilities({ canReadCallLog: false });
    (dialer.requestPermissions as jest.Mock).mockImplementationOnce(async () => {
      dialer.__setCapabilities({ canReadCallLog: true });
      return { status: "granted", granted: true, canAskAgain: true };
    });
    await openApp(true);

    expect(await screen.findByText(TITLE)).toBeTruthy();
    expect(screen.getByText("Allow call logs. We need it to save talk time.")).toBeTruthy();
    expect(screen.queryByText("Skip")).toBeNull();
    expect(screen.getByText("Continue")).toBeDisabled();
    expect(dialer.placeCall).not.toHaveBeenCalled();

    fireEvent.press(screen.getByText("Allow"));
    await waitFor(() =>
      expect(screen.queryByText("Allow call logs. We need it to save talk time.")).toBeNull(),
    );
    expect(screen.getByText("Continue")).toBeEnabled();

    fireEvent.press(screen.getByText("Continue"));
    await waitFor(() => expect(screen.queryByText(TITLE)).toBeNull());
    await screen.findByLabelText("Asha Rao, open lead");
    fireEvent.press(screen.getByLabelText("Call Asha Rao"));
    await waitFor(() => expect(dialer.placeCall).toHaveBeenCalledWith("+919876500001", null));
  });

  it("asks for phone access with plain words", async () => {
    dialer.__setCapabilities({ canDirectDial: false });
    await openApp(true);
    expect(await screen.findByText("Allow phone access. The app needs it to make calls.")).toBeTruthy();
    expect(screen.getByText("Continue")).toBeDisabled();
  });

  it("offers Open settings once the phone will not ask again", async () => {
    dialer.__setCapabilities({ canReadCallLog: false });
    await openApp(true);
    fireEvent.press(screen.getByText("Allow")); // the mock grants nothing
    expect(await screen.findByText("Still not allowed. Tap Open settings.")).toBeTruthy();
    expect(screen.getByText("Open settings")).toBeTruthy();
    expect(screen.getByText("Continue")).toBeDisabled();
  });

  it("warns when the phone hides call logs; Skip goes home and stays quiet for 24 hours", async () => {
    dialer.__setCallLogVisible(0);
    await openApp(true);

    expect(await screen.findByText(TITLE)).toBeTruthy();
    expect(screen.getByText("Your phone is hiding call logs. Talk time will not be saved.")).toBeTruthy();
    expect(screen.getByText(/Open settings and allow Call logs for Compass Dialer/)).toBeTruthy();
    expect(screen.getByText("Check again")).toBeTruthy();
    // A warning does not block
    expect(screen.getByText("Continue")).toBeEnabled();

    fireEvent.press(screen.getByText("Skip"));
    await waitFor(() => expect(screen.queryByText(TITLE)).toBeNull());
    expect(useSettingsStore.getState().hiddenLogSkippedAt).toEqual(expect.any(Number));
    expect(await screen.findByLabelText("Asha Rao, open lead")).toBeTruthy();
  });

  it("does not show a skipped warning again within 24 hours, but does after", async () => {
    dialer.__setCallLogVisible(0);
    useSettingsStore.setState({ hiddenLogSkippedAt: Date.now() - 60 * 60 * 1000 });
    await openApp();
    await act(async () => {});
    expect(screen.queryByText(TITLE)).toBeNull();
  });

  it("shows the warning again once the skip is 24 hours old", async () => {
    dialer.__setCallLogVisible(0);
    useSettingsStore.setState({ hiddenLogSkippedAt: Date.now() - SKIP_MS - 60_000 });
    await openApp(true);
    expect(await screen.findByText(TITLE)).toBeTruthy();
    expect(screen.getByText("Your phone is hiding call logs. Talk time will not be saved.")).toBeTruthy();
  });

  it("checks again when the app comes back to the foreground", async () => {
    // Call-through spy (not restored: AppState is already a jest mock here, and restoring it
    // would wipe its implementation for every later test).
    const appState = jest.spyOn(AppState, "addEventListener");
    await openApp();
    await act(async () => {});
    expect(screen.queryByText(TITLE)).toBeNull();

    dialer.__setCallLogVisible(0); // the phone turned the log off meanwhile
    jest.setSystemTime(Date.now() + 2_000); // past the 1 s gap between checks
    // Only the startup check's own listener: the others (react-query focus, call tracker) would
    // fetch and track as well, which is not what is under test. It is the one that uses MIN_GAP_MS.
    const mine = appState.mock.calls
      .map(([, listener]) => listener as (s: string) => void)
      .filter((l) => String(l).includes("run()"));
    expect(mine.length).toBeGreaterThan(0);
    await act(async () => {
      mine.forEach((l) => l("active"));
    });
    expect(await screen.findByText(TITLE)).toBeTruthy();
  });

  it("shows the share steps for Google Phone", async () => {
    dialer.__setCapabilities({ canReadCallLog: false });
    dialer.__setDialerPackage("com.google.android.dialer");
    await openApp(true);
    expect(
      await screen.findByText(
        "To upload a recording, open Phone. Tap Recents. Open the call. Tap the recording. Tap Share. Choose Compass Dialer.",
      ),
    ).toBeTruthy();
    expect(screen.queryByText("Choose folder")).toBeNull();
  });

  it("never asks for the recordings folder on the start screen (it is in Settings)", async () => {
    dialer.__setCapabilities({ canReadCallLog: false });
    await openApp(true);
    expect(await screen.findByText("Allow call logs. We need it to save talk time.")).toBeTruthy();
    expect(screen.queryByText("Choose the folder where your phone saves call recordings.")).toBeNull();
    expect(screen.queryByText("Choose folder")).toBeNull();
  });

  it("does not open for a recording tip alone", async () => {
    dialer.__setDialerPackage("com.google.android.dialer");
    await openApp();
    await act(async () => {});
    expect(screen.queryByText(TITLE)).toBeNull();
  });

  it("can be opened from Settings, and Continue is never blocked by tips", async () => {
    fakeCompass();
    renderRouter("./src/app", { initialUrl: "/settings" });
    fireEvent.press(await screen.findByText("Check my phone"));
    expect(await screen.findByText(TITLE)).toBeTruthy();
    expect(await screen.findByText("Continue")).toBeEnabled();
    expect(screen.queryByText("Choose folder")).toBeNull();
  });
});

describe("call_diag", () => {
  async function callAsha() {
    const server = await openApp();
    fireEvent.press(screen.getByLabelText("Call Asha Rao"));
    await waitFor(() => expect(dialer.placeCall).toHaveBeenCalledWith("+919876500001", null));
    const start = Date.now();
    act(() => dialer.__emit({ state: "offhook", at: start + 1_000 }));
    await screen.findByText("Calling Asha Rao");
    return { server, start };
  }

  it("is sent with the call log when talk time is missing and the phone shows no call log", async () => {
    const constants = jest.spyOn(Platform, "constants", "get").mockReturnValue({
      ...Platform.constants,
      Brand: "Xiaomi",
      Model: "Redmi Note 12",
      Release: "14",
    } as typeof Platform.constants);
    const { server, start } = await callAsha();
    // The phone hides the call log from now on, so it has no entry for this call
    dialer.__setCallLogVisible(0);
    act(() => dialer.__emit({ state: "idle", at: start + 31_000 }));

    await waitFor(() => expect(useCallLog.getState().calls[0]?.status).toBe("sent"), { timeout: 15_000 });
    const body = server.find("POST", "/activities/log")[0]?.body as { data: Record<string, unknown> };
    expect(body.data.call_diag).toEqual({
      phone: "granted",
      phone_state: "granted",
      call_log: "granted",
      call_log_visible: "no",
      lookup: "not_found",
      device: "Xiaomi Redmi Note 12 · Android 14",
      app: expect.any(String),
    });
    expect(body.data).not.toHaveProperty("call_talk_seconds");
    constants.mockRestore();
  });

  it("is not sent when the call has talk time", async () => {
    const { server, start } = await callAsha();
    dialer.__setCallLog({ talkSeconds: 20, startedAt: start });
    act(() => dialer.__emit({ state: "idle", at: start + 31_000 }));

    await waitFor(() => expect(useCallLog.getState().calls[0]?.status).toBe("sent"));
    const body = server.find("POST", "/activities/log")[0]?.body as { data: Record<string, unknown> };
    expect(body.data).toMatchObject({ call_talk_seconds: 20 });
    expect(body.data).not.toHaveProperty("call_diag");
  });
});

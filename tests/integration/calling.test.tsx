/// <reference types="jest" />
/// <reference types="node" />
/**
 * Integration: tap Call → phone call events → banner while on the call → call summary (talk,
 * ringing, total) after it ends, kept on the phone; and the WhatsApp button. Renders the real app with a fake Compass and the sim-dialer test double.
 */
import { Alert, AppState, Linking, Platform } from "react-native";
import { act, fireEvent, screen, waitFor } from "@testing-library/react-native";
import { renderRouter } from "expo-router/testing-library";

import * as SimDialer from "@modules/sim-dialer";
import { useCallLog } from "@/store/callLog.store";
import { useCallStore } from "@/store/call.store";
import { useSettingsStore } from "@/store/settings.store";
import { fakeCompass } from "../support/compass";
import { resetAppState, signedInAs } from "../support/state";

jest.mock("@modules/sim-dialer");
const dialer = SimDialer as typeof SimDialer & {
  __reset: () => void;
  __emit: (e: { state: string; at: number; connected?: boolean }) => void;
  __setCapabilities: (c: object) => void;
  __setCallLog: (e: { talkSeconds: number; startedAt: number } | null) => void;
};

const alertSpy = jest.spyOn(Alert, "alert");

beforeEach(async () => {
  await resetAppState();
  dialer.__reset();
  alertSpy.mockClear();
  signedInAs();
  useSettingsStore.setState({ permissionIntroSeen: true });
});

/** Open the app and call the first lead; the phone reports the call going live. */
async function callAsha(server = fakeCompass()) {
  renderRouter("./src/app", { initialUrl: "/" });
  await screen.findByLabelText("Asha Rao, open lead");

  fireEvent.press(screen.getByLabelText("Call Asha Rao"));
  await waitFor(() => expect(dialer.placeCall).toHaveBeenCalledWith("+919876500001", null));
  const start = Date.now();
  act(() => dialer.__emit({ state: "offhook", at: start + 1_000 }));
  expect(await screen.findByText("Calling Asha Rao")).toBeTruthy();
  return { server, start };
}

describe("calling a lead", () => {
  it("places the call, then shows talk time, ringing and total when it ends (no form)", async () => {
    const { server, start } = await callAsha();
    expect(screen.getByText("Smart Views")).toBeTruthy(); // stays on the list
    expect(screen.getByText("On the call")).toBeTruthy();

    // Tap at ~start, ended 92 s later; the call log says the client talked for 80 s
    dialer.__setCallLog({ talkSeconds: 80, startedAt: start });
    act(() => dialer.__emit({ state: "idle", at: start + 92_000 }));

    expect(await screen.findByText("Call to Asha Rao · Connected")).toBeTruthy();
    expect(screen.getByText(/^Talk time 1 min 20 s · Ringing \d+ s · Total 1 min 3\d s$/)).toBeTruthy();
    expect(screen.queryByText("How did the call go?")).toBeNull();
    expect(useCallStore.getState().session).toBeNull();

    // Logged in Compass as a "Manual Outbound Call" activity (ADR 0005), and nothing else is written
    await waitFor(() => expect(useCallLog.getState().calls[0]?.status).toBe("sent"));
    const [call] = useCallLog.getState().calls;
    expect(call).toMatchObject({
      name: "Asha Rao",
      opportunityId: "7001",
      talkTimeSeconds: 80,
      answered: true,
    });
    expect(call!.ringTimeSeconds).toBe(call!.totalDurationSeconds - 80);
    expect(server.requests.filter((r) => r.method !== "GET").map((r) => r.path)).toEqual(["/activities/log"]);
    expect(server.find("POST", "/activities/log")[0]?.body).toEqual({
      phone: "9876500001",
      activity_type: "manual_outbound_call",
      opportunity_id: "7001",
      occurred_at: new Date(call!.endedAt).toISOString(),
      data: expect.objectContaining({
        agent_user_id: "31",
        agent_name: "Test Agent",
        call_talk_seconds: 80,
        call_ring_seconds: call!.ringTimeSeconds,
        call_duration_seconds: call!.totalDurationSeconds,
        call_answered: "yes",
        call_platform: "android",
        call_source: "mobile_app",
        app_session_id: call!.id,
      }),
    });

    fireEvent.press(screen.getByLabelText("Close call summary"));
    expect(screen.queryByText("Call to Asha Rao · Connected")).toBeNull();
  });

  it("says when the client didn't answer", async () => {
    const { start } = await callAsha();
    dialer.__setCallLog({ talkSeconds: 0, startedAt: start });
    act(() => dialer.__emit({ state: "idle", at: start + 31_000 }));
    expect(await screen.findByText("Call to Asha Rao · Not answered")).toBeTruthy();
    expect(screen.getByText(/^Rang for 3\d s$/)).toBeTruthy();
  });

  it("lets the agent call the next lead straight after", async () => {
    const { start } = await callAsha();
    dialer.__setCallLog({ talkSeconds: 5, startedAt: start });
    act(() => dialer.__emit({ state: "idle", at: start + 31_000 }));
    await waitFor(() => expect(useCallStore.getState().session).toBeNull());

    (dialer.placeCall as jest.Mock).mockClear();
    fireEvent.press(screen.getByLabelText("Call Asha Rao"));
    await waitFor(() => expect(dialer.placeCall).toHaveBeenCalledWith("+919876500001", null));
    expect(alertSpy).not.toHaveBeenCalled();
  });

  it("records a call that ended while the app was closed", async () => {
    fakeCompass();
    const now = Date.now();
    useCallStore.setState({
      session: {
        id: "s1",
        name: "Asha Rao",
        phone: "+919876500001",
        opportunityId: "7001",
        leadId: "501",
        taskId: "9001",
        platform: "android",
        tracked: true,
        mode: "direct",
        simId: null,
        status: "in_call",
        tappedAt: now - 60_000,
        startedAt: now - 59_000,
        connectedAt: null,
        endedAt: null,
        connected: null,
        endApproximate: false,
      },
    });
    // The phone is no longer in a call (the mock reports "idle")

    renderRouter("./src/app", { initialUrl: "/" });
    await screen.findByLabelText("Asha Rao, open lead");
    // The end was missed, so it's approximate; the call log isn't there either → total only
    // (After "Getting call details…", while the app looks for the call-log entry)
    expect(await screen.findByText(/Talk time isn't available/, {}, { timeout: 8_000 })).toBeTruthy();
    expect(screen.getByText("Call to Asha Rao ended")).toBeTruthy();
    expect(useCallLog.getState().calls[0]).toMatchObject({ approximate: true, talkTimeSeconds: null });
    expect(useCallStore.getState().session).toBeNull();
    expect(screen.queryByText("How did the call go?")).toBeNull();
  });

  it("blocks an Android call until call-log access is granted, then places it (ADR 0008)", async () => {
    // The permission screen is Android-only (iOS needs no permission); Jest defaults to iOS.
    const os = jest.replaceProperty(Platform, "OS", "android");
    fakeCompass();
    (dialer.requestPermissions as jest.Mock).mockImplementationOnce(async () => {
      dialer.__setCapabilities({ canReadCallLog: true });
      return { status: "granted", granted: true, canAskAgain: true };
    });
    renderRouter("./src/app", { initialUrl: "/" });
    await screen.findByLabelText("Asha Rao, open lead");
    // Turned off after the app opened (the open check is covered in startup-check.test.tsx), so the
    // check at call time is the safety net under test here.
    dialer.__setCapabilities({ canReadCallLog: false });

    fireEvent.press(screen.getByLabelText("Call Asha Rao"));
    expect(await screen.findByText("Allow calling from the app")).toBeTruthy();
    expect(screen.queryByText("Not now, use the dialer")).toBeNull();
    expect(dialer.placeCall).not.toHaveBeenCalled();

    fireEvent.press(screen.getByText("Allow"));
    await waitFor(() => expect(dialer.requestPermissions).toHaveBeenCalled());
    await waitFor(() => expect(dialer.placeCall).toHaveBeenCalledWith("+919876500001", null));
    os.restore();
  });

  it("doesn't call when the agent refuses call-log access (Android)", async () => {
    const os = jest.replaceProperty(Platform, "OS", "android");
    fakeCompass();
    renderRouter("./src/app", { initialUrl: "/" });
    await screen.findByLabelText("Asha Rao, open lead");
    dialer.__setCapabilities({ canReadCallLog: false }); // turned off after the app opened

    fireEvent.press(screen.getByLabelText("Call Asha Rao"));
    fireEvent.press(await screen.findByText("Allow"));
    expect(await screen.findByText(/Call logs weren't allowed, so the call can't be made/)).toBeTruthy();
    // Android may refuse the prompt silently from now on, so Settings is offered right away.
    expect(screen.getByText("Open Settings")).toBeTruthy();
    expect(dialer.placeCall).not.toHaveBeenCalled();
    os.restore();
  });

  it("places the call when the agent comes back from Settings with call logs on (Android)", async () => {
    const os = jest.replaceProperty(Platform, "OS", "android");
    // Call-through spy: records the app's AppState listeners without replacing the real ones.
    const appState = jest.spyOn(AppState, "addEventListener");
    fakeCompass();
    renderRouter("./src/app", { initialUrl: "/" });
    await screen.findByLabelText("Asha Rao, open lead");
    dialer.__setCapabilities({ canReadCallLog: false }); // turned off after the app opened

    fireEvent.press(screen.getByLabelText("Call Asha Rao"));
    expect(await screen.findByText("Allow calling from the app")).toBeTruthy();

    dialer.__setCapabilities({ canReadCallLog: true }); // turned on in Settings
    // The permissions screen mounted last, so its listener is the newest one.
    const onChange = appState.mock.calls.at(-1)?.[1] as (s: string) => void;
    await act(async () => onChange("active"));
    await waitFor(() => expect(dialer.placeCall).toHaveBeenCalledWith("+919876500001", null));
    os.restore();
  });

  it("asks again on every call while access is off, even after the first time (Android)", async () => {
    const os = jest.replaceProperty(Platform, "OS", "android");
    fakeCompass();
    useSettingsStore.setState({ permissionIntroSeen: true });
    renderRouter("./src/app", { initialUrl: "/" });
    await screen.findByLabelText("Asha Rao, open lead");
    dialer.__setCapabilities({ canReadCallLog: false }); // turned off after the app opened

    fireEvent.press(screen.getByLabelText("Call Asha Rao"));
    expect(await screen.findByText("Allow calling from the app")).toBeTruthy();
    expect(dialer.placeCall).not.toHaveBeenCalled();
    os.restore();
  });

  it("calls straight away on Android when call-log access is already granted", async () => {
    const os = jest.replaceProperty(Platform, "OS", "android");
    fakeCompass();
    useSettingsStore.setState({ permissionIntroSeen: false });
    renderRouter("./src/app", { initialUrl: "/" });
    await screen.findByLabelText("Asha Rao, open lead");

    fireEvent.press(screen.getByLabelText("Call Asha Rao"));
    await waitFor(() => expect(dialer.placeCall).toHaveBeenCalledWith("+919876500001", null));
    expect(screen.queryByText("Allow calling from the app")).toBeNull();
    os.restore();
  });

  it("calls straight away on iPhone, with no permission screen", async () => {
    fakeCompass();
    useSettingsStore.setState({ permissionIntroSeen: false });
    renderRouter("./src/app", { initialUrl: "/" });
    await screen.findByLabelText("Asha Rao, open lead");

    fireEvent.press(screen.getByLabelText("Call Asha Rao"));
    await waitFor(() => expect(dialer.placeCall).toHaveBeenCalledWith("+919876500001", null));
    expect(screen.queryByText("Allow calling from the app")).toBeNull();
  });
});

describe("saving calls to Compass", () => {
  it("shows when Compass refuses the call log, and lets the agent retry", async () => {
    const server = fakeCompass();
    server.on("POST", "/activities/log", {
      body: {
        lead_id: null,
        activity_id: null,
        lead_created: false,
        message: 'Activity type "manual_outbound_call" not found',
      },
    });
    const { start } = await callAsha(server);
    dialer.__setCallLog({ talkSeconds: 0, startedAt: start });
    act(() => dialer.__emit({ state: "idle", at: start + 20_000 }));

    expect(await screen.findByText("1 call couldn't be saved to Compass")).toBeTruthy();
    fireEvent.press(screen.getByText("1 call couldn't be saved to Compass"));
    expect(alertSpy).toHaveBeenLastCalledWith(
      "1 call not saved to Compass",
      'Activity type "manual_outbound_call" not found',
      expect.any(Array),
    );

    // Fixed in Compass: Retry sends it
    server.on("POST", "/activities/log", {
      body: { lead_id: "501", activity_id: "8002", lead_created: false, message: "" },
    });
    const buttons = (alertSpy.mock.calls.at(-1)?.[2] ?? []) as { text?: string; onPress?: () => void }[];
    await act(async () => buttons.find((b) => b.text === "Retry")?.onPress?.());
    await waitFor(() => expect(useCallLog.getState().calls[0]?.status).toBe("sent"));
    expect(screen.queryByText(/couldn't be saved to Compass/)).toBeNull();
  });

  it("keeps the call when offline and shows it's waiting", async () => {
    const server = fakeCompass();
    server.on("POST", "/activities/log", "network-error");
    const { start } = await callAsha(server);
    dialer.__setCallLog({ talkSeconds: 12, startedAt: start });
    act(() => dialer.__emit({ state: "idle", at: start + 20_000 }));

    expect(await screen.findByText("1 call waiting to save to Compass")).toBeTruthy();
    expect(useCallLog.getState().calls[0]).toMatchObject({
      status: "pending",
      attempts: 1,
      talkTimeSeconds: 12,
    });
  });
});

describe("guards", () => {
  it("asks before starting a second call while one is still live", async () => {
    await callAsha();
    (dialer.placeCall as jest.Mock).mockClear();
    fireEvent.press(screen.getByLabelText("Call Asha Rao"));
    expect(alertSpy).toHaveBeenLastCalledWith("A call is still open", expect.any(String), expect.any(Array));
    expect(dialer.placeCall).not.toHaveBeenCalled();
  });
});

describe("WhatsApp", () => {
  it("opens a WhatsApp chat with the lead's number from the list and from their page", async () => {
    const openURL = jest.spyOn(Linking, "openURL").mockResolvedValue(true);
    fakeCompass();
    renderRouter("./src/app", { initialUrl: "/" });
    await screen.findByLabelText("Asha Rao, open lead");

    fireEvent.press(screen.getByLabelText("WhatsApp Asha Rao"));
    expect(openURL).toHaveBeenLastCalledWith("https://wa.me/919876500001");
    // No number, no WhatsApp
    expect(screen.getByLabelText("WhatsApp Kiran")).toBeDisabled();

    fireEvent.press(screen.getByLabelText("Asha Rao, open lead"));
    await screen.findByText("+91-9876500001");
    fireEvent.press(screen.getByLabelText("WhatsApp Asha Rao"));
    expect(openURL).toHaveBeenLastCalledWith("https://wa.me/919876500001");
    expect(dialer.placeCall).not.toHaveBeenCalled();
    openURL.mockRestore();
  });

  it("explains when WhatsApp can't be opened", async () => {
    const openURL = jest.spyOn(Linking, "openURL").mockRejectedValue(new Error("no handler"));
    fakeCompass();
    renderRouter("./src/app", { initialUrl: "/" });
    await screen.findByLabelText("Asha Rao, open lead");

    fireEvent.press(screen.getByLabelText("WhatsApp Asha Rao"));
    await waitFor(() =>
      expect(alertSpy).toHaveBeenLastCalledWith("Couldn't open WhatsApp", expect.any(String)),
    );
    openURL.mockRestore();
  });
});

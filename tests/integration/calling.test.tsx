/// <reference types="jest" />
/// <reference types="node" />
/**
 * Integration: tap Call → phone call events → outcome sheet → saved to Compass (or queued),
 * rendering the real app with a fake Compass and the sim-dialer test double.
 */
import { Alert, Platform } from "react-native";
import { act, fireEvent, screen, waitFor } from "@testing-library/react-native";
import { router } from "expo-router";
import { renderRouter } from "expo-router/testing-library";

import * as SimDialer from "@modules/sim-dialer";
import { useCallStore } from "@/store/call.store";
import { useOutcomeQueue } from "@/store/outcomeQueue.store";
import { useSettingsStore } from "@/store/settings.store";
import { fakeCompass } from "../support/compass";
import { resetAppState, signedInAs } from "../support/state";

jest.mock("@modules/sim-dialer");
const dialer = SimDialer as typeof SimDialer & {
  __reset: () => void;
  __emit: (e: { state: string; at: number; connected?: boolean }) => void;
  __setCapabilities: (c: object) => void;
};

type AlertButton = { text?: string; onPress?: () => void };
const alertSpy = jest.spyOn(Alert, "alert");
/** Press a button in the most recent Alert by its label. */
async function pressAlertButton(text: string) {
  const buttons = (alertSpy.mock.calls.at(-1)?.[2] ?? []) as AlertButton[];
  await act(async () => {
    buttons.find((b) => b.text === text)?.onPress?.();
  });
}

beforeEach(async () => {
  await resetAppState();
  dialer.__reset();
  alertSpy.mockClear();
  signedInAs();
  useSettingsStore.setState({ permissionIntroSeen: true });
});

/** Open the app, call the first lead and let the phone report a call that rang out. */
async function callAndHangUp(server = fakeCompass()) {
  renderRouter("./src/app", { initialUrl: "/" });
  await screen.findByText("Asha Rao");

  fireEvent.press(screen.getByLabelText("Call Asha Rao"));
  await waitFor(() => expect(dialer.placeCall).toHaveBeenCalledWith("+919876500001", null));

  const start = Date.now();
  act(() => dialer.__emit({ state: "offhook", at: start + 1_000 }));
  expect(await screen.findByText("Calling Asha Rao")).toBeTruthy();
  act(() => dialer.__emit({ state: "idle", at: start + 31_000 }));

  expect(await screen.findByText("How did the call go?")).toBeTruthy();
  return server;
}

/** Fill in the Not Connected sub-form. */
function fillNotConnected() {
  fireEvent.press(screen.getByText("Not Connected"));
  fireEvent.press(screen.getByText("No Answer"));
  fireEvent.press(screen.getByText("In 1 hour"));
  fireEvent.changeText(screen.getByTestId("field-notes"), "Rang out, will retry");
}

describe("calling a lead", () => {
  it("places the call, opens the outcome sheet and saves the outcome to Compass", async () => {
    const server = await callAndHangUp();

    // The form loaded during the call
    expect(server.find("GET", "/opportunities/7001/activity-form/config")).toHaveLength(1);
    expect(screen.getByText("New Lead (now)")).toBeTruthy();

    // Validation runs on the phone, nothing is sent
    fireEvent.press(screen.getByText("Save to Compass"));
    expect(screen.getByText("Pick the stage that describes this call.")).toBeTruthy();
    fireEvent.press(screen.getByText("Not Connected"));
    fireEvent.press(screen.getByText("Save to Compass"));
    expect(screen.getByText("Select Outcome is required.")).toBeTruthy();
    expect(screen.getByText("Notes is required.")).toBeTruthy();
    expect(server.find("POST", /activity-form$/)).toHaveLength(0);

    fillNotConnected();
    fireEvent.changeText(screen.getByTestId("outcome-note"), "Prefers evenings");
    fireEvent.press(screen.getByText("Save to Compass"));

    await waitFor(() => expect(server.find("POST", /activity-form$/)).toHaveLength(1));
    const [save] = server.find("POST", "/opportunities/7001/activity-form");
    expect(save?.body).toEqual({
      stage_code: "not_connected",
      submitted_by_user_id: "31",
      concerns_raised: "Prefers evenings",
      sub_form_data: expect.objectContaining({
        select_outcome: "No Answer",
        notes: "Rang out, will retry",
        next_follow_up_datetime: expect.stringMatching(/^\d{4}-\d\d-\d\dT.*Z$/),
        call_source: "mobile_app",
        call_platform: "android",
        call_answered: "unknown",
        call_duration_seconds: "30",
      }),
    });

    // Back on the list, the call is cleared
    await waitFor(() => expect(useCallStore.getState().session).toBeNull());
    expect(await screen.findByText("My leads")).toBeTruthy();
    expect(screen.queryByText(/Record the call to/)).toBeNull();
  });

  it("keeps the outcome on the phone when Compass can't be reached, then sends it", async () => {
    const server = await callAndHangUp();
    server.on("POST", /activity-form$/, "network-error");

    fillNotConnected();
    fireEvent.press(screen.getByText("Save to Compass"));

    await waitFor(() => expect(alertSpy).toHaveBeenCalledWith("Saved on your phone", expect.any(String)));
    expect(useOutcomeQueue.getState().items).toHaveLength(1);
    expect(await screen.findByText("1 outcome waiting to send")).toBeTruthy();

    // Compass is back: the agent retries from the "Waiting to send" screen
    server.on("POST", /activity-form$/, { status: 201, body: { success: true } });
    fireEvent.press(screen.getByText("1 outcome waiting to send"));
    expect(await screen.findByText("Waiting to send")).toBeTruthy();
    fireEvent.press(screen.getByText("Retry now"));

    expect(await screen.findByText("All sent")).toBeTruthy();
    expect(useOutcomeQueue.getState().items).toEqual([]);
  });

  it("shows why Compass refused it and lets the agent discard a lead that was reassigned", async () => {
    const server = await callAndHangUp();
    server.on("POST", /activity-form$/, { status: 403, body: { message: "Forbidden resource" } });

    fillNotConnected();
    fireEvent.press(screen.getByText("Save to Compass"));

    expect(await screen.findByText(/isn't assigned to you any more/)).toBeTruthy();
    expect(screen.queryByText("Save to Compass")).toBeNull();
    expect(useOutcomeQueue.getState().items).toEqual([]); // never queued

    fireEvent.press(screen.getByText("Didn't call"));
    expect(alertSpy).toHaveBeenLastCalledWith("Discard this call?", expect.any(String), expect.any(Array));
    await pressAlertButton("Discard");
    await waitFor(() => expect(useCallStore.getState().session).toBeNull());
    // The sheet closes itself and the agent is back on the list
    expect(await screen.findByText("My leads")).toBeTruthy();
  });

  it("asks for the phone permissions once before the first call (Android)", async () => {
    // The explainer is Android-only (iOS needs no permission); Jest defaults to iOS.
    const os = jest.replaceProperty(Platform, "OS", "android");
    fakeCompass();
    useSettingsStore.setState({ permissionIntroSeen: false });
    renderRouter("./src/app", { initialUrl: "/" });
    await screen.findByText("Asha Rao");

    fireEvent.press(screen.getByLabelText("Call Asha Rao"));
    expect(await screen.findByText("Allow calling from the app")).toBeTruthy();
    expect(dialer.placeCall).not.toHaveBeenCalled();

    fireEvent.press(screen.getByText("Allow"));
    await waitFor(() => expect(dialer.requestPermissions).toHaveBeenCalled());
    await waitFor(() => expect(dialer.placeCall).toHaveBeenCalledWith("+919876500001", null));
    expect(useSettingsStore.getState().permissionIntroSeen).toBe(true);
    os.restore();
  });

  it("calls straight away on iPhone, with no permission screen", async () => {
    fakeCompass();
    useSettingsStore.setState({ permissionIntroSeen: false });
    renderRouter("./src/app", { initialUrl: "/" });
    await screen.findByText("Asha Rao");

    fireEvent.press(screen.getByLabelText("Call Asha Rao"));
    await waitFor(() => expect(dialer.placeCall).toHaveBeenCalledWith("+919876500001", null));
    expect(screen.queryByText("Allow calling from the app")).toBeNull();
  });

  it("restores an unsaved call after the app restarts", async () => {
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
        status: "ended",
        tappedAt: now - 60_000,
        startedAt: now - 59_000,
        connectedAt: null,
        endedAt: now - 30_000,
        connected: null,
        endApproximate: false,
      },
    });

    renderRouter("./src/app", { initialUrl: "/" });
    expect(await screen.findByText("How did the call go?")).toBeTruthy();
    expect(screen.getByText("Asha Rao")).toBeTruthy();
  });
});

describe("guards", () => {
  it("blocks a new call while the last outcome is unsaved", async () => {
    await callAndHangUp();
    // Go back to the list without saving (the sheet ignores Back; use the router directly)
    await act(async () => router.back());
    await screen.findByText(/Record the call to Asha Rao/);

    (dialer.placeCall as jest.Mock).mockClear();
    fireEvent.press(screen.getByLabelText("Call Asha Rao"));
    await waitFor(() =>
      expect(alertSpy).toHaveBeenLastCalledWith(
        "Save the last call first",
        expect.any(String),
        expect.any(Array),
      ),
    );
    expect(dialer.placeCall).not.toHaveBeenCalled();
  });

  it("asks before logging out with outcomes still waiting to send", async () => {
    fakeCompass();
    useOutcomeQueue.setState({
      items: [
        {
          id: "q1",
          userId: "31",
          opportunityId: "7001",
          leadName: "Asha Rao",
          payload: { stage_code: "not_connected", submitted_by_user_id: "31" },
          createdAt: Date.now(),
          attempts: 1,
          nextAttemptAt: Date.now() + 600_000,
          status: "pending",
          lastError: "Can't reach Compass",
        },
      ],
    });
    renderRouter("./src/app", { initialUrl: "/settings" });
    fireEvent.press(await screen.findByText("Log out"));
    expect(alertSpy).toHaveBeenLastCalledWith(
      "Outcomes still waiting to send",
      expect.stringMatching(/1 outcome hasn't reached Compass/),
      expect.any(Array),
    );
  });
});

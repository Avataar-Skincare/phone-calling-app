/// <reference types="jest" />
/// <reference types="node" />
/**
 * Integration: account screen (session details, permissions, SIM choice, logout) and the
 * "call still open" guard.
 */
import { Alert, Platform } from "react-native";
import { act, fireEvent, screen, waitFor } from "@testing-library/react-native";
import { renderRouter } from "expo-router/testing-library";

import * as SimDialer from "@modules/sim-dialer";
import { useAuthStore } from "@/store/auth.store";
import { useCallStore } from "@/store/call.store";
import { useCallLog, type FinishedCall } from "@/store/callLog.store";
import { useSettingsStore } from "@/store/settings.store";
import { fakeCompass } from "../support/compass";
import { resetAppState, signedInAs } from "../support/state";

jest.mock("@modules/sim-dialer");
const dialer = SimDialer as typeof SimDialer & {
  __reset: () => void;
  __setPermissions: (p: object) => void;
  __setSims: (s: { id: string; label: string }[]) => void;
};
const alertSpy = jest.spyOn(Alert, "alert");

beforeEach(async () => {
  await resetAppState();
  dialer.__reset();
  alertSpy.mockClear();
  signedInAs();
});

describe("account screen", () => {
  it("shows who is logged in and logs out", async () => {
    fakeCompass();
    renderRouter("./src/app", { initialUrl: "/settings" });

    expect(await screen.findByText("Account")).toBeTruthy();
    expect(screen.getByText("Test Agent")).toBeTruthy();
    expect(screen.getByText("+91 90000 00001")).toBeTruthy();
    expect(screen.getByText("Agent")).toBeTruthy();
    expect(screen.getByText("Testing")).toBeTruthy();

    fireEvent.press(screen.getByText("Log out"));
    await waitFor(() => expect(useAuthStore.getState().session).toBeNull());
    expect(await screen.findByText("Log in with your Compass number")).toBeTruthy();
  });

  it("asks before logging out while calls haven't reached Compass", async () => {
    fakeCompass();
    useCallLog.setState({
      calls: [{ id: "c1", userId: "31", status: "pending", attempts: 2 } as FinishedCall],
    });
    renderRouter("./src/app", { initialUrl: "/settings" });
    fireEvent.press(await screen.findByText("Log out"));
    expect(alertSpy).toHaveBeenLastCalledWith(
      "Calls not saved to Compass yet",
      expect.stringMatching(/1 call hasn't reached Compass/),
      expect.any(Array),
    );
    expect(useAuthStore.getState().session).not.toBeNull();
  });

  it("asks before logging out during a call", async () => {
    fakeCompass();
    useCallStore.setState({
      session: {
        id: "s1",
        name: "Asha Rao",
        phone: "+919876500001",
        opportunityId: "7001",
        leadId: "501",
        taskId: null,
        platform: "android",
        tracked: true,
        mode: "direct",
        simId: null,
        status: "in_call",
        tappedAt: Date.now(),
        startedAt: Date.now(),
        connectedAt: null,
        endedAt: null,
        connected: null,
        endApproximate: false,
      },
    });
    renderRouter("./src/app", { initialUrl: "/settings" });
    fireEvent.press(await screen.findByText("Log out"));
    expect(alertSpy).toHaveBeenLastCalledWith(
      "A call is in progress",
      expect.stringMatching(/Asha Rao/),
      expect.any(Array),
    );
    expect(useAuthStore.getState().session).not.toBeNull();
  });

  describe("on Android", () => {
    let os: { restore: () => void };
    beforeEach(() => {
      os = jest.replaceProperty(Platform, "OS", "android");
    });
    afterEach(() => os.restore());

    it("lets the agent pick which SIM to call from", async () => {
      fakeCompass();
      dialer.__setSims([
        { id: "sim-1", label: "Jio" },
        { id: "sim-2", label: "Airtel" },
      ]);
      renderRouter("./src/app", { initialUrl: "/settings" });

      expect(await screen.findByText("Call from")).toBeTruthy();
      expect(screen.getByRole("radio", { name: "Phone's default", checked: true })).toBeTruthy();
      fireEvent.press(screen.getByText("Airtel"));
      expect(useSettingsStore.getState().simId).toBe("sim-2");
      expect(screen.getByRole("radio", { name: "Airtel", checked: true })).toBeTruthy();
    });

    it("hides the SIM choice with a single SIM", async () => {
      fakeCompass();
      renderRouter("./src/app", { initialUrl: "/settings" });
      expect(await screen.findByText("Phone permissions")).toBeTruthy();
      expect(screen.queryByText("Call from")).toBeNull();
    });

    it("offers to allow permissions, or Settings when they were blocked", async () => {
      fakeCompass();
      dialer.__setPermissions({ granted: false, status: "denied", canAskAgain: true });
      renderRouter("./src/app", { initialUrl: "/settings" });

      expect(await screen.findByText(/Not allowed/)).toBeTruthy();
      dialer.__setPermissions({ granted: true, status: "granted" });
      fireEvent.press(screen.getByText("Allow"));
      expect(await screen.findByText(/Allowed\. Calls start straight away/)).toBeTruthy();
      expect(dialer.requestPermissions).toHaveBeenCalled();
      expect(dialer.startTracking).toHaveBeenCalled();
    });

    it("sends a blocked user to the system Settings", async () => {
      fakeCompass();
      dialer.__setPermissions({ granted: false, status: "denied", canAskAgain: false });
      renderRouter("./src/app", { initialUrl: "/settings" });
      expect(await screen.findByText("Open Settings")).toBeTruthy();
    });
  });
});

describe("call guard", () => {
  it("offers to clear a call that is still open before starting another", async () => {
    fakeCompass();
    useSettingsStore.setState({ permissionIntroSeen: true });
    useCallStore.setState({
      session: {
        id: "old",
        name: "Meera Iyer",
        phone: "+919876500003",
        opportunityId: "7003",
        leadId: "503",
        taskId: null,
        platform: "android",
        tracked: true,
        mode: "direct",
        simId: null,
        status: "in_call",
        tappedAt: Date.now(),
        startedAt: Date.now(),
        connectedAt: null,
        endedAt: null,
        connected: null,
        endApproximate: false,
      },
    });
    renderRouter("./src/app", { initialUrl: "/" });
    await screen.findByLabelText("Asha Rao, open lead");

    fireEvent.press(screen.getByLabelText("Call Asha Rao"));
    await waitFor(() =>
      expect(alertSpy).toHaveBeenLastCalledWith(
        "A call is still open",
        expect.any(String),
        expect.any(Array),
      ),
    );
    expect(dialer.placeCall).not.toHaveBeenCalled();

    const buttons = alertSpy.mock.calls.at(-1)?.[2] as { text: string; onPress?: () => void }[];
    await act(async () => buttons.find((b) => b.text === "Clear and call")?.onPress?.());
    await waitFor(() => expect(dialer.placeCall).toHaveBeenCalledWith("+919876500001", null));
    expect(useCallStore.getState().session?.name).toBe("Asha Rao");
  });
});

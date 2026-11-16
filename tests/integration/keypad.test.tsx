/// <reference types="jest" />
/// <reference types="node" />
/**
 * Integration: Keypad → claim the lead in Compass → dial through the normal call flow (ADR 0009).
 * The call always goes ahead, whatever the claim does.
 */
import { Alert } from "react-native";
import { act, fireEvent, screen, waitFor } from "@testing-library/react-native";
import { renderRouter } from "expo-router/testing-library";

import * as SimDialer from "@modules/sim-dialer";
import { useCallLog } from "@/store/callLog.store";
import { useCallStore } from "@/store/call.store";
import { useSettingsStore } from "@/store/settings.store";
import { agent, fakeCompass } from "../support/compass";
import { resetAppState, signedInAs } from "../support/state";

jest.mock("@modules/sim-dialer");
const dialer = SimDialer as typeof SimDialer & {
  __reset: () => void;
  __emit: (e: { state: string; at: number; connected?: boolean }) => void;
  __setCallLog: (e: { talkSeconds: number; startedAt: number } | null) => void;
};

jest.spyOn(Alert, "alert");

beforeEach(async () => {
  await resetAppState();
  dialer.__reset();
  signedInAs();
  useSettingsStore.setState({ permissionIntroSeen: true });
});

const CLAIM = "/mobile-dialer/claim";

async function openKeypad() {
  renderRouter("./src/app", { initialUrl: "/" });
  await screen.findByLabelText("Asha Rao, open lead");
  fireEvent.press(screen.getByLabelText("Keypad"));
  await screen.findByText("Keypad");
}

function enter(text: string) {
  fireEvent.changeText(screen.getByLabelText("Phone number"), text);
}

describe("keypad dialing", () => {
  it("claims the lead first, then dials, and logs the call on the claimed opportunity", async () => {
    const server = fakeCompass();
    // Record how many claim requests had been sent at the moment the phone was dialed
    let claimsAtDial = -1;
    (dialer.placeCall as jest.Mock).mockImplementationOnce(async () => {
      claimsAtDial = server.find("POST", CLAIM).length;
    });

    await openKeypad();
    enter("+91 98765-00001");
    expect(screen.getByText("+91 98765 00001")).toBeTruthy();
    fireEvent.press(screen.getByLabelText("Call number"));

    await waitFor(() => expect(dialer.placeCall).toHaveBeenCalledWith("+919876500001", null));
    expect(claimsAtDial).toBe(1);
    expect(server.find("POST", CLAIM)[0]?.body).toEqual({ phone: "+91 98765-00001" });
    expect(await screen.findByText("Lead moved to you from Rahul.")).toBeTruthy();

    const start = Date.now();
    act(() => dialer.__emit({ state: "offhook", at: start + 1_000 }));
    expect(await screen.findByText("Calling Asha Rao")).toBeTruthy();
    dialer.__setCallLog({ talkSeconds: 30, startedAt: start });
    act(() => dialer.__emit({ state: "idle", at: start + 45_000 }));

    await waitFor(() => expect(useCallLog.getState().calls[0]?.status).toBe("sent"));
    expect(useCallLog.getState().calls[0]).toMatchObject({ name: "Asha Rao", opportunityId: "7001" });
    expect(server.find("POST", "/activities/log")[0]?.body).toMatchObject({
      phone: "9876500001",
      activity_type: "manual_outbound_call",
      opportunity_id: "7001",
    });
    // The status message is still there after the call
    expect(screen.getByText("Lead moved to you from Rahul.")).toBeTruthy();
  });

  it("edits with the on-screen keys", async () => {
    fakeCompass();
    await openKeypad();
    for (const d of "9876500001") fireEvent.press(screen.getByLabelText(`Key ${d}`));
    expect(screen.getByLabelText("Phone number").props.value).toBe("9876500001");
    fireEvent.press(screen.getByLabelText("Backspace"));
    expect(screen.getByLabelText("Phone number").props.value).toBe("987650000");
    fireEvent.press(screen.getByLabelText("Clear number"));
    expect(screen.getByLabelText("Phone number").props.value).toBe("");
  });

  it("still dials when Compass fails", async () => {
    const server = fakeCompass();
    server.on("POST", CLAIM, { status: 500, body: { statusCode: 500, message: "boom" } });
    await openKeypad();
    enter("9876500001");
    fireEvent.press(screen.getByLabelText("Call number"));

    await waitFor(() => expect(dialer.placeCall).toHaveBeenCalledWith("+919876500001", null));
    expect(await screen.findByText("Could not reach Compass. Calling now. Owner not changed.")).toBeTruthy();
    expect(useCallStore.getState().session).toMatchObject({
      name: "+91 98765 00001",
      opportunityId: null,
      leadId: null,
    });
  });

  it("still dials when Compass says only Sales can take leads", async () => {
    signedInAs({ ...agent, departmentId: "3" }); // a Central user
    const server = fakeCompass();
    server.on("POST", CLAIM, {
      body: {
        status: "not_sales",
        lead_id: null,
        lead_name: null,
        lead_created: false,
        opportunity_id: null,
        previous_owner_user_id: null,
        previous_owner_name: null,
        changed: false,
      },
    });
    await openKeypad();
    enter("9876500001");
    fireEvent.press(screen.getByLabelText("Call number"));

    await waitFor(() => expect(dialer.placeCall).toHaveBeenCalledWith("+919876500001", null));
    expect(
      await screen.findByText(
        "You are a Central user. Only Sales users can change the owner by manual dialing.",
      ),
    ).toBeTruthy();
  });

  it("dials after 3 s when Compass is too slow", async () => {
    const server = fakeCompass();
    server.on("POST", CLAIM, () => new Promise(() => {}));
    await openKeypad();
    enter("9876500001");
    fireEvent.press(screen.getByLabelText("Call number"));

    expect(dialer.placeCall).not.toHaveBeenCalled();
    await waitFor(() => expect(dialer.placeCall).toHaveBeenCalledWith("+919876500001", null), {
      timeout: 6_000,
    });
    expect(await screen.findByText("Could not reach Compass. Calling now. Owner not changed.")).toBeTruthy();
  }, 15_000);

  it("won't call a number that is too short, and sends nothing", async () => {
    const server = fakeCompass();
    await openKeypad();
    enter("98765");
    expect(screen.getByText("Enter a 10 digit mobile number")).toBeTruthy();
    fireEvent.press(screen.getByLabelText("Call number"));
    expect(server.find("POST", CLAIM)).toHaveLength(0);
    expect(dialer.placeCall).not.toHaveBeenCalled();
  });

  it("list calls never touch the claim endpoint", async () => {
    const server = fakeCompass();
    renderRouter("./src/app", { initialUrl: "/" });
    await screen.findByLabelText("Asha Rao, open lead");
    fireEvent.press(screen.getByLabelText("Call Asha Rao"));
    await waitFor(() => expect(dialer.placeCall).toHaveBeenCalled());
    expect(server.find("POST", CLAIM)).toHaveLength(0);
  });
});

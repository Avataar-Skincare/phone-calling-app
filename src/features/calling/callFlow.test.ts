/// <reference types="jest" />
/// <reference types="node" />
/**
 * Integration: placing a call wires the native module, the call store and the outcome form.
 */
import * as SimDialer from "@modules/sim-dialer";
import { useCallStore } from "@/store/call.store";
import { useSettingsStore } from "@/store/settings.store";
import { fakeCompass } from "../../../tests/support/compass";
import { resetAppState, signedInAs } from "../../../tests/support/state";
import { startCall } from "./callFlow";

jest.mock("@modules/sim-dialer");
const dialer = SimDialer as typeof SimDialer & {
  __reset: () => void;
  __setCapabilities: (c: object) => void;
};

const target = {
  name: "Asha Rao",
  phone: "+919876500001",
  opportunityId: "7001",
  leadId: "501",
  taskId: "9001",
};

beforeEach(async () => {
  await resetAppState();
  dialer.__reset();
  signedInAs();
});

describe("startCall", () => {
  it("stores the session before dialing, so the first call event is never missed", async () => {
    fakeCompass();
    let sessionWhenDialing: unknown;
    (dialer.placeCall as jest.Mock).mockImplementationOnce(async () => {
      sessionWhenDialing = useCallStore.getState().session;
      return "direct";
    });

    await startCall(target);

    expect(sessionWhenDialing).toMatchObject({ status: "dialing", name: "Asha Rao", tracked: true });
    expect(useCallStore.getState().session).toMatchObject({ mode: "direct", platform: "android" });
  });

  it("dials the E.164 number on the chosen SIM", async () => {
    fakeCompass();
    useSettingsStore.getState().setSimId("sim-2");
    await startCall(target);
    expect(dialer.placeCall).toHaveBeenCalledWith("+919876500001", "sim-2");
  });

  it("ignores the saved SIM when the phone can't choose one", async () => {
    fakeCompass();
    dialer.__setCapabilities({ canChooseSim: false });
    useSettingsStore.getState().setSimId("sim-2");
    await startCall(target);
    expect(dialer.placeCall).toHaveBeenCalledWith("+919876500001", null);
  });

  it("loads the outcome form during the call", async () => {
    const server = fakeCompass();
    await startCall(target);
    await new Promise((r) => setTimeout(r, 0));
    expect(server.find("GET", "/opportunities/7001/activity-form/config")).toHaveLength(1);
  });

  it("removes the session again if dialing fails", async () => {
    fakeCompass();
    (dialer.placeCall as jest.Mock).mockRejectedValueOnce(
      new Error("This phone has no app that can place calls."),
    );
    await expect(startCall(target)).rejects.toThrow(/no app that can place calls/);
    expect(useCallStore.getState().session).toBeNull();
  });

  it("records an untracked session when call state can't be read", async () => {
    fakeCompass();
    dialer.__setCapabilities({ canTrack: false, canDirectDial: false });
    await startCall(target);
    expect(useCallStore.getState().session).toMatchObject({ tracked: false, mode: "dialer" });
  });
});

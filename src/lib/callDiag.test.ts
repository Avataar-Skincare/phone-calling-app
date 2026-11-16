/// <reference types="jest" />
import { appLabel, buildCallDiag, deviceLabel, logVisible, lookupReason } from "./callDiag";

const base = {
  canDirectDial: true,
  canChooseSim: true,
  canReadCallLog: true,
  visibleCount: 0,
  debug: { permission: true, outgoingSince: 0, matchedNumber: false },
  brand: "Xiaomi",
  model: "Redmi Note 12",
  release: "14",
  appVersion: "1.0.0",
  nativeBuild: "12",
};

describe("buildCallDiag", () => {
  it("describes the Bavadharani case: permissions on, but the phone shows no call log", () => {
    expect(buildCallDiag(base)).toEqual({
      phone: "granted",
      phone_state: "granted",
      call_log: "granted",
      call_log_visible: "no",
      lookup: "not_found",
      device: "Xiaomi Redmi Note 12 · Android 14",
      app: "1.0.0 (12)",
    });
  });

  it("reports each permission on its own", () => {
    const d = buildCallDiag({ ...base, canDirectDial: false, canChooseSim: null, canReadCallLog: false });
    expect(d).toMatchObject({ phone: "denied", phone_state: "denied", call_log: "denied" });
  });

  it("carries only the documented keys (no numbers, no log contents)", () => {
    expect(Object.keys(buildCallDiag(base)).sort()).toEqual(
      ["app", "call_log", "call_log_visible", "device", "lookup", "phone", "phone_state"].sort(),
    );
  });
});

describe("logVisible", () => {
  it.each([
    [25, "yes"],
    [1, "yes"],
    [0, "no"],
    [-1, "unknown"],
  ])("%d entries is %s", (n, want) => expect(logVisible(n)).toBe(want));
});

describe("lookupReason", () => {
  const dbg = (permission: boolean, outgoingSince: number, matchedNumber: boolean) => ({
    permission,
    outgoingSince,
    matchedNumber,
  });
  it("no permission", () => expect(lookupReason(dbg(false, 0, false), true)).toBe("no_permission"));
  it("outgoing calls seen, none to this number", () =>
    expect(lookupReason(dbg(true, 3, false), true)).toBe("number_mismatch"));
  it("nothing seen", () => expect(lookupReason(dbg(true, 0, false), true)).toBe("not_found"));
  it("number matched but no entry was returned", () =>
    expect(lookupReason(dbg(true, 1, true), true)).toBe("not_found"));
  it("no answer from the debug call: error, or no_permission when the capability says so", () => {
    expect(lookupReason(null, true)).toBe("error");
    expect(lookupReason(null, null)).toBe("error");
    expect(lookupReason(null, false)).toBe("no_permission");
  });
});

describe("labels", () => {
  it("builds the device label and copes with missing parts", () => {
    expect(deviceLabel("samsung", "SM-A135F", 13)).toBe("samsung SM-A135F · Android 13");
    expect(deviceLabel(undefined, undefined, undefined)).toBe("Unknown phone");
    expect(deviceLabel("Realme", "", "12")).toBe("Realme · Android 12");
  });
  it("builds the app label", () => {
    expect(appLabel("1.0.0", "7")).toBe("1.0.0 (7)");
    expect(appLabel("1.0.0", null)).toBe("1.0.0");
    expect(appLabel(undefined, undefined)).toBe("unknown");
  });
});

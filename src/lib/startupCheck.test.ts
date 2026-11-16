/// <reference types="jest" />
import {
  evaluateStartup,
  hasRequired,
  isGooglePhone,
  shouldShowSetup,
  skipIsActive,
  SKIP_MS,
  type StartupInput,
} from "./startupCheck";

const NOW = Date.parse("2026-11-13T10:00:00Z");
const ok: StartupInput = {
  phone: true,
  phoneState: true,
  callLog: true,
  callLogVisible: 20,
  dialerPackage: "com.samsung.android.dialer",
  skippedHiddenLogAt: null,
};
const ids = (i: Partial<StartupInput>, now = NOW) =>
  evaluateStartup({ ...ok, ...i }, now).map((x) => `${x.id}:${x.severity}`);

describe("evaluateStartup", () => {
  it("has nothing to say when all is well", () => {
    expect(ids({})).toEqual([]);
    expect(shouldShowSetup(evaluateStartup(ok, NOW))).toBe(false);
  });

  it("requires phone access", () => {
    expect(ids({ phone: false })).toEqual(["phone:required"]);
    expect(ids({ phoneState: false })).toEqual(["phone:required"]);
    expect(ids({ phone: false, phoneState: false })).toEqual(["phone:required"]);
  });

  it("requires call-log access (ADR 0008)", () => {
    expect(ids({ callLog: false })).toEqual(["call_log:required"]);
  });

  it("lists both when both are missing, phone first", () => {
    expect(ids({ phone: false, callLog: false })).toEqual(["phone:required", "call_log:required"]);
  });

  it("does not treat unknown permissions as missing", () => {
    expect(ids({ phone: null, phoneState: null, callLog: null })).toEqual([]);
  });

  it("warns when call logs are allowed but the phone shows none", () => {
    expect(ids({ callLogVisible: 0 })).toEqual(["hidden_log:warning"]);
  });

  it("does not warn when the count is unknown or there are entries", () => {
    expect(ids({ callLogVisible: -1 })).toEqual([]);
    expect(ids({ callLogVisible: 1 })).toEqual([]);
  });

  it("does not warn about hidden logs when the permission itself is missing (the required issue covers it)", () => {
    expect(ids({ callLog: false, callLogVisible: 0 })).toEqual(["call_log:required"]);
    expect(ids({ callLog: null, callLogVisible: 0 })).toEqual([]);
  });

  describe("skip", () => {
    it("is quiet for 24 hours", () => {
      expect(ids({ callLogVisible: 0, skippedHiddenLogAt: NOW - 60_000 })).toEqual([]);
      expect(ids({ callLogVisible: 0, skippedHiddenLogAt: NOW - SKIP_MS + 1 })).toEqual([]);
    });
    it("expires after 24 hours", () => {
      expect(ids({ callLogVisible: 0, skippedHiddenLogAt: NOW - SKIP_MS })).toEqual(["hidden_log:warning"]);
      expect(ids({ callLogVisible: 0, skippedHiddenLogAt: NOW - 3 * SKIP_MS })).toEqual([
        "hidden_log:warning",
      ]);
    });
    it("ignores a skip dated in the future (clock changed)", () => {
      expect(skipIsActive(NOW + 60_000, NOW)).toBe(false);
    });
    it("never hides a required issue", () => {
      expect(ids({ callLog: false, skippedHiddenLogAt: NOW })).toEqual(["call_log:required"]);
    });
    it("has no skip when never skipped", () => {
      expect(skipIsActive(null, NOW)).toBe(false);
    });
  });

  describe("recording tips", () => {
    it("shows the share steps on Google Phone", () => {
      expect(ids({ dialerPackage: "com.google.android.dialer" })).toEqual(["recordings_google:tip"]);
    });
    it("never asks for the recordings folder on the start screen (Settings has it)", () => {
      expect(ids({ dialerPackage: "com.samsung.android.dialer" })).toEqual([]);
      expect(ids({ dialerPackage: null })).toEqual([]);
    });
    it("tips alone never open the screen or block", () => {
      const issues = evaluateStartup({ ...ok, dialerPackage: "com.google.android.dialer" }, NOW);
      expect(shouldShowSetup(issues)).toBe(false);
      expect(hasRequired(issues)).toBe(false);
    });
  });

  it("combines everything", () => {
    expect(ids({ callLog: false, dialerPackage: "com.google.android.dialer" })).toEqual([
      "call_log:required",
      "recordings_google:tip",
    ]);
    const issues = evaluateStartup({ ...ok, callLogVisible: 0 }, NOW);
    expect(shouldShowSetup(issues)).toBe(true);
    expect(hasRequired(issues)).toBe(false);
  });
});

describe("isGooglePhone", () => {
  it("matches only Google's dialer", () => {
    expect(isGooglePhone("com.google.android.dialer")).toBe(true);
    expect(isGooglePhone("com.samsung.android.dialer")).toBe(false);
    expect(isGooglePhone(null)).toBe(false);
  });
});

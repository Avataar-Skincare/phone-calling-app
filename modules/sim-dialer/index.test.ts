/// <reference types="jest" />
/**
 * Without the native module (Expo Go, web, an old build) every function must still work:
 * calls open a plain tel: link and nothing is tracked.
 */
import { Linking } from "react-native";
import * as SimDialer from "./index";

describe("sim-dialer without the native module", () => {
  it("is reported as unavailable", () => {
    expect(SimDialer.isNativeDialerAvailable).toBe(false);
  });

  it("reports granted permissions and no tracking", async () => {
    await expect(SimDialer.getPermissions()).resolves.toMatchObject({ granted: true });
    await expect(SimDialer.requestPermissions()).resolves.toMatchObject({ granted: true });
    await expect(SimDialer.getCapabilities()).resolves.toEqual({
      platform: "fallback",
      canDirectDial: false,
      canTrack: false,
      canChooseSim: false,
      canReadCallLog: false,
    });
    await expect(SimDialer.startTracking()).resolves.toBe(false);
    await expect(SimDialer.getCallState()).resolves.toBe("unknown");
    await expect(SimDialer.listSims()).resolves.toEqual([]);
    await expect(SimDialer.getLastCallFromLog("+919876500001", 0)).resolves.toBeNull();
  });

  it("has no startup-check or call-log diagnostics (safe fallbacks)", async () => {
    await expect(SimDialer.getCallLogVisibleCount()).resolves.toBe(-1);
    await expect(SimDialer.getDefaultDialerPackage()).resolves.toBeNull();
    await expect(SimDialer.getCallLogLookupDebug("+919876500001", 0)).resolves.toBeNull();
  });

  it("has no recordings support", async () => {
    await expect(SimDialer.pickRecordingsFolder()).resolves.toBeNull();
    await expect(SimDialer.getRecordingsFolder("content://x")).resolves.toBeNull();
    await expect(SimDialer.listRecordings("content://x", 0, 1)).resolves.toEqual([]);
    await expect(SimDialer.uploadRecording("content://f", "https://s3", "audio/mp4", 1)).rejects.toThrow(
      "Android only",
    );
  });

  it("has no shared recordings", async () => {
    await expect(SimDialer.takeSharedRecording()).resolves.toBeNull();
    const sub = SimDialer.addSharedRecordingListener(() => {});
    expect(() => sub.remove()).not.toThrow();
  });

  it("dials with a tel: link", async () => {
    const open = jest.spyOn(Linking, "openURL").mockResolvedValue(true);
    await expect(SimDialer.placeCall("+919876500001", "sim-1")).resolves.toBe("dialer");
    expect(open).toHaveBeenCalledWith("tel:+919876500001");
  });

  it("returns a no-op listener", () => {
    const sub = SimDialer.addCallStateListener(() => {});
    expect(() => sub.remove()).not.toThrow();
  });
});

describe("sim-dialer on Android with a native module", () => {
  /** Load index.ts fresh with a fake native module, as Android. */
  function load(native: object) {
    jest.resetModules();
    jest.doMock("expo", () => ({ requireOptionalNativeModule: () => native }));
    const { Platform } = require("react-native") as typeof import("react-native");
    const os = jest.replaceProperty(Platform, "OS", "android");
    const mod = require("./index") as typeof SimDialer;
    return { mod, restore: () => os.restore() };
  }

  afterEach(() => jest.dontMock("expo"));

  it("falls back when the build predates the diagnostics functions", async () => {
    const { mod, restore } = load({ capabilities: async () => ({}) });
    expect(mod.isNativeDialerAvailable).toBe(true);
    await expect(mod.getCallLogVisibleCount()).resolves.toBe(-1);
    await expect(mod.getDefaultDialerPackage()).resolves.toBeNull();
    await expect(mod.getCallLogLookupDebug("+919876500001", 0)).resolves.toBeNull();
    restore();
  });

  it("returns what the native module reports, and falls back when it throws", async () => {
    const { mod, restore } = load({
      callLogVisibleCount: jest.fn(async () => 0),
      defaultDialerPackage: jest.fn(async () => "com.google.android.dialer"),
      callLogLookupDebug: jest.fn(async () => {
        throw new Error("boom");
      }),
    });
    await expect(mod.getCallLogVisibleCount()).resolves.toBe(0);
    await expect(mod.getDefaultDialerPackage()).resolves.toBe("com.google.android.dialer");
    await expect(mod.getCallLogLookupDebug("+919876500001", 5)).resolves.toBeNull();
    restore();
  });
});

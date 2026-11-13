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

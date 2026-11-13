/// <reference types="jest" />
import { mustAskForCallLog } from "./callPermission";

describe("mustAskForCallLog (ADR 0008)", () => {
  it("blocks Android calls until call-log access is granted", () => {
    expect(mustAskForCallLog("android", true, false)).toBe(true);
  });

  it("blocks when Android can't say whether access is granted", () => {
    expect(mustAskForCallLog("android", true, null)).toBe(true);
  });

  it("lets the call through once access is granted", () => {
    expect(mustAskForCallLog("android", true, true)).toBe(false);
  });

  it("never blocks iOS, which doesn't use the call log", () => {
    expect(mustAskForCallLog("ios", true, false)).toBe(false);
  });

  it("never blocks builds without the native module (Expo Go)", () => {
    expect(mustAskForCallLog("android", false, null)).toBe(false);
  });
});

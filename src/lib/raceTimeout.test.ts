/// <reference types="jest" />
import { raceTimeout } from "./raceTimeout";

describe("raceTimeout", () => {
  beforeEach(() => jest.useFakeTimers());
  afterEach(() => jest.useRealTimers());

  it("returns the value when it arrives in time", async () => {
    await expect(raceTimeout(Promise.resolve("ok"), 3000, "late")).resolves.toBe("ok");
  });

  it("returns the fallback when it is too slow", async () => {
    const result = raceTimeout(new Promise<string>(() => {}), 3000, "late");
    jest.advanceTimersByTime(3000);
    await expect(result).resolves.toBe("late");
  });

  it("returns the fallback when it rejects", async () => {
    await expect(raceTimeout(Promise.reject(new Error("x")), 3000, "failed")).resolves.toBe("failed");
  });

  it("leaves no timer running after a quick answer", async () => {
    await raceTimeout(Promise.resolve(1), 3000, 0);
    expect(jest.getTimerCount()).toBe(0);
  });
});

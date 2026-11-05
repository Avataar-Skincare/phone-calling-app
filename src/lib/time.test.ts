/// <reference types="jest" />
import { formatTimeIST, formatWhen, isOverdue } from "./time";

// "now" = 9 Nov 2026, 11:00 IST = 05:30 UTC
const now = Date.parse("2026-11-09T05:30:00Z");

describe("formatTimeIST", () => {
  it.each([
    ["2026-11-09T10:35:00Z", "4:05 pm"],
    ["2026-11-08T18:30:00Z", "12:00 am"],
    ["2026-11-09T06:30:00Z", "12:00 pm"],
    ["2026-11-09T11:30:00+05:30", "11:30 am"],
  ])("%s → %s", (input, expected) => {
    expect(formatTimeIST(input)).toBe(expected);
  });
});

describe("formatWhen", () => {
  it("labels today, yesterday and tomorrow on the IST calendar", () => {
    expect(formatWhen("2026-11-09T10:35:00Z", now)).toBe("Today 4:05 pm");
    expect(formatWhen("2026-11-08T18:30:00Z", now)).toBe("Today 12:00 am");
    expect(formatWhen("2026-11-08T18:29:00Z", now)).toBe("Yesterday 11:59 pm");
    expect(formatWhen("2026-11-10T06:00:00Z", now)).toBe("Tomorrow 11:30 am");
  });

  it("shows a date for other days, with the year only when it differs", () => {
    expect(formatWhen("2026-11-12T10:35:00Z", now)).toBe("12 Nov, 4:05 pm");
    expect(formatWhen("2025-12-31T10:00:00Z", now)).toBe("31 Dec 2025");
  });

  it("returns an empty string for missing or invalid input", () => {
    expect(formatWhen(null, now)).toBe("");
    expect(formatWhen(undefined, now)).toBe("");
    expect(formatWhen("not a date", now)).toBe("");
  });
});

describe("isOverdue", () => {
  it("compares against now", () => {
    expect(isOverdue("2026-11-09T05:29:00Z", now)).toBe(true);
    expect(isOverdue("2026-11-09T05:31:00Z", now)).toBe(false);
  });

  it("is never overdue without a valid date", () => {
    expect(isOverdue(null, now)).toBe(false);
    expect(isOverdue("garbage", now)).toBe(false);
  });
});

/// <reference types="jest" />
import {
  formatCallDuration,
  formatDateIN,
  formatLongIN,
  formatPhoneCompass,
  formatRupees,
  formatShortIN,
  formatSourceName,
  leadDisplayName,
  paymentStatusLabel,
  stageTone,
} from "./format";

// 4 Nov 2026, 20:18 IST
const t = "2026-11-04T14:48:00.000Z";

describe("dates (IST, Compass formats)", () => {
  it("formatDateIN", () => {
    expect(formatDateIN(t)).toBe("04/11/2026, 08:18 pm");
    expect(formatDateIN("2026-11-03T18:42:00.000Z")).toBe("04/11/2026, 12:12 am");
    expect(formatDateIN(null)).toBe("—");
    expect(formatDateIN("nope")).toBe("—");
  });

  it("formatShortIN and formatLongIN", () => {
    expect(formatShortIN(t)).toBe("4 Nov, 08:18 pm");
    expect(formatLongIN(t)).toBe("04 Nov 2026, 08:18 pm");
    expect(formatLongIN(undefined)).toBe("—");
  });
});

describe("formatPhoneCompass", () => {
  it.each([
    ["7895470490", "+91-7895470490"],
    ["+919876500001", "+919876500001"],
    ["12345", "12345"],
    [null, "—"],
  ])("%s → %s", (input, out) => {
    expect(formatPhoneCompass(input)).toBe(out);
  });
});

describe("other formatters", () => {
  it("shows sources as stored, with the alias", () => {
    expect(formatSourceName("slimming-short-journey")).toBe("slimming-short-journey");
    expect(formatSourceName("laser-short-journey")).toBe("facial-short-journey");
    expect(formatSourceName(null)).toBe("—");
  });

  it("formats call durations", () => {
    expect(formatCallDuration(192)).toBe("3m 12s");
    expect(formatCallDuration("45")).toBe("0m 45s");
    expect(formatCallDuration(0)).toBe("—");
    expect(formatCallDuration(null)).toBe("—");
  });

  it("formats rupees in Indian grouping", () => {
    expect(formatRupees(123456)).toBe("₹1,23,456");
    expect(formatRupees("1234567.5")).toBe("₹12,34,567.50");
    expect(formatRupees(999)).toBe("₹999");
    expect(formatRupees(null)).toBe("—");
  });

  it("names a lead like Compass", () => {
    expect(leadDisplayName("Tanya", "Kant")).toBe("Tanya Kant");
    expect(leadDisplayName(null, null, "9876500001")).toBe("9876500001");
    expect(leadDisplayName(" ", null)).toBe("Unknown Lead");
  });

  it("colours stages like Compass", () => {
    expect(stageTone("warm_consultation_done")).toBe("amber");
    expect(stageTone("hot_in_consideration")).toBe("orange");
    expect(stageTone("cold_future")).toBe("cyan");
    expect(stageTone("fully_paid")).toBe("green");
    expect(stageTone("complaint_open")).toBe("purple");
    expect(stageTone("new_lead")).toBe("brand");
    expect(stageTone("not_interested", "inactive")).toBe("red");
  });

  it("labels payment statuses", () => {
    expect(paymentStatusLabel("partial_paid")).toBe("Partial");
    expect(paymentStatusLabel(null)).toBe("—");
  });
});

describe("grouping (IST)", () => {
  // Wednesday 5 Nov 2026, 12:00 IST
  const now = Date.parse("2026-11-05T06:30:00Z");
  const { activityGroupLabel, taskDueGroup } = jest.requireActual("./format") as typeof import("./format");

  it("groups activities like the Compass timeline", () => {
    expect(activityGroupLabel("2026-11-05T01:00:00Z", now)).toBe("Today");
    expect(activityGroupLabel("2026-11-04T10:00:00Z", now)).toBe("Yesterday");
    expect(activityGroupLabel("2026-11-02T20:00:00Z", now)).toBe("Earlier This Week"); // Tue 3 Nov IST
    expect(activityGroupLabel("2026-11-01T10:00:00Z", now)).toBe("Nov 2026"); // Sunday, last week
    expect(activityGroupLabel("2026-02-26T10:00:00Z", now)).toBe("Feb 2026");
  });

  it("groups tasks like the Compass Tasks tab", () => {
    expect(taskDueGroup("2026-11-05T05:00:00Z", "pending", now)).toBe("Overdue");
    expect(taskDueGroup("2026-11-05T05:00:00Z", "completed", now)).toBe("Today");
    expect(taskDueGroup("2026-11-05T12:00:00Z", "pending", now)).toBe("Today");
    expect(taskDueGroup("2026-11-07T06:00:00Z", "pending", now)).toBe("This Week"); // Saturday
    expect(taskDueGroup("2026-11-10T06:00:00Z", "pending", now)).toBe("Later");
    expect(taskDueGroup(null, "pending", now)).toBe("Later");
  });
});

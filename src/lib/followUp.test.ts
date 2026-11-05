/// <reference types="jest" />
import { followUpPresets, istAt } from "./followUp";

const morning = Date.parse("2026-11-09T05:32:00Z"); // 11:02 IST

describe("istAt", () => {
  it("builds IST wall-clock times", () => {
    expect(istAt(morning, 0, 18)).toBe(Date.parse("2026-11-09T12:30:00Z"));
    expect(istAt(morning, 1, 11)).toBe(Date.parse("2026-11-10T05:30:00Z"));
  });

  it("uses the IST date just after IST midnight", () => {
    const lateNight = Date.parse("2026-11-08T18:40:00Z"); // 00:10 IST on the 9th
    expect(istAt(lateNight, 0, 9)).toBe(Date.parse("2026-11-09T03:30:00Z"));
  });
});

describe("followUpPresets", () => {
  it("offers four presets in the morning", () => {
    const p = followUpPresets(morning);
    expect(p.map((x) => x.label)).toEqual(["In 1 hour", "Today 6 pm", "Tomorrow 11 am", "Tomorrow 5 pm"]);
    expect(p[0]!.at).toBe(Date.parse("2026-11-09T06:35:00Z")); // 12:02 → 12:05 IST
  });

  it('drops "Today 6 pm" after 5 pm IST', () => {
    const evening = Date.parse("2026-11-09T12:00:00Z"); // 17:30 IST
    expect(followUpPresets(evening).map((x) => x.label)).toEqual([
      "In 1 hour",
      "Tomorrow 11 am",
      "Tomorrow 5 pm",
    ]);
  });
});

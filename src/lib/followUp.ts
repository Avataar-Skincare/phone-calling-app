/**
 * Quick follow-up times, on the IST wall clock. Pure functions, covered by followUp.test.ts.
 */

const IST_OFFSET_MS = (5 * 60 + 30) * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;
const FIVE_MIN_MS = 5 * 60 * 1000;

/** Epoch ms of `hour:minute` IST, `dayOffset` days after the IST date of `now`. */
export function istAt(now: number, dayOffset: number, hour: number, minute = 0): number {
  const istMidnightUtc = Math.floor((now + IST_OFFSET_MS) / DAY_MS) * DAY_MS - IST_OFFSET_MS;
  return istMidnightUtc + dayOffset * DAY_MS + (hour * 60 + minute) * 60 * 1000;
}

export interface FollowUpPreset {
  label: string;
  at: number;
}

/**
 * Presets offered above the date picker:
 *   "In 1 hour" (rounded up to 5 minutes), "Today 6 pm" (only before 5 pm IST),
 *   "Tomorrow 11 am", "Tomorrow 5 pm".
 */
export function followUpPresets(now: number): FollowUpPreset[] {
  const inAnHour = Math.ceil((now + 60 * 60 * 1000) / FIVE_MIN_MS) * FIVE_MIN_MS;
  const presets: FollowUpPreset[] = [{ label: "In 1 hour", at: inAnHour }];
  if (now < istAt(now, 0, 17)) presets.push({ label: "Today 6 pm", at: istAt(now, 0, 18) });
  presets.push({ label: "Tomorrow 11 am", at: istAt(now, 1, 11) });
  presets.push({ label: "Tomorrow 5 pm", at: istAt(now, 1, 17) });
  return presets;
}

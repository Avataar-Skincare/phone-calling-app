/**
 * Working out which app call a recording shared from the phone's Phone app belongs to (ADR 0010).
 * Pure functions, covered by sharedRecordingMatch.test.ts.
 */

/** India has no daylight saving; names without a zone are the phone's local (IST) time. */
const IST_OFFSET_MS = (5 * 60 + 30) * 60 * 1000;
const MINUTE_MS = 60_000;
const DAY_MS = 24 * 60 * 60 * 1000;

/** The recording starts a little before the tap is allowed; a little after the end too. */
export const SHARE_MATCH_SLACK_MS = 60_000;
/** Only calls from the last 2 days are offered. */
export const SHARE_CALL_WINDOW_MS = 2 * DAY_MS;
/** With no time in the name, the newest call that ended within 30 minutes is the guess. */
export const SHARE_RECENT_MS = 30 * MINUTE_MS;

/** The few fields of a finished call this needs. */
export interface CallForShare {
  id: string;
  userId: string | null;
  /** epoch ms: tap on Call */
  tappedAt: number;
  /** epoch ms: the call went live, null when unknown */
  startedAt: number | null;
  /** epoch ms */
  endedAt: number;
}

/** 2020-01-01 to 2100-01-01, so a random 13-digit number in a name is not taken as a time. */
const MIN_EPOCH_MS = Date.UTC(2020, 0, 1);
const MAX_EPOCH_MS = Date.UTC(2100, 0, 1);

/**
 * The time a shared recording was made, from its file name, as epoch ms; null when the name has
 * none. Understands:
 *  - Google Phone: `record-1794566075519.wav` (13-digit epoch ms, the recording start)
 *  - `20261113_160435`, `2026-11-13 16-04-35`, `2026-11-13T16:04:35` (IST wall clock)
 */
export function recordingTimeFromName(name: string): number | null {
  const epoch = /(?<!\d)(\d{13})(?!\d)/.exec(name);
  if (epoch) {
    const ms = Number(epoch[1]);
    if (ms >= MIN_EPOCH_MS && ms < MAX_EPOCH_MS) return ms;
  }

  const wall =
    /(?<!\d)(20\d{2})[-_]?(\d{2})[-_]?(\d{2})[\sT_-]+(\d{2})[-_.:]?(\d{2})[-_.:]?(\d{2})(?!\d)/.exec(name);
  if (wall) {
    const [y, mo, d, h, mi, s] = wall.slice(1).map(Number) as [
      number,
      number,
      number,
      number,
      number,
      number,
    ];
    if (mo >= 1 && mo <= 12 && d >= 1 && d <= 31 && h <= 23 && mi <= 59 && s <= 59) {
      return Date.UTC(y, mo - 1, d, h, mi, s) - IST_OFFSET_MS;
    }
  }
  return null;
}

export interface SharedRecordingMatch<C extends CallForShare> {
  /** The call the recording most likely belongs to, or null (the agent chooses). */
  best: C | null;
  /** The agent's calls from the last 2 days, newest first, for "Choose another call". */
  candidates: C[];
}

/**
 * Pick the call a shared recording belongs to. Only the signed-in agent's calls from the last 2
 * days count (`userId` null on a stored call means "this phone's agent", as in RecordingPrompt).
 * The best call is the one whose [tap − 60 s, end + 60 s] holds `time`; with several, the one
 * that started closest to it. With no `time`, the newest call that ended in the last 30 minutes.
 */
export function matchSharedRecording<C extends CallForShare>(
  time: number | null,
  calls: C[],
  now: number,
  userId: string | null,
): SharedRecordingMatch<C> {
  const candidates = calls
    .filter((c) => (c.userId === null || c.userId === userId) && c.endedAt >= now - SHARE_CALL_WINDOW_MS)
    .sort((a, b) => b.endedAt - a.endedAt);

  if (time === null) {
    const recent = candidates.find((c) => c.endedAt >= now - SHARE_RECENT_MS && c.endedAt <= now + MINUTE_MS);
    return { best: recent ?? null, candidates };
  }

  let best: C | null = null;
  let bestGap = Infinity;
  for (const c of candidates) {
    if (time < c.tappedAt - SHARE_MATCH_SLACK_MS || time > c.endedAt + SHARE_MATCH_SLACK_MS) continue;
    const gap = Math.abs(time - (c.startedAt ?? c.tappedAt));
    if (gap < bestGap) {
      best = c;
      bestGap = gap;
    }
  }
  return { best, candidates };
}

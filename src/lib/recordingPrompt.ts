/**
 * When the "Upload call recording" screen opens by itself after a call. Pure functions, covered by
 * recordingPrompt.test.ts.
 */

/** Call just ended while the app was open: prompt within 2 minutes. */
export const PROMPT_WINDOW_MS = 2 * 60 * 1000;
/** Call ended while the app was in the background: prompt when the app returns, within 10 minutes. */
export const PROMPT_WINDOW_BACKGROUND_MS = 10 * 60 * 1000;

function limit(finishedInBackground: boolean): number {
  return finishedInBackground ? PROMPT_WINDOW_BACKGROUND_MS : PROMPT_WINDOW_MS;
}

export function shouldPromptRecording(input: {
  endedAt: number;
  now: number;
  appActive: boolean;
  finishedInBackground: boolean;
}): boolean {
  if (!input.appActive) return false;
  return input.now - input.endedAt <= limit(input.finishedInBackground);
}

/** True when the time limit has passed for good, so the call can be forgotten. */
export function promptExpired(input: {
  endedAt: number;
  now: number;
  finishedInBackground: boolean;
}): boolean {
  return input.now - input.endedAt > limit(input.finishedInBackground);
}

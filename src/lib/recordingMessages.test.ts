/// <reference types="jest" />
import { recordingErrorMessage } from "./recordingMessages";

describe("recordingErrorMessage", () => {
  it.each([
    ["Upload refused by storage (403)", "Upload was refused. Please tell your team lead."],
    [
      "Call not in Compass yet — try again in a moment",
      "This call is not in Compass yet. Wait a moment and try again.",
    ],
    ["Upload failed. Check your connection.", "No internet. Try again."],
    ["Upload failed: timeout", "No internet. Try again."],
    ["Network request failed", "No internet. Try again."],
    ["This isn't a supported audio file.", "This file is not a supported audio file."],
    ["This recording is empty.", "This recording is empty."],
    ["This recording is over 25 MB, too large to upload.", "This recording is too big. The limit is 25 MB."],
    ["Activity does not belong to this agent", "This is not your call."],
    ["Recording window expired", "This call is too old to upload a recording."],
    // Compass's exact error texts (mobile-dialer-recordings.service.ts)
    ["Only the agent who made the call can add its recording", "This is not your call."],
    ["Recordings can be added up to 7 days after the call", "This call is too old to upload a recording."],
    ["Recordings must be between 1 byte and 25 MB", "This recording is too big. The limit is 25 MB."],
    ["Recording too large", "This recording is too big. The limit is 25 MB."],
    ['"image/png" isn\'t an audio type Compass accepts', "This file is not a supported audio file."],
    [
      "Recordings can only be added to calls made from the app",
      "Recordings can only be added to calls made from this app.",
    ],
    ["The file hasn't reached Compass yet. Upload it again.", "Upload did not finish. Try again."],
    ["Call not found", "This call is not in Compass yet. Try again later."],
    ["Could not read the shared file", "Could not open this file. Share it again."],
    ["Something odd", "Could not upload. Try again."],
    [null, "Upload did not finish. Try again."],
  ])("%s", (input, expected) => {
    expect(recordingErrorMessage(input)).toBe(expected);
  });
});

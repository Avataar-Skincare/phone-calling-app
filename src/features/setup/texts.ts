/** Plain words for agents with limited English (ADR 0011). Short sentences, no dashes. */

export const GOOGLE_SHARE_STEPS =
  "To upload a recording, open Phone. Tap Recents. Open the call. Tap the recording. Tap Share. Choose Compass Dialer.";

export const FOLDER_TIP = "Choose the folder where your phone saves call recordings.";

export const TEXT = {
  title: "Before you start",
  phoneTitle: "Allow phone access",
  phoneBody: "Allow phone access. The app needs it to make calls.",
  callLogTitle: "Allow call logs",
  callLogBody: "Allow call logs. We need it to save talk time.",
  hiddenTitle: "Your phone is hiding call logs",
  hiddenBody: "Your phone is hiding call logs. Talk time will not be saved.",
  hiddenSteps:
    "Open settings and allow Call logs for Compass Dialer. On Xiaomi or Realme, also open Other permissions and allow call logs.",
  recordingsTitle: "Call recordings",
  allow: "Allow",
  openSettings: "Open settings",
  checkAgain: "Check again",
  skip: "Skip",
  chooseFolder: "Choose folder",
  continue: "Continue",
  stillMissing: "Still not allowed. Tap Open settings.",
} as const;

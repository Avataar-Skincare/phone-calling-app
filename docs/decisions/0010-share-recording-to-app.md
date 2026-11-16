# 0010: Share a call recording to the app (Android, Google Phone)

- **Status:** Accepted
- **Date:** 2026-11-13
- **Builds on:** [0007](0007-call-recording-upload.md)

## Context

ADR 0007 finds the recording in a folder the agent picks once. That cannot work on phones whose
dialer is Google's Phone app (Nothing/CMF, Pixel, Motorola): it keeps call recordings inside the
Phone app, so there is no folder to pick. The agent can still open the call in Phone → Recents →
the recording → **Share**. The app has to be on that share sheet.

## Decision

1. **Share target for audio.** `app.json` → `expo.android.intentFilters` declares
   `ACTION_SEND`, category `DEFAULT`, `*/*` (no `autoVerify`, no new permission). First built as
   `audio/*`; on a Nothing CMF phone Google Phone shared `record-<ms>.wav` with a generic type and
   the app was missing from its share sheet, so any type is accepted and the app keeps only audio,
   judged by type or file name ("This file is not a supported audio file." otherwise). It reaches the
   merged `AndroidManifest.xml` on `MainActivity`. `app.config.ts` spreads `config.android`, so
   `app.json` is the single place.
2. **Copy at once.** The sender's read grant on the shared `content://` Uri lasts only while the
   activity holds the intent. `SimDialerModule` therefore streams the bytes to
   `cacheDir/shared-recordings/<time>-<name>` straight away (25 MB cap; larger or unreadable files
   come back with `error: "too_big" | "unreadable"` and no uri), keeping the sender's file name and
   mime type. The intent is then marked used (stream removed, action neutral) so it is never handled
   twice. Copies older than 3 days are deleted when a new one arrives. A running app gets it through
   `OnNewIntent` (copy on a background thread) and the `sharedRecording` event; a share that
   started the app is read from the activity's intent by `takeSharedRecording()`. iOS returns null
   and never emits.
3. **Which call?** From the file's name, then the call list (`src/lib/sharedRecordingMatch.ts`).
   Google Phone names files `record-<epoch ms>.wav`: the number is the recording **start**. Also
   understood: `yyyyMMdd_HHmmss` and `yyyy-MM-dd HH-mm-ss` (read as IST). Among the signed-in
   agent's calls from the last 2 days, the call whose tap − 60 s … end + 60 s holds that time wins
   (closest start if several). With no time in the name, the newest call that ended in the last 30
   minutes. No match: the agent picks from a list of recent calls.
4. **Same upload.** The screen (`/recording?shared=1`) calls the existing
   `uploadRecording(callId, file)` with the cached `file://` uri: same three calls to Compass, same
   state on the call (`FinishedCall.recording`), same plain-English errors. The call must already
   have an `activityId`; if not: "This call is not in Compass yet. Wait a moment and try again."
5. **Not persisted.** The shared file lives in memory (`sharedRecording.store.ts`). The native
   module keeps a not-yet-taken file until JavaScript takes it (so a share while signed out waits
   for sign-in). If the app is killed with the screen open, the agent shares again.

## Consequences

- **Needs a new native build** (manifest and Kotlin changed). Older builds are not on the share sheet.
- Android only. iPhone call recordings live in Notes; there is no equivalent.
- Matching trusts the time in the name. A renamed file, or a dialer that names files differently,
  falls back to the "which call?" list; nothing is uploaded to the wrong call without a tap on
  **Upload**.
- Recording customers' calls still needs company sign-off (see ADR 0007).

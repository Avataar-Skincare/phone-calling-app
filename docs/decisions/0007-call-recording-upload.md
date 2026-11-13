# 0007: Upload the phone dialer's call recording to Compass (Android)

- **Status:** Accepted
- **Date:** 2026-11-13
- **Builds on:** [0005](0005-log-calls-as-manual-outbound-call.md), [0006](0006-call-times-and-whatsapp.md)
- **Supersedes:** the statement in 0005/0006 that the call log is the app's only write to Compass.
  The app now also uploads recordings, as described here.

## Context

The business wants to listen to agents' calls. Apps cannot record calls (Android 10+ blocks it, iOS
never allows it), so the agent records with the phone's own dialer and the app uploads that file
afterwards. Compass stores it in S3 and plays it from the activity's `recording_url`.

## Decision

1. **Android only.** iPhone has no access to the recording file; the UI is hidden there and the
   native functions are stubs.
2. **The agent picks the dialer's recordings folder once** in Settings ("Call recordings folder",
   Android's folder picker, `ACTION_OPEN_DOCUMENT_TREE`). The app keeps a persisted **read-only**
   grant on that folder. No storage or media permission is added to the manifest: the folder grant is
   the whole permission. The app re-checks the grant when Settings opens; if Android revoked it, the
   folder shows as "Not set".
3. **One tap after each call.** The summary card looks in that folder (and one level of
   sub-folders) for audio last modified from 1 min before the tap to 10 min after the call ended
   (`src/lib/recordingMatch.ts`), preferring a file whose name contains the last 7+ digits of the
   number, then the one closest to the call's end. It looks again every 5 s, up to 6 times, since the
   dialer writes the file just after the call. "Recording found · 6:21 pm · 2.1 MB" and **Upload**.
   When nothing matches: "No recording found" and **Choose file**, a list of that folder's audio from
   the last 2 hours.
4. **Upload path** (`src/features/recordings/uploadRecording.ts`), in three calls:
   1. `POST /mobile-dialer/recordings/:activityId/upload-url` with `{ content_type, size_bytes }`
      returns a 10-minute presigned S3 PUT link.
   2. The phone PUTs the raw bytes to it from native code (`HttpURLConnection`, streamed in chunks,
      fixed length) with exactly the returned `Content-Type` and the file's size, and no
      Authorization header (both are part of the S3 signature).
   3. `POST /mobile-dialer/recordings/:activityId/complete` with `{ key }`; Compass saves
      `recording_url` on the activity.

   `:activityId` is the `activity_id` the call log returned (ADR 0005), so an upload waits for that
   call to be in Compass. Compass enforces: the agent's own `manual_outbound_call`, at most 7 days
   old, audio only, 1 byte to 25 MB. The app pre-checks type and size to avoid a pointless request.

5. **State on the call** (`FinishedCall.recording`, persisted): `uploading`, `uploaded`, or `failed`
   with a message, shown on the card ("Uploading…", "Recording uploaded ✓", error and **Retry**). One
   upload per call at a time. A refused PUT shows as "Upload refused by storage (403)", never a crash.
6. Nothing about the call flow or the call log (`sendCalls.ts`) changes. Calls whose recording is
   never uploaded send no extra requests.

## Consequences

- **Needs a new store build** (native code changed). Older builds ignore all of this.
- A second write to Compass; the first real upload also proves Compass's S3 write permission.
- Recording customers' calls needs company sign-off (consent wording, who can listen, retention,
  DPDP Act 2023). That is outside this repo.
- Not built yet: iPhone (iOS 18.1+ saves call recordings to Notes, with no file access), a reminder
  for calls without a recording, automatic retry of failed uploads.
- Files over 25 MB are refused (long calls on high-bitrate recorders).

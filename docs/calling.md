# Calling

Calls go out on the phone's own SIM. Two pieces handle them:

- `modules/sim-dialer/`: a local Expo module (Kotlin + Swift) that places the call and reports
  call-state events.
- `src/lib/callState.ts`: a pure state machine that turns those events into a call session. All
  of its rules are covered by `callState.test.ts`.

## Native module

Import it as `@modules/sim-dialer`. When the native module is missing (Expo Go, web, an old build),
every function falls back to a plain `tel:` link with no tracking, so screens never branch on it.

| Function                                    | Android                                                                                                                  | iOS                                                        |
| ------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------- |
| `placeCall(e164, sim)`                      | `CALL_PHONE` granted: `TelecomManager.placeCall`, instant, on the chosen SIM. Otherwise `ACTION_DIAL`, dialer pre-filled | `tel:` link; iOS shows its "Call" prompt and picks the SIM |
| `getPermissions()` / `requestPermissions()` | `CALL_PHONE` + `READ_PHONE_STATE`                                                                                        | Always granted (nothing to ask)                            |
| `capabilities()`                            | `canDirectDial`, `canTrack`, `canChooseSim`                                                                              | Tracking yes, direct dial and SIM choice no                |
| `listSims()`                                | Call-capable phone accounts                                                                                              | Empty                                                      |
| `getCallState()`                            | `idle` / `offhook` / `ringing`                                                                                           | `offhook` while an outgoing call is live, else `idle`      |
| `callState` event                           | `TelephonyCallback` (12+) or `PhoneStateListener`                                                                        | `CXCallObserver`: `dialing`, `connected`, `ended`          |

Platform limits worth knowing:

- **Android call-state events can't tell whether the customer answered.** `OFFHOOK` starts while
  the outgoing call is still ringing. Talk time comes from the call log after the call instead.
- **Android fires the current state the moment tracking starts** (normally `idle`). The state
  machine ignores `idle` until the call has gone off-hook.
- **`READ_CALL_LOG` is requested** for talk time only (the newest outgoing call to the number since
  the tap). Google Play allows it only for default dialer apps, so the app ships outside the public
  Play Store ([ADR 0006](decisions/0006-call-times-and-whatsapp.md)). CI requires it and refuses
  write access to the call log or contacts.
- **Recording isn't possible** on either platform.

## Call session

```
dialing ──▶ in_call ──▶ ended
   └─────────(no call ever started)──▶ discarded
```

| Event                                        | Effect                                                    |
| -------------------------------------------- | --------------------------------------------------------- |
| Tap call button                              | Session created **before** dialing, so no event is missed |
| Android `offhook` / iOS `connected`          | `in_call` (iOS also records the answer time)              |
| iOS `dialing`                                | Call start recorded, still `dialing`                      |
| Android `idle` after `offhook` / iOS `ended` | `ended`, with end time (iOS also records answered or not) |
| Events older than the tap                    | Ignored (they belong to an earlier call)                  |

### When events go missing

`CallTracker` (mounted in `src/app/(main)/_layout.tsx`) re-checks the session every time the app
returns to the foreground or starts after being killed. It waits 800 ms first, because iOS
delivers queued call events just after the app becomes active. Then it asks the phone for its
current call state:

- Still on a call: nothing changes.
- A call started but its end was missed: `ended` now, marked **approximate**.
- Tracked, nothing started, back within 15 s: the agent cancelled (iOS prompt) or the call failed.
  The session is **discarded**.
- Untracked (no permission, fallback) or away longer: `ended`, approximate.

## After the call

`CallTracker` hands an `ended` session to `finishCall()` (`src/features/calling/callFlow.ts`):

1. Talk time: iPhone from the answer event; Android from the call log (`lastCallFromLog`, up to 4
   tries 1 s apart, since the phone writes the entry just after the call).
2. `callTimes()` works out total (dialing start → end; the tap only if no start event), talk and
   ringing (total − talk).
3. The call is stored in `useCallLog` (persisted), the session is cleared, and the summary card
   shows on the list and the client page.
4. `sendCalls.ts` logs it in Compass as a "Manual Outbound Call" (`POST /activities/log`, ADR 0005).
   Success is a non-null `activity_id` (Compass answers 200 on failure too). Network, 401, 429 and
   5xx are retried with back-off (1, 2, 4 … min, max 30), on return to the app and every 15 s;
   other errors are shown as "couldn't be saved" with Retry / Discard.

A new call can start while the last one is still being finished.

## WhatsApp

`src/components/WhatsAppButton.tsx` sits next to every Call button. It opens
`https://wa.me/<country code + number>` (`whatsAppUrl` in `src/lib/phone.ts`), which starts a
WhatsApp chat with the client on Android and iPhone, or WhatsApp's web page when the app isn't
installed. It needs no permission and doesn't touch the call session.

## Keypad

[ADR 0009](decisions/0009-keypad-claim.md). The round dial-pad button in the home header opens
`src/app/(main)/keypad.tsx`: a number field (long-press → Paste works; WhatsApp's invisible
direction marks are stripped), an on-screen pad (1–9, +, 0, backspace) and **Call**, with the
formatted number underneath. On **Call**:

1. `dialTarget` (`src/lib/dialInput.ts`) turns the text into E.164; too short or not a mobile
   number keeps Call disabled.
2. `claimWithCap` (`src/api/mobileDialer.ts`) asks Compass to move the lead to the agent, 3 s at
   most (see [compass-api.md](compass-api.md#keypad-claim)).
3. `claimMessage` (`src/lib/claimMessage.ts`) shows what happened, inline, and it stays after the
   call.
4. The shared `useCallLead()` dials with the claim's `opportunityId` / `leadId`, so the call is
   logged and its recording uploaded exactly like a list call. **The call always goes ahead**, also
   when the claim fails or times out (then there is no opportunity on the call).

List calls don't claim. The call summary card (`CallBanner`) also shows on the Keypad screen.

## Call recordings (Android)

[ADR 0007](decisions/0007-call-recording-upload.md). The app can't record calls; the agent records
with the phone's own dialer and the app uploads that file.

- **Settings → Calling → Call recordings folder**: the agent picks the dialer's folder once
  (Samsung `Recordings/Call`, Xiaomi `MIUI/sound_recorder/call_rec`). Read-only access to that
  folder only; no storage permission. Re-checked on focus; if Android revoked it, shown as "Not set".
- **Upload call recording screen** (`src/app/(main)/recording.tsx`): opens by itself after an
  answered Android call (`RecordingPrompt` in the main layout; once per call, only for calls that end
  while the app runs, within 2 minutes, or within 10 minutes if the app was in the background; Skip
  never brings it back). Steps: choose folder (if none), looking, found → **Upload**, not found →
  **Choose file** / **Look again**, uploading, uploaded (closes after 2 s), failed → **Try again**
  (`recordingErrorMessage` in `src/lib/recordingMessages.ts` turns errors into plain words). Shares
  all logic with the summary card row through `useCallRecording`. All text is short, plain English
  for agents with limited English.
- **Summary card** (`RecordingRow`, the fallback for later, answered Android calls only): lists the folder for the call
  window (`recordingWindow` in `src/lib/recordingMatch.ts`: tap − 1 min to end + 10 min), rescans
  every 5 s up to 6 times, and shows "Recording found · time · size" with **Upload**; "No recording
  found" with **Choose file** (that folder's audio from the last 2 hours); or a link to Settings
  when no folder is set. Then "Uploading…", "Recording uploaded ✓", or the error with **Retry**.
- `uploadRecording(callId, file)` (`src/features/recordings/uploadRecording.ts`) needs the call's
  `activityId`; runs upload-url → native PUT → complete (see [compass-api.md](compass-api.md#call-recording-upload));
  stores the result in `FinishedCall.recording`; ignores a second tap while uploading.
- **Share from Google Phone** ([ADR 0010](decisions/0010-share-recording-to-app.md)): where the
  dialer keeps recordings inside its own app (Nothing/CMF, Pixel, Motorola) there is no folder. The
  agent opens Phone → Recents → the call → the recording → Share → **Compass Dialer**. The app is an
  `audio/*` share target; `SimDialerModule` copies the file to `cacheDir/shared-recordings` at once
  (25 MB cap, files older than 3 days cleaned up) and hands it to JS by `takeSharedRecording()`
  (cold start, app to front) or the `sharedRecording` event (app running). `SharedRecordingWatcher`
  (main layout) opens `/recording?shared=1`, which shows "This recording is for: Call to {name}" +
  **Upload** + **Choose another call**, or "Which call is this recording for?" with the agent's
  calls from the last 2 days. Matching (`src/lib/sharedRecordingMatch.ts`): the time in the file name
  (`record-<epoch ms>.wav` = recording start; `yyyyMMdd_HHmmss` / `yyyy-MM-dd HH-mm-ss` read as IST)
  against each call's tap − 60 s … end + 60 s; with no time, the newest call that ended in the last 30
  minutes. Upload is the same `uploadRecording(callId, file)`. A file shared while signed out waits
  until sign-in. Needs a new native build.
- Native: `pickRecordingsFolder`, `getRecordingsFolder`, `listRecordings`, `uploadRecording`,
  `takeSharedRecording` (+ event `sharedRecording`) in
  `modules/sim-dialer`. iOS returns null / [] and rejects the upload ("Recording upload is Android
  only"); the UI is hidden there.

## Permissions (Android)

**Call-log access is required to call from the app** ([ADR 0008](decisions/0008-call-log-access-required.md)).
Before every call, `useCallLead` reads `getCapabilities().canReadCallLog`; when it isn't granted
(`mustAskForCallLog` in `src/lib/callPermission.ts`), the call is blocked and
`src/app/(main)/permissions.tsx` opens. It explains the permissions and offers **Allow** (or **Open
Settings** once Android stops asking) and **Cancel**. The call is placed only when call-log access is
granted afterwards; there is no "use the dialer instead" option. The Account screen shows the
current state and offers **Allow** or **Open Settings**.

Every Android call log also sends `call_log_permission: "granted" | "denied"`, read when the call
ends, so Compass's Agent Audit can count calls whose talk time is unknown (access turned off
mid-call). iOS sends nothing.

## SIM choice (Android)

When the phone has more than one call-capable SIM, the Account screen lists them. The choice is
stored in `settings.store`; a SIM that's no longer in the phone falls back to the phone's default.

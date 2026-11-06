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

## Permissions (Android)

Before the first call, `src/app/(main)/permissions.tsx` explains the two permissions and asks for
them once. Declining still works: the dialer opens with the number filled in. The Account screen
shows the current state and offers **Allow** or **Open Settings**.

## SIM choice (Android)

When the phone has more than one call-capable SIM, the Account screen lists them. The choice is
stored in `settings.store`; a SIM that's no longer in the phone falls back to the phone's default.

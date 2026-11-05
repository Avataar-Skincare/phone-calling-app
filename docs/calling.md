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

- **Android can't tell whether the customer answered.** `OFFHOOK` starts while the outgoing call
  is still ringing. Durations on Android include ring time.
- **Android fires the current state the moment tracking starts** (normally `idle`). The state
  machine ignores `idle` until the call has gone off-hook.
- **`READ_CALL_LOG` is never requested.** Google Play only allows it for default dialer apps. CI
  fails if it appears in the merged manifest.
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
- Untracked (no permission, fallback) or away longer: `ended`, approximate. The outcome sheet lets
  the agent say the call didn't happen.

## Permissions (Android)

Before the first call, `src/app/(main)/permissions.tsx` explains the two permissions and asks for
them once. Declining still works: the dialer opens with the number filled in. The Account screen
shows the current state and offers **Allow** or **Open Settings**.

## SIM choice (Android)

When the phone has more than one call-capable SIM, the Account screen lists them. The choice is
stored in `settings.store`; a SIM that's no longer in the phone falls back to the phone's default.

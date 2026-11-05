# Test report: Android emulator, 2026-11-05

|         |                                                                                    |
| ------- | ---------------------------------------------------------------------------------- |
| Build   | Debug development build, `com.avataarskin.dialer` 1.0.0                            |
| Device  | Android emulator `CompassDialer_Test` (Pixel 7 profile, Android 14, API 34, arm64) |
| Backend | Compass **testing** (`test-leads.avataarskin.com`)                                 |
| Account | Testing administrator in the "Central" department (bypass login)                   |
| Rule    | No outcome was saved to Compass. Every outcome test stopped before Save.           |

Calls on the emulator go to a simulated modem; no real phone was called.

## Results

| #   | Case                                                                      | Result                                                                                                                                 |
| --- | ------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | App builds, installs and launches                                         | ✅ after fix 1                                                                                                                         |
| 2   | App icon, adaptive icon, splash                                           | ✅ after fixes 1–2                                                                                                                     |
| 3   | Login screen, "Testing" label, Send code disabled until valid             | ✅                                                                                                                                     |
| 4   | Invalid number shows an error                                             | ✅ after fix 4                                                                                                                         |
| 5   | Keyboard doesn't cover the form                                           | ✅ after fix 3                                                                                                                         |
| 6   | Number that isn't a Compass user (real 404)                               | ✅                                                                                                                                     |
| 7   | No internet on Send code                                                  | ✅ "Can't reach Compass…"                                                                                                              |
| 8   | Code screen, resend countdown, formatted number                           | ✅                                                                                                                                     |
| 9   | Wrong code                                                                | ✅ "That code isn't right…" (grey band behind boxes: fix 5)                                                                            |
| 10  | Login, session kept after app restart                                     | ✅                                                                                                                                     |
| 11  | Home screen renders                                                       | ✅ after fix 6                                                                                                                         |
| 12  | User outside Sales/CS gets a Sales/CS switch                              | ✅ after fix 7                                                                                                                         |
| 13  | Lead view tab (588 rows), masked numbers, stage pills                     | ✅                                                                                                                                     |
| 14  | Task view tab (First Call, 5,796 rows), overdue in red, IST times         | ✅                                                                                                                                     |
| 15  | Search ("8 leads matching …")                                             | ✅                                                                                                                                     |
| 16  | Lead screen: full number, task, details, recent activity                  | ✅                                                                                                                                     |
| 17  | Permission explainer before the first call, Android prompt                | ✅                                                                                                                                     |
| 18  | Call placed directly by the app (Telecom `DIALING`, no dialer screen)     | ✅                                                                                                                                     |
| 19  | Call ended → outcome sheet opens by itself                                | ✅                                                                                                                                     |
| 20  | Stages and fields loaded from Compass config, "(now)" marker              | ✅                                                                                                                                     |
| 21  | Save with no stage / empty required fields blocked, no request sent       | ✅                                                                                                                                     |
| 22  | Dropdown, quick follow-up times, native date picker (past dates disabled) | ✅                                                                                                                                     |
| 23  | Android Back doesn't dismiss the outcome sheet                            | ✅                                                                                                                                     |
| 24  | App killed with an unsaved call → sheet reopens on launch                 | ✅ (typed answers not kept)                                                                                                            |
| 25  | "Didn't call" → confirmation → discarded, nothing queued                  | ✅                                                                                                                                     |
| 26  | Offline save → queued, sent later                                         | ⏸ Not run on device (would write to Compass once online). Covered by unit tests.                                                       |
| 27  | Saving an outcome to Compass                                              | ⏸ Not run by decision                                                                                                                  |
| 28  | Tab counts                                                                | ⚠️ Compass testing `/smart-views/counts` returned **504 after 60 s** for this admin account. App degrades to no counts. Backend issue. |

## Fixes made during this run

1. **No icon or splash image**: Android resource linking failed. Added `assets/images` (icon, adaptive icon, monochrome, splash) and `scripts/generate-icons.py`.
2. **Call glyph didn't read as a phone**: replaced the View-drawn handset with the Material "call" icon (`react-native-svg`), same as the app icon.
3. **Keyboard covered the error and Send code** on Android (edge-to-edge disables window resizing): `KeyboardAvoidingView` now pads on both platforms.
4. **Misleading copy** for a 10-digit number that isn't a mobile: "Enter a valid 10-digit Indian mobile number."
5. **Grey band behind the OTP boxes** after the keyboard closed: the hidden input is now fully transparent.
6. **Crash on home ("Maximum update depth exceeded")**: a zustand selector returned a new filtered array on every render. It now selects the stored array and filters in `useMemo`.
7. **"No department set" for a "Central" user**: users whose department isn't Sales or CS now get the Sales/CS switch.
8. **Counts request retried while timing out**: counts no longer retry and refresh at most once a minute.

## Not covered here

- iPhone (needs an EAS build on a device, or Xcode 26 for the simulator).
- Physical Android phones from the matrix in [testing.md](../testing.md) (Samsung, Xiaomi, Vivo/Oppo, OnePlus), dual SIM, battery savers.
- A real answered call (the emulator modem hangs up after 0.2 s).
- Older Android call tracking (`PhoneStateListener`, Android ≤ 11).

## Follow-ups

- Backend: `/smart-views/counts` performance for administrators on testing.
- Possible improvement: keep typed outcome answers if the app is killed before saving.

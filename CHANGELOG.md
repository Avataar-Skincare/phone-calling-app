# Changelog

All notable changes to this project are documented here. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and the project uses
[Semantic Versioning](https://semver.org/).

## [Unreleased]

### Removed (2026-11-06)

- Change Stage on the client page (`POST /opportunities/:id/stage`) and Mark as completed on task views and the Tasks tab (`POST /tasks/:id/update`). Agents change stages, record outcomes and complete tasks only on the Compass website ([ADR 0006](docs/decisions/0006-call-times-and-whatsapp.md)).
- The outcome (dispose) form after calls and its "Waiting to send" screen. Outcomes are recorded on the Compass website ([ADR 0005](docs/decisions/0005-log-calls-as-manual-outbound-call.md)).

### Added (2026-11-06)

- Every call is logged in Compass as a "Manual Outbound Call" activity (`POST /activities/log`) with talk time, ringing time and total time (dialing start → end); kept on the phone and retried when Compass can't be reached; refused logs shown with Retry / Discard ([ADR 0005](docs/decisions/0005-log-calls-as-manual-outbound-call.md), [0006](docs/decisions/0006-call-times-and-whatsapp.md)).
- Android talk time from the phone's call log (new "Call logs" permission, `READ_CALL_LOG`); iPhone from the answer event.
- Call summary after each call: Connected with talk / ringing / total, or Not answered with how long it rang.
- WhatsApp button next to every Call button (list cards and the client page). It opens a WhatsApp chat with the client's number.

### Added (Compass parity, 2026-11-06)

- Home is now Compass's Smart Views: Sales / Customer Support tabs, all 14 views with Compass's per-view filters (search, stage, source, owner, date type, date range with custom dates, status, task type, activity), defaults by role, sorting, "Showing X of Y" and 20 / 50 / 100 rows per page. Filters are remembered per view.
- List cards show Compass's columns (lead score, stage, source, owner, created and modified dates; task status, due date, created by, owner).
- Lead screen is now Compass's opportunity page: header, profile panel with Call and the four tiles, Properties, and the Overview, Activities, Tasks, Calls, Stage History, Purchase History and Appointments tabs.
- The call banner also shows on the client's page. Calling from the list stays on the list.
- Dates, phones, sources, money and stage colours formatted exactly like Compass (`src/lib/format.ts`).

### Added (tests)

- Test suite: 163 unit and integration tests (Jest, React Native Testing Library, expo-router test renderer) with a fake Compass and a fake phone, plus read-only contract tests against Compass testing. Coverage report in CI.

### Fixed (found by the integration tests)

- Tab counts could be requested before the agent's department was known (focus refresh bypassed the query guard).

### Fixed (Android emulator test, 2026-11-05)

- App icon, adaptive icon and splash added; the Android build failed without them.
- Call button uses the standard phone glyph.
- Keyboard no longer covers form errors and buttons on Android.
- Crash on the home screen caused by a store selector returning a new array each render.
- Users outside Sales and CS (e.g. "Central") can choose Sales or CS lists.
- Clearer invalid-number message; hidden OTP input no longer shows a grey band.
- Tab counts no longer retry a request that is timing out.
- EAS builds failed at "Install dependencies": the lock file lacked required peers (`@react-native/metro-config`, `@testing-library/dom`) and optional peers resolved to incompatible versions. Declared them explicitly and added `npm run check:lockfile` to `verify` and CI.

### Added

- Project setup: Expo SDK 56, TypeScript, expo-router, TanStack Query, Zustand, EAS profiles for
  development, preview and production.
- Phone-number OTP login against Compass, secure session storage, automatic sign-out when the
  15-hour session ends or Compass rejects the token.
- Smart View tabs with counts, paginated lead lists, search, pull to refresh.
- Lead screen with stage, task, details and the latest activity.
- Account screen with session details, phone-permission status and SIM choice.
- `sim-dialer` native module (Kotlin and Swift): SIM calling and call-state events.
- Call session state machine with recovery when the app is killed during a call.
- One-time Android phone-permission explainer.
- Call outcome sheet built from Compass's activity-form config, opened automatically when a call
  ends; call details saved with the outcome.
- Offline outcome queue with background retry, a "Waiting to send" screen, and logout protection.
- Only one call at a time: a new call waits until the last outcome is saved or discarded.
- Tooling: ESLint, Prettier, Jest (`jest-expo`), route-type generation, GitHub Actions CI, PR and
  issue templates, documentation in `docs/`.

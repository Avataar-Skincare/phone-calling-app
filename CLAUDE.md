# CLAUDE.md

Guidance for Claude Code working in this repo. Humans: start with [README.md](README.md).

## Read first

- Product design and build steps: https://claude.ai/artifact/Rx7q8kQYxno946jBJYAhn8
- [docs/architecture.md](docs/architecture.md), [docs/compass-api.md](docs/compass-api.md),
  [docs/calling.md](docs/calling.md), [docs/decisions/](docs/decisions/)

## Before saying something works

`npm run verify` (lock-file check, lint, format check, typegen + tsc, unit and integration tests, bundle check). Screen tests: see [docs/testing.md](docs/testing.md#writing-a-new-one). For native changes also
compile the module: see [docs/development.md](docs/development.md#checking-native-code-locally).

## Rules

- This repo is the mobile app only. Compass (`leadsquared-avataar-server`) is the backend; don't
  build backend code here, and don't change Compass without the backend owners.
- Routing follows `useAuthStore().session` (`Stack.Protected` in `src/app/_layout.tsx`). To log
  out, clear the session; never navigate to login.
- Screens use `LeadItem`, never raw Smart View rows.
- Rules live in pure functions in `src/lib/` with a `*.test.ts`. Change both together.
- Keypad calls (`src/app/(main)/keypad.tsx`) claim the lead first via `src/api/mobileDialer.ts`, capped at
  3 s, then dial through `useCallLead()`; the call must always go ahead ([ADR 0009](docs/decisions/0009-keypad-claim.md)).
  List calls never claim.
- Call sessions: all transitions in `src/lib/callState.ts`. `startCall()` stores the session before
  dialing.
- `modules/sim-dialer`: Kotlin, Swift and `index.ts` must stay in step. `READ_CALL_LOG` is used for
  talk time only ([ADR 0006](docs/decisions/0006-call-times-and-whatsapp.md)); never add write access to
  the call log or contacts.
- Android calling requires call-log access, checked before **every** call (`mustAskForCallLog`,
  [ADR 0008](docs/decisions/0008-call-log-access-required.md)); don't add a way to call without it.
  Each Android call log sends `call_log_permission` for Compass's Agent Audit.
- `/android` and `/ios` are generated; never edit them.
- Times to Compass: fields Compass parses (`occurred_at`, filters) are ISO UTC (`toISOString()`).
  The readable call-log details (`call_*_at`) are IST "2026-11-06 18:21:50" (`toIstDateTime()`),
  Compass's activity format, so its activity details read correctly. Times shown: IST via
  `src/lib/time.ts`.
- Update `docs/` and `CHANGELOG.md` with every change. Commit only when asked.

## Build status (design steps)

- [x] 1 · Foundation and login
- [x] 2 · Smart View lists and lead screen
- [x] 3 · Native calling (`sim-dialer`), call sessions, permissions, SIM choice
- [x] 4 · ~~Outcome sheet~~ replaced 2026-11-06 by a "Manual Outbound Call" log with talk, ringing and
      total time ([ADR 0005](docs/decisions/0005-log-calls-as-manual-outbound-call.md),
      [0006](docs/decisions/0006-call-times-and-whatsapp.md)); WhatsApp button
- [ ] 5 · Device testing and store builds
- [ ] 6 · Pilot and rollout

## Built: call recording upload (Android, [ADR 0007](docs/decisions/0007-call-recording-upload.md))

Apps can't record calls (Android 10+ blocks it, iOS never allows it), so the agent records with
the phone's own dialer and the app uploads that file afterwards.

**Flow:** the agent picks the dialer's recordings folder once in Settings (read-only folder grant,
no storage permission) → call ends → app logs it (`POST /activities/log`, returns `activity_id`) →
summary card finds the recording by time and number and shows **Upload** (or **Choose file**) →
`POST /mobile-dialer/recordings/:activityId/upload-url` → phone PUTs the file to S3 →
`POST /mobile-dialer/recordings/:activityId/complete` → Compass saves `recording_url`, so ▶ Play
works on the website and in the Calls tab. Code: `src/features/recordings/`,
`src/lib/recordingMatch.ts`, `src/api/recordings.ts`, `modules/sim-dialer` (4 functions). This is the
app's second write to Compass (ADR 0007 supersedes the "only write" line in 0005/0006).

**Compass side (Mithilesh, `leadsquared-avataar-server`), done and live:** the upload-url and complete
endpoints, S3 storage, and the play endpoint redirecting to the stored file. Not built here.

**Remaining:** iPhone (iOS 18.1+ saves recordings to Notes, no file access), a reminder for calls
without a recording, automatic retry of failed uploads, and company sign-off on recording customer
calls (consent wording, who can listen, how long to keep them, DPDP Act 2023). Needs a new store
build (native code).

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
- Call sessions: all transitions in `src/lib/callState.ts`. `startCall()` stores the session before
  dialing.
- `modules/sim-dialer`: Kotlin, Swift and `index.ts` must stay in step. `READ_CALL_LOG` is used for
  talk time only ([ADR 0006](docs/decisions/0006-call-times-and-whatsapp.md)); never add write access to
  the call log or contacts.
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

## Planned: call recording upload (not built yet)

Agreed 2026-11-06. Apps can't record calls (Android 10+ blocks it, iOS never allows it), so the
agent records with the phone's own dialer and the app uploads that file afterwards.

**Flow:** call ends → app logs it (`POST /activities/log`, returns `activity_id`) → summary card
shows **Upload recording** → agent picks the audio file → app uploads it to Compass with the
agent's JWT → Compass stores it in S3 and saves `recording_url` on that activity → the existing
▶ Play (`GET /ameyo/recording/:activityId`, which reads `recording_url` and redirects) plays it on
the website and in the app's Calls tab.

**App side (this repo):**

- Upload recording button on the call summary card, and a reminder for calls without one.
- File picker (`audio/*`); optionally auto-find the newest recording made during the call
  (Android only, needs the "Music and audio" permission). Recording folders differ by brand:
  Samsung `Recordings/Call`, Xiaomi `MIUI/sound_recorder/call_rec`; Google Phone keeps them inside
  its app (agent must share/save first); iPhone (iOS 18.1+) saves to Notes (export to Files first).
- Upload only after the call log has an `activity_id`; keep the file reference on the phone and
  retry like the call log (`sendCalls.ts`). Show progress and failures.
- This is a second write to Compass (ADR 0006 says the call log is the only one): record it in
  ADR 0007 before building. Tests and docs as usual.

**Compass side (Mithilesh, `leadsquared-avataar-server`). Don't build these here:**

1. Upload endpoint, e.g. `POST /activities/:activityId/recording`: JWT-protected, one audio file
   (m4a, mp3, wav, amr, ogg, ≤ about 25 MB), and only for a `manual_outbound_call` activity whose
   `agent_user_id` is the caller.
2. Store the file in S3 (reuse `src/modules/exports/s3/s3.service.ts`), e.g.
   `recordings/manual/<activity_id>.<ext>`, and save `recording_url` in that activity's
   `activity_type_attributes`.
3. List `manual_outbound_call` in the call-history queries in `src/modules/ameyo/ameyo.service.ts`
   (`getCallHistoryForOpportunity` and the lead version), so app calls show in the Calls tab at
   all. Add it there, not to the shared `CALL_ACTIVITY_CODES`, which also drives telephony logging.
4. Raise nginx `client_max_body_size` for that route (the default 1 MB rejects recordings).
5. Decide public vs private files: telephony recordings use public CDN links; for customers'
   voices prefer a private S3 object and have the play endpoint redirect to a short-lived
   presigned URL (`getPresignedDownloadUrl` already exists).

**Still to decide before building:** which phones agents use (picker only vs auto-find), and
company sign-off on recording customer calls (consent wording, who can listen, how long to keep
them, DPDP Act 2023).

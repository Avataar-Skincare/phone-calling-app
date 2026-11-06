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

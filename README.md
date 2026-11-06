# Compass Dialer

Mobile calling app for Avataar Skincare sales and support agents. Agents see their leads from
**Compass** Smart Views, call a lead with one tap from their own phone, or open a WhatsApp chat
with them. Each call is logged in Compass as a "Manual Outbound Call" with talk, ringing and total
time ([ADR 0005](docs/decisions/0005-log-calls-as-manual-outbound-call.md), [0006](docs/decisions/0006-call-times-and-whatsapp.md)); outcomes are recorded on the Compass website.

**Platforms:** Android and iOS · **Status:** in development (v1) · **Backend:** Compass
(`leadsquared-avataar-server`)

## Features

- Phone-number OTP login with the agent's Compass account
- Compass Smart Views: Sales / Customer Support, all 14 views with Compass's filters, sort and paging
- One-tap calling from the phone's SIM (instant on Android, system prompt on iPhone), SIM choice on
  dual-SIM Android phones
- "Calling …" banner while a call is live; one call at a time
- After each call: talk time, ringing and total shown on screen and logged in Compass (kept and retried when offline)
- WhatsApp button next to every Call button, opening a chat with the client's number
- Client page like Compass's opportunity page: profile, tiles, Properties and all tabs (read-only:
  stages and outcomes are changed on the Compass website)

## Tech stack

Expo SDK 56 · React Native 0.85 · TypeScript · expo-router · TanStack Query · Zustand ·
expo-secure-store · local Expo module in Kotlin and Swift · EAS Build

## Getting started

```bash
nvm use                      # Node 22
npm install
eas build --profile development --platform android   # or ios; install on a phone
npm start
```

The app points at **Compass testing** by default. Log in with a number that exists as a user
there. Full setup, including local native builds: [docs/development.md](docs/development.md).

## Scripts

| Command             | Purpose                                              |
| ------------------- | ---------------------------------------------------- |
| `npm start`         | Dev server                                           |
| `npm run verify`    | Lint, formatting, type-check, tests and bundle check |
| `npm test`          | Unit tests                                           |
| `npm run typecheck` | Route types + TypeScript                             |
| `npm run lint`      | ESLint                                               |
| `npm run format`    | Prettier                                             |

## Project structure

```
├── src/
│   ├── app/              Screens (expo-router). (auth) = login, (main) = signed in
│   ├── api/              Compass API client, one file per area
│   ├── features/         Feature modules: leads, calling
│   ├── lib/              Pure logic with unit tests (phone, time, session, call state)
│   ├── store/            Zustand stores (auth, call session, settings)
│   ├── components/       Shared UI components
│   ├── theme/            Design tokens (light and dark)
│   ├── hooks/            Shared hooks
│   ├── config/           Environment config
│   └── types/            Compass API types
├── modules/sim-dialer/   Native module: place SIM calls, report call state (Kotlin + Swift)
├── docs/                 Architecture, API, calling, development, testing, release, ADRs
├── scripts/              Tooling scripts
└── .github/              CI workflow, PR and issue templates
```

## Documentation

- [Architecture](docs/architecture.md)
- [Compass API](docs/compass-api.md)
- [Calling](docs/calling.md)
- [Development](docs/development.md)
- [Testing](docs/testing.md)
- [Release](docs/release.md)
- [Decision records](docs/decisions/)
- Product design: [Phone Calling App Design](https://claude.ai/artifact/Rx7q8kQYxno946jBJYAhn8)

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md). Changes are listed in [CHANGELOG.md](CHANGELOG.md).

## License

Proprietary. © Avataar Skincare. Internal use only; not for distribution.

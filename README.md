# Compass Dialer

Mobile calling app for Avataar Skincare sales and support agents. Agents see their leads from
**Compass** Smart Views, call a lead with one tap from their own phone, and record how the call
went. The outcome is saved to Compass, exactly as if it had been entered on the web.

**Platforms:** Android and iOS · **Status:** in development (v1) · **Backend:** Compass
(`leadsquared-avataar-server`)

## Features

- Phone-number OTP login with the agent's Compass account
- Smart View tabs (First Call, Hot Leads, Hot & Warm Tasks, …) with counts, search and paging
- One-tap calling from the phone's SIM (instant on Android, system prompt on iPhone), SIM choice on
  dual-SIM Android phones
- Call tracking: start, end, duration, and on iPhone whether the customer answered
- Lead screen with stage, task, details and recent activity
- Outcome sheet after every call, saved to Compass, with an offline queue

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
- [Call outcomes](docs/outcomes.md)
- [Development](docs/development.md)
- [Testing](docs/testing.md)
- [Release](docs/release.md)
- [Decision records](docs/decisions/)
- Product design: [Phone Calling App Design](https://claude.ai/artifact/Rx7q8kQYxno946jBJYAhn8)

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md). Changes are listed in [CHANGELOG.md](CHANGELOG.md).

## License

Proprietary. © Avataar Skincare. Internal use only; not for distribution.

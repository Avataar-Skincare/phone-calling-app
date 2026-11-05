# Architecture

## Overview

Compass Dialer is a **frontend only**. All data lives in Compass, Avataar Skincare's CRM
(`leadsquared-avataar-server`, NestJS). The app is a second client of the same API the Compass web
app (`leadsquared-avataar-client`) uses. Calls are ordinary mobile calls from the agent's own SIM;
the in-house dialer (Skytel / FreeSWITCH) is not involved.

```
┌────────────────┐   mobile network   ┌──────────────────────────┐   HTTPS + JWT   ┌──────────────┐
│ Customer phone │ ◀────────────────▶ │ Compass Dialer (this app)│ ◀─────────────▶ │ Compass API  │
└────────────────┘                    │  sim-dialer native module│                 └──────────────┘
                                      └──────────────────────────┘
```

## Layers

| Layer        | Folder                          | Responsibility                                                               |
| ------------ | ------------------------------- | ---------------------------------------------------------------------------- |
| Screens      | `src/app/`                      | expo-router routes. `(auth)` = logged out, `(main)` = logged in              |
| Features     | `src/features/<feature>/`       | Feature UI and hooks: `leads`, `calling`                                     |
| API          | `src/api/`                      | One file per Compass area; `client.ts` handles auth headers and errors       |
| Domain logic | `src/lib/`                      | Pure functions (phone, time, session, call state), each with a `.test.ts`    |
| State        | `src/store/`                    | Zustand stores: auth (SecureStore), call session and settings (AsyncStorage) |
| UI kit       | `src/components/`, `src/theme/` | Shared components and design tokens (light and dark)                         |
| Types        | `src/types/compass.ts`          | Compass response shapes                                                      |
| Native       | `modules/sim-dialer/`           | Local Expo module (Kotlin + Swift): place calls, report call state           |

Rules of thumb:

- Screens never call `fetch`; they use hooks in `src/features/*` that wrap `src/api/*`.
- Anything with branching rules (dates, phone numbers, call states) is a pure function in
  `src/lib/` with a test, so it can be checked without a device.
- Screens only see `LeadItem` (`src/features/leads/leadItem.ts`), never raw Smart View rows. Compass
  returns two row shapes (lead views and task views); the mapper is the one place that knows both.

## Navigation and auth

`src/app/_layout.tsx` renders one `Stack` with two `Stack.Protected` groups. The session in
`useAuthStore` decides which group exists:

- no session → `(auth)`: `login`, `otp`
- session → `(main)`: `index` (lead lists), `lead/[opportunityId]`, `settings`, `permissions`

Logging out, a 401 from Compass, or the 15-hour token expiry all clear the session, and routing
follows. Nothing navigates to login by hand.

The session (JWT + user) is stored in SecureStore (`src/lib/auth.ts`). Expiry is read from the
token's `exp` claim; the app signs out when it passes, including on return to the foreground.

## Server data

TanStack Query owns everything fetched from Compass (`src/features/leads/useLeadQueries.ts`):

| Query key                               | Data                      | Freshness                  |
| --------------------------------------- | ------------------------- | -------------------------- |
| `["smart-views", "definitions"]`        | Tab list                  | Session (static on server) |
| `["departments"]`                       | Department id → code      | Session                    |
| `["smart-views", "counts", dept]`       | Tab counts                | Refetched on focus         |
| `["smart-views", "data", view, search]` | Paginated rows (infinite) | Refetched on focus / pull  |
| `["opportunity", id]`                   | Lead screen               | Refetched on pull          |

`focusManager` is tied to `AppState`, so lists refresh when an agent comes back from a call.

## Local state

| Store            | Persisted in | Holds                                                           |
| ---------------- | ------------ | --------------------------------------------------------------- |
| `auth.store`     | SecureStore  | Session token and user                                          |
| `call.store`     | AsyncStorage | The current / last call session (survives the app being killed) |
| `settings.store` | AsyncStorage | Chosen SIM, whether the permission explainer was shown          |

## Configuration

`app.config.ts` sets the app identity (`com.avataarskin.dialer`) and the Compass URL. EAS build
profiles (`eas.json`) set `EXPO_PUBLIC_COMPASS_API_URL` per environment. See
[development.md](development.md#environments).

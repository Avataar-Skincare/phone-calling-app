# Testing

Four layers, from fastest to slowest:

| Layer           | What it proves                                                                                               | Where                                                                            | Command                 |
| --------------- | ------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------- | ----------------------- |
| **Unit**        | Each rule and module on its own                                                                              | `src/**/*.test.ts`, `modules/sim-dialer/index.test.ts`                           | `npm test`              |
| **Integration** | Screens, navigation, stores and the Compass client working together, against a fake Compass and a fake phone | `tests/integration/*.test.tsx`, `src/features/**/{saveOutcome,callFlow}.test.ts` | `npm test`              |
| **Contract**    | The real Compass API still returns what the app relies on (read-only)                                        | `tests/contract/`                                                                | `npm run test:contract` |
| **Device**      | Real phones, real calls                                                                                      | [device matrix](#real-device-test-matrix), [test reports](test-reports/)         | manual                  |

`npm test` runs unit and integration together (Jest, `jest-expo` preset). `npm run test:coverage` adds a
coverage report in `coverage/`. CI runs both on every pull request and uploads the coverage report.

## Unit tests

| Suite                                 | Covers                                                                             |
| ------------------------------------- | ---------------------------------------------------------------------------------- |
| `src/lib/phone.test.ts`               | Login number parsing, E.164 for dialing, masking, formatting                       |
| `src/lib/session.test.ts`             | JWT expiry, 15 h fallback, stored-session parsing                                  |
| `src/lib/time.test.ts`                | IST labels ("Today 4:05 pm"), overdue checks                                       |
| `src/lib/callState.test.ts`           | Every call-state transition (Android and iOS), resume rules, durations             |
| `src/lib/auth.test.ts`                | Sign in, restore, expiry, sign out (SecureStore and query cache)                   |
| `src/api/client.test.ts`              | URLs, auth header, NestJS errors, 5xx, network failure, 401 handling, 20 s timeout |
| `src/store/stores.test.ts`            | Call store (ended calls wait for finishCall) and settings store                    |
| `src/lib/callLog.test.ts`             | Manual Outbound Call request body, phone digits, retry rules                       |
| `src/features/leads/leadItem.test.ts` | Both Smart View row shapes → `LeadItem`                                            |
| `modules/sim-dialer/index.test.ts`    | Fallback without the native module (`tel:` link, no tracking)                      |

## Integration tests

They render the **real app** (`src/app`) with expo-router's `renderRouter` and React Native Testing
Library 13. Two test doubles stand in for the outside world:

- **Fake Compass** (`tests/support/compass.ts`): answers every endpoint from fixtures shaped like real
  responses, records each request, and can be told per test to fail (`"network-error"`, 400, 403, 5xx).
- **Fake phone** (`modules/sim-dialer/__mocks__/index.ts`): records `placeCall` and lets a test emit
  call events (`offhook`, `idle`, `dialing`, `connected`, `ended`) exactly as the native module would.

| Suite                                    | Flows                                                                                                                                                                                                                                                                                                    |
| ---------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `tests/integration/login.test.tsx`       | Phone + code → lists; invalid number; not a Compass user; offline; wrong and expired code; 401 → back to login                                                                                                                                                                                           |
| `tests/integration/leads.test.tsx`       | Tabs, counts, masked numbers, due/overdue; tab switch; search; empty/error states; counts timing out; Central-department switch; lead screen; reassigned lead                                                                                                                                            |
| `tests/integration/calling.test.tsx`     | Call → events → banner → summary (talk, ringing, total) → Manual Outbound Call sent; not answered; Compass refuses → Retry; offline → waiting; next call straight after; call ended while app closed; Android permission explainer; iPhone direct; second-call guard; WhatsApp from list and client page |
| `tests/integration/settings.test.tsx`    | Account details, logout, logout blocked during a call, SIM choice, permissions, "call still open" guard                                                                                                                                                                                                  |
| `tests/integration/filters.test.tsx`     | Stage, source, date range (presets and custom), owner (team lead only), status filters sent like Compass; filters remembered per view; sort and rows per page                                                                                                                                            |
| `tests/integration/opportunity.test.tsx` | Client page with data: Sales and CS Overview cards; Activities (failed dialer attempts hidden); Tasks (groups, status filter, read-only); Calls (recording link, paging); Stage History; Purchase History items; Appointments                                                                            |
| `src/features/calling/sendCalls.test.ts` | Sent with the agent's token; activity_id null = refused; offline back-off and retry; 400 not retried; oldest first, per agent                                                                                                                                                                            |
| `src/features/calling/callFlow.test.ts`  | Session stored before dialing; SIM choice; failure cleanup; untracked calls; call times from the call log / iOS answer, retry until the log entry appears                                                                                                                                                |

### Writing a new one

```ts
const server = fakeCompass(); // defaults: Sales agent with two tabs of work
signedInAs(); // skip login (from tests/support/state)
server.on("GET", "/smart-views/data", "network-error"); // make Compass fail
renderRouter("./src/app", { initialUrl: "/" });
expect(await screen.findByLabelText("Asha Rao, open lead")).toBeTruthy();
expect(server.find("GET", "/smart-views/data")[0]?.query).toEqual({ ... });
```

Things to know:

- `renderRouter` switches to **fake timers**. Use `findBy*` / `waitFor` (they advance timers), never a
  real `setTimeout` wait. `jest.setup.ts` flushes pending timers after each test.
- Wait for navigation to settle before a test ends (e.g. `await screen.findByText("My leads")`).
- Jest's platform is **iOS**. For Android-only behaviour use
  `jest.replaceProperty(Platform, "OS", "android")` and restore it.
- Tabs are queried by role: `getByRole("tab", { name: /First Call/ })` (the label includes the count).
- Any un-mocked `fetch` throws, so a test can never reach the network by accident.

## Contract tests

`tests/contract/compass.contract.test.ts` logs in to Compass (`test-leads`, which is the **live** Compass) and checks login, departments,
Smart View definitions and data (both row shapes go through `toLeadItem`) and the lead endpoint.
**It never saves anything.** It refuses to run against production.

```bash
COMPASS_TEST_PHONE=<bypass number> COMPASS_TEST_OTP=<bypass code> npm run test:contract
```

Without the variables every test is skipped. In CI the job runs only when the repository has the
`COMPASS_TEST_PHONE` and `COMPASS_TEST_OTP` secrets. Use a bypass number so no SMS is sent.

## Not covered by automated tests

- Native code itself (`SimDialerModule.kt`, `SimDialerModule.swift`): compiled in CI (Android) and by
  EAS (iOS), exercised on devices.
- The native date-picker dialogs, real call audio and networks, and WhatsApp itself.
- The call log against the real Compass (contract tests are read-only by design).

## Real-device test matrix

Run before every store build. Devices: Samsung, Xiaomi/Redmi, Vivo or Oppo, OnePlus (Android 11–15),
and two iPhones (current iOS and one older).

| Case                                          | Expected                                                                                                              |
| --------------------------------------------- | --------------------------------------------------------------------------------------------------------------------- |
| Answered call, agent hangs up                 | Summary shows talk / ringing / total matching the phone's call history; "Manual Outbound Call" on the lead in Compass |
| Customer doesn't answer                       | "Not answered · Rang for …"; activity has `call_answered: no`                                                         |
| Call logs permission refused                  | Call still logged, total only                                                                                         |
| Agent cancels the iOS "Call" prompt           | No session; list still usable                                                                                         |
| App killed during the call                    | On reopen after the call, no banner and no form                                                                       |
| WhatsApp button                               | WhatsApp opens a chat with the client's number                                                                        |
| Dual SIM, SIM 2 chosen                        | Call goes out on SIM 2                                                                                                |
| Phone permission denied, then blocked         | Clear message, link to Settings, no crash; dialer fallback works                                                      |
| Battery saver / app in background for an hour | Call still tracked; banner clears after the call                                                                      |
| Lead reassigned mid-session                   | Client page explains it; lead leaves the list                                                                         |
| Token older than 15 hours                     | Back to login                                                                                                         |

Record each run in [test-reports/](test-reports/): device, OS version, pass / fail, notes.

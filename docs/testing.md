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

| Suite                                  | Covers                                                                             |
| -------------------------------------- | ---------------------------------------------------------------------------------- |
| `src/lib/phone.test.ts`                | Login number parsing, E.164 for dialing, masking, formatting                       |
| `src/lib/session.test.ts`              | JWT expiry, 15 h fallback, stored-session parsing                                  |
| `src/lib/time.test.ts`                 | IST labels ("Today 4:05 pm"), overdue checks                                       |
| `src/lib/followUp.test.ts`             | Quick follow-up times on the IST clock                                             |
| `src/lib/callState.test.ts`            | Every call-state transition (Android and iOS), resume rules, durations             |
| `src/lib/auth.test.ts`                 | Sign in, restore, expiry, sign out (SecureStore and query cache)                   |
| `src/api/client.test.ts`               | URLs, auth header, NestJS errors, 5xx, network failure, 401 handling, 20 s timeout |
| `src/store/stores.test.ts`             | Call, outcome-queue and settings stores                                            |
| `src/features/leads/leadItem.test.ts`  | Both Smart View row shapes → `LeadItem`                                            |
| `src/features/outcome/outcome.test.ts` | Stage rules, validation, call details, payloads                                    |
| `src/features/outcome/queue.test.ts`   | Retry back-off, failure classification, due items                                  |
| `modules/sim-dialer/index.test.ts`     | Fallback without the native module (`tel:` link, no tracking)                      |

## Integration tests

They render the **real app** (`src/app`) with expo-router's `renderRouter` and React Native Testing
Library 13. Two test doubles stand in for the outside world:

- **Fake Compass** (`tests/support/compass.ts`): answers every endpoint from fixtures shaped like real
  responses, records each request, and can be told per test to fail (`"network-error"`, 400, 403, 5xx).
- **Fake phone** (`modules/sim-dialer/__mocks__/index.ts`): records `placeCall` and lets a test emit
  call events (`offhook`, `idle`, `dialing`, `connected`, `ended`) exactly as the native module would.

| Suite                                      | Flows                                                                                                                                                                                                      |
| ------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `tests/integration/login.test.tsx`         | Phone + code → lists; invalid number; not a Compass user; offline; wrong and expired code; 401 → back to login                                                                                             |
| `tests/integration/leads.test.tsx`         | Tabs, counts, masked numbers, due/overdue; tab switch; search; empty/error states; counts timing out; Central-department switch; lead screen; reassigned lead                                              |
| `tests/integration/calling.test.tsx`       | Call → events → outcome sheet → validation → saved payload; offline → queued → retried; 403 → discard; Android permission explainer; iPhone direct; restore after restart; second-call guard; logout guard |
| `tests/integration/settings.test.tsx`      | Account details, logout, logout blocked during a call, SIM choice, permissions, "call still open" guard                                                                                                    |
| `src/features/outcome/saveOutcome.test.ts` | Save / queue / reject per status code; queue flush order, per-user, back-off, no double send                                                                                                               |
| `src/features/calling/callFlow.test.ts`    | Session stored before dialing; SIM choice; form prefetch; failure cleanup; untracked calls                                                                                                                 |

### Writing a new one

```ts
const server = fakeCompass(); // defaults: Sales agent with two tabs of work
signedInAs(); // skip login (from tests/support/state)
server.on("POST", /activity-form$/, "network-error"); // make Compass fail
renderRouter("./src/app", { initialUrl: "/" });
expect(await screen.findByText("Asha Rao")).toBeTruthy();
expect(server.find("POST", /activity-form$/)[0]?.body).toEqual({ ... });
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

`tests/contract/compass.contract.test.ts` logs in to **Compass testing** and checks login, departments,
Smart View definitions and data (both row shapes go through `toLeadItem`), the lead endpoint and the
outcome form config. **It never saves anything.** It refuses to run against production.

```bash
COMPASS_TEST_PHONE=<bypass number> COMPASS_TEST_OTP=<bypass code> npm run test:contract
```

Without the variables every test is skipped. In CI the job runs only when the repository has the
`COMPASS_TEST_PHONE` and `COMPASS_TEST_OTP` secrets. Use a bypass number so no SMS is sent.

## Not covered by automated tests

- Native code itself (`SimDialerModule.kt`, `SimDialerModule.swift`): compiled in CI (Android) and by
  EAS (iOS), exercised on devices.
- The native date-picker dialogs (`DateTimeField`), and real call audio and networks.
- Saving outcomes to the real Compass (contract tests are read-only by design).

## Real-device test matrix

Run before every store build. Devices: Samsung, Xiaomi/Redmi, Vivo or Oppo, OnePlus (Android 11–15),
and two iPhones (current iOS and one older).

| Case                                          | Expected                                                         |
| --------------------------------------------- | ---------------------------------------------------------------- |
| Answered call, agent hangs up                 | Outcome sheet opens on return; duration is right                 |
| Customer doesn't answer                       | iPhone pre-selects Not connected; Android lets the agent choose  |
| Agent cancels the iOS "Call" prompt           | No session; list still usable                                    |
| App killed during the call                    | On reopen, the sheet appears for that call                       |
| Save with no network                          | Queued; saved automatically when online; visible in Compass      |
| Dual SIM, SIM 2 chosen                        | Call goes out on SIM 2                                           |
| Phone permission denied, then blocked         | Clear message, link to Settings, no crash; dialer fallback works |
| Battery saver / app in background for an hour | Call still tracked; sheet still appears                          |
| Lead reassigned mid-session                   | Save returns 403; error shown; lead leaves the list              |
| Token older than 15 hours                     | Back to login; queued outcomes kept and sent after login         |
| Each stage in the form config                 | Required fields enforced; Compass accepts the save               |

Record each run in [test-reports/](test-reports/): device, OS version, pass / fail, notes.

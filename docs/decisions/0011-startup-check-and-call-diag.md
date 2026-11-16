# 0011: "Before you start" check, and call_diag on calls without talk time

- **Status:** Accepted
- **Date:** 2026-11-13
- **Builds on:** [0008](0008-call-log-access-required.md) (call-log access is required)

## Context

Agent Bavadharani's Android phone says every permission is granted, yet the call log the app reads
comes back **empty on every call**, so no call has talk time. Some phone makers (Xiaomi, Realme,
Oppo) add an extra privacy switch that hides the call log from apps even when Android's own
permission is on. The app cannot tell this apart from "no entry yet", and neither can we from
Compass: a call without talk time looks the same whatever the cause.

ADR 0008 only checks the permission, and only when the agent taps Call. Two things were missing:
a check when the app opens, and a way to see which permission is off on a call that went wrong.

## Decision

### 1. A "Before you start" check when the app opens (Android, native module only)

`StartupCheck` runs when the main screens mount (the agent is signed in) and each time the app
returns to the foreground (at most once a second). The rules are pure
(`src/lib/startupCheck.ts`):

| Kind         | What                                                                                         | Agent can skip? |
| ------------ | -------------------------------------------------------------------------------------------- | --------------- |
| **Required** | Phone access missing (call or phone state). Call-log access missing (same as 0008).          | No              |
| **Warning**  | Call-log access is on but the phone shows **no call-log entries** (30 days).                 | Yes, for 24 h   |
| **Tip**      | Recordings: share steps on Google Phone. The folder is not asked for here (Settings has it). | Never blocks    |

The screen `setup-check` opens by itself for a required issue or an un-skipped warning, never for
tips alone. **Continue** is enabled only when nothing required is left. **Skip** (and Continue while
the warning shows) is remembered for 24 hours in the settings store, so the agent is not nagged on
every open; after 24 hours it shows again. Settings has **Check my phone** to open it by hand.

The call-time gate from 0008 (`useCallLead` to `/permissions`) stays as the safety net.

The hidden-log warning does not block because the check can be wrong: a new phone with no calls in
30 days also shows 0 entries. The agent can still call; the diagnostics below say what happened.

### 2. `call_diag` on calls whose talk time is missing, and only those

When `finishCall` cannot read talk time on Android (the lookup failed after its retries), it adds a
small `call_diag` object to the stored call and to `POST /activities/log` as `data.call_diag`:

```json
{
  "phone": "granted",
  "phone_state": "granted",
  "call_log": "granted",
  "call_log_visible": "no",
  "lookup": "not_found",
  "device": "Xiaomi Redmi Note 12 · Android 14",
  "app": "1.0.0 (12)"
}
```

- `call_log_visible`: `yes` / `no` / `unknown` from a count of the last 30 days of entries.
- `lookup`: why the lookup failed: `no_permission`, `not_found` (nothing seen), `number_mismatch`
  (outgoing calls seen, none to this number) or `error` (the phone could not say).
- A call **with** talk time (even 0 seconds) carries no `call_diag` at all, and
  `buildCallLogRequest` drops it if one was ever stored.

Compass stores unknown `data` keys in `activity_type_attributes`, so no Compass change is needed
(same as `call_log_permission` in 0008).

### 3. Native additions (Android; iOS returns neutral values)

`callLogVisibleCount()` (-1 without the permission), `defaultDialerPackage()` and
`callLogLookupDebug(number, sinceMs)` (`{ permission, outgoingSince, matchedNumber }`).
`lastCallFromLog` is unchanged. `index.ts` guards each with `typeof native.fn === "function"`, so
an older build falls back to -1 / null instead of failing.

## Privacy

Counts and flags only. Nothing from the call log leaves the phone: no numbers, no contents, no
contacts. The only number involved is the lead's own, which the log already carries. `device` and
`app` describe the phone and the app, not the person. `READ_CALL_LOG` is still used for talk time
and these counts only (ADR 0006); there is still no write access.

## Consequences

- Support can filter Compass activities with `call_diag` and see which switch is off per phone model.
- An agent with a phone that hides the log gets told at app open, with steps, not after a day of
  calls without talk time.
- Needs a **new native build**: the three native functions. An older build still runs: the check
  then sees "unknown" and the diagnostics report `lookup: "error"`.
- Open: a phone with no calls in 30 days shows the warning once a day until the agent skips it.

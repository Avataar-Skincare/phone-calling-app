# 0008: Call-log access is required to call from the app on Android

- **Status:** Accepted
- **Date:** 2026-11-12
- **Amends:** [0006](0006-call-times-and-whatsapp.md) (its "declining still works")
- **Decided by:** Sanvi
- **Number:** 0007 is reserved for call recording upload (see `CLAUDE.md`).

## Context

Compass gets a new **Agent Audit** page (in `leadsquared-avataar-server` and
`leadsquared-avataar-client`) that sums each agent's ringing and talk time from Skytel and from
this app. On Android, talk time comes only from the phone's call log (ADR 0006). An agent who
declined the "Call logs" permission still could call, through the dialer, and those calls reached
Compass with the total time only, so the audit couldn't split them into ringing and talking.

## Decision

1. **Required on Android.** Before every call the app checks `canReadCallLog`
   (`mustAskForCallLog`, `src/lib/callPermission.ts`). Without it the call is blocked and the
   permissions screen opens, with **Allow** / **Open Settings** and **Cancel**. The "Not now, use the
   dialer" option is removed. The check runs on every call, not once, because access can be turned
   off in Settings at any time.
2. **Marked on every Android call.** The call log sends `call_log_permission: "granted" | "denied"`,
   read when the call ends. "denied" still happens when access is turned off mid-call; Compass's
   Agent Audit counts those calls in a "No call-log" column.
3. iOS is unchanged (it doesn't use the call log) and sends no `call_log_permission`. Builds without
   the native module (Expo Go) aren't blocked.

## Consequences

- An Android agent who won't allow call-log access can't call from the app. There is no override;
  a managed phone that can never grant it can't be used for calling.
- Compass stores `call_log_permission` as-is: `POST /activities/log` keeps extra `data` keys. No
  Compass change was needed for the field.
- `permissionIntroSeen` no longer gates calling; it is still set when the screen is used.

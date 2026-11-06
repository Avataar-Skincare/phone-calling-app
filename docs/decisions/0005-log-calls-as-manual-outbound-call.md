# 0005: Log each call as a "Manual Outbound Call" activity; outcomes stay on the web

- **Status:** Accepted
- **Date:** 2026-11-06
- **Supersedes:** [0002](0002-save-outcomes-through-activity-form.md)
- **Decided by:** Mithilesh (product owner); to be built by Vishal

## Context

v1 opens an outcome sheet after every call and saves it through Compass's activity form (ADR
0002). The business wants agents to record outcomes **only on the Compass website, on their
desktop**. The phone's job is to place the call and leave a record that the call happened.

## Decision

1. **Remove the outcome sheet from the app.** No stage change, no activity form, no follow-up
   fields on the phone.
2. **When a call ends, the app logs one activity** of type `manual_outbound_call` (label
   "Manual Outbound Call") through the existing endpoint `POST /api/activities/log`, with the
   agent's JWT. No Compass code change.
3. The activity is stored as **Added by: Integration**. That is accepted. The caller is recorded
   inside the activity details (`agent_user_id`, `agent_name`).

## Request

```http
POST /api/activities/log
Authorization: Bearer <agent JWT>
Content-Type: application/json
```

```json
{
  "phone": "9871107094",
  "activity_type": "manual_outbound_call",
  "opportunity_id": "12345",
  "data": {
    "agent_user_id": "42",
    "agent_name": "Priya Sharma",
    "call_started_at": "2026-11-06T10:15:02.000Z",
    "call_ended_at": "2026-11-06T10:18:40.000Z",
    "call_duration_seconds": 218,
    "call_talk_seconds": 201,
    "call_answered": "unknown",
    "call_end_estimated": "no",
    "call_platform": "android",
    "call_sim": "sim-2",
    "call_source": "mobile_app",
    "app_session_id": "lz3k9a-x7f2qa"
  }
}
```

| Field                              | From                          | Notes                                                                                                                                      |
| ---------------------------------- | ----------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------ |
| `phone`                            | `session.phone`               | **Last 10 digits only.** Compass finds the lead with `LIKE '%<digits>'`; a `91` prefix can miss leads stored without it. `@Length(10, 15)` |
| `activity_type`                    | constant                      | `manual_outbound_call`                                                                                                                     |
| `opportunity_id`                   | `session.opportunityId`       | Attaches the activity to the opportunity the agent called from. Omit if null                                                               |
| `create_if_missing`                | —                             | **Never send it** (defaults to `false`). The app must not create leads                                                                     |
| `agent_user_id`, `agent_name`      | `useAuthStore().session.user` | Not verified by Compass; fine for an internal tool                                                                                         |
| `call_started_at`, `call_ended_at` | `startedAt`, `endedAt`        | ISO UTC (`toISOString()`), like every other time sent to Compass                                                                           |
| `call_duration_seconds`            | `endedAt - startedAt`         | Android includes ring time (see [calling.md](../calling.md))                                                                               |
| `call_talk_seconds`                | `endedAt - connectedAt`       | iPhone only; omit on Android                                                                                                               |
| `call_answered`                    | `connected`                   | `yes` / `no` on iPhone, `unknown` on Android                                                                                               |
| `call_end_estimated`               | `endApproximate`              | `yes` when the end time was inferred by `CallTracker`                                                                                      |
| `call_platform`, `call_sim`        | `platform`, `simId`           |                                                                                                                                            |
| `call_source`                      | constant                      | `mobile_app`. Tells these apart from Skytel and web activities                                                                             |
| `app_session_id`                   | `session.id`                  | Lets a duplicate from a retry be spotted                                                                                                   |

### Which calls are logged

| Session ends as                                                           | Log?                     |
| ------------------------------------------------------------------------- | ------------------------ |
| `ended` (answered, not answered, or approximate end)                      | **Yes**                  |
| `discarded` (agent cancelled the iOS prompt, nothing dialled within 15 s) | **No**, no call happened |

## Compass's response: read the body, not the status code

`/activities/log` **returns HTTP 200 on failure.** The controller catches every error and replies:

```json
{ "lead_id": null, "activity_id": null, "lead_created": false, "message": "<reason>" }
```

Success has a non-null `activity_id`. So:

| Result                                  | App does                                                                                                                                                                                                                             |
| --------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 200 with `activity_id`                  | Done. Drop the session                                                                                                                                                                                                               |
| 200 with `activity_id: null`            | **Failed.** Show on the Waiting to send screen with `message`, allow retry / discard. Typical causes: activity type not yet created in that Compass (`Activity type "manual_outbound_call" not found`), lead not found for the phone |
| No network, timeout, 401, 429, 5xx      | Queue and retry, same backoff as today (`src/features/outcome/queue.ts`)                                                                                                                                                             |
| 400 (DTO validation, e.g. phone length) | Failed, as above                                                                                                                                                                                                                     |

## Compass setup (one-time, per environment)

The activity type must exist or every log fails. Add it in **Compass → Settings → Activity
Types** (administrator) or with this SQL, testing Compass first, then live:

```sql
INSERT INTO activity_types (code, label, default_score, attributes)
SELECT 'manual_outbound_call', 'Manual Outbound Call', 0,
       '{"agent_user_id":null,"agent_name":null,"call_started_at":null,"call_ended_at":null,"call_duration_seconds":null,"call_talk_seconds":null,"call_answered":null,"call_end_estimated":null,"call_platform":null,"call_sim":null,"call_source":null,"app_session_id":null}'
WHERE NOT EXISTS (SELECT 1 FROM activity_types WHERE code = 'manual_outbound_call');
```

The attributes template must not be empty: `logActivity` rejects a type without one. Keys sent
beyond the template are still stored.

## Consequences

- **No automation fires.** Every `activity.logged` listener in Compass (call counter, DNP
  WhatsApp, lead re-open, task auto-complete, not-connected message, consultation-done, Journeys)
  filters on specific activity codes, and `manual_outbound_call` is in none of them. Checked
  against Compass `main` on 2026-11-06. Agents' outcome forms on the web trigger stage changes,
  tasks and Journeys as they do today.
- **Calls show "Added by: Integration".** Per-agent reports have to read
  `activity_type_attributes.agent_user_id`.
- **Lists don't move after a call.** A lead leaves the agent's list only once the outcome is saved
  on the web and the app refreshes.
- The offline queue, the Waiting to send screen and the backoff are kept, now carrying call logs
  instead of outcomes.

## What to change in the app

| Area                                                                                                                | Change                                                                                           |
| ------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------ |
| `src/app/(main)/outcome.tsx`, `src/features/outcome/{outcome,FieldInput,DateTimeField,useActivityFormConfig}.ts(x)` | Remove                                                                                           |
| `src/features/calling/callFlow.ts`                                                                                  | Drop `prefetchActivityFormConfig`                                                                |
| `src/features/outcome/OutcomeWatchers.tsx`                                                                          | On `status === "ended"`, build the call log, enqueue it, flush, clear the session. No navigation |
| `src/features/outcome/saveOutcome.ts`, `queue.ts`, `src/store/outcomeQueue.store.ts`                                | Send `/activities/log` instead of the activity form; treat `activity_id: null` as failed         |
| `src/api/activityForm.ts`                                                                                           | Replace with `src/api/activities.ts` → `logCallActivity()`                                       |
| New pure function, e.g. `src/lib/callLog.ts` + `callLog.test.ts`                                                    | Session → request body (field table above), per repo rules                                       |
| "A new call can't start while an outcome is pending"                                                                | Remove; nothing is pending any more                                                              |
| Logout                                                                                                              | No longer blocked by an unsaved call; still confirm when logs are queued                         |
| Tests, `docs/outcomes.md`, `docs/architecture.md`, `docs/compass-api.md`, `CHANGELOG.md`                            | Update                                                                                           |

Done when `npm run verify` passes and a real call on a phone shows a "Manual Outbound Call"
activity on that lead in Compass testing.

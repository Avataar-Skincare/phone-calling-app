# Call outcomes

After every call the agent records how it went. The outcome is saved to Compass through the same
Activity Form the web uses (see [ADR 0002](decisions/0002-save-outcomes-through-activity-form.md)).

## Flow

1. **During the call**, `startCall()` prefetches `GET /opportunities/:id/activity-form/config`, so
   the sheet opens instantly and still works if the network drops before the call ends.
2. **When the call ends**, `OutcomeWatchers` opens `/outcome` (once per call).
3. **The agent picks the new stage.** Compass's config decides the fields that follow
   (`text`, `number`, `dropdown`, `datetime`). On iPhone, an unanswered call pre-selects
   _Not Connected_; otherwise nothing is pre-selected, so the choice is deliberate.
4. **Save** builds the payload (`src/features/outcome/outcome.ts`) and sends it.
5. The session is cleared and the lists refresh.

The sheet can't be dismissed by swiping or the Android back button. The agent saves, or taps
**Didn't call** to discard the session. A new call can't start while an outcome is pending.

## Validation

Mirrors the web form, plus two rules:

| Rule                                                         | Message                                  |
| ------------------------------------------------------------ | ---------------------------------------- |
| No stage picked                                              | Pick the stage that describes this call. |
| Current stage picked and it has no form (would save nothing) | The lead is already in …                 |
| Required field empty                                         | _Label_ is required.                     |
| Number field not numeric                                     | Enter a number.                          |
| Dropdown value not in options                                | Pick one of the options.                 |
| Follow-up time in the past (2-minute grace)                  | Pick a time in the future.               |

The last rule is stricter than the web, which accepts past times.

## What's sent

- Field values: numbers as numbers, date-times as ISO UTC (like the web).
- Stages that log an activity: call details are added to `sub_form_data`:
  `call_source=mobile_app`, `call_platform`, `call_answered` (`yes`/`no`/`unknown`),
  `call_started_at`, `call_ended_at`, `call_duration_seconds`, `call_talk_seconds` (iPhone),
  `call_end_estimated=yes` when the end time was inferred.
- Stages without an activity: a one-line summary goes into `concerns_raised`, which Compass saves
  as the stage-change reason (for example
  `Call from Compass Dialer · Today 11:00 am · talked 3 min 12 s · answered`).
- The optional free note goes into `concerns_raised` as well.

## Offline queue

| Save result                                        | What happens                                          |
| -------------------------------------------------- | ----------------------------------------------------- |
| Saved                                              | Session cleared, lists refreshed                      |
| No network, timeout, 429, 5xx, or 401 (logged out) | Queued on the phone; agent told "Saved on your phone" |
| 400 (validation)                                   | Error shown in the sheet; nothing queued              |
| 403 / 404 (lead no longer the agent's)             | Error shown; agent can only discard                   |

Queued outcomes (`src/store/outcomeQueue.store.ts`, persisted) are sent by `flushOutcomeQueue()`:
on start, on every return to the foreground, and every 15 s while any are waiting. Retries back
off 30 s, 1, 2, 4, 8, then every 10 minutes. Only the agent who recorded an outcome sends it, so
queued items survive logout and go out after the same agent logs back in. A queued item that
Compass later rejects is marked _failed_ and shown on the **Waiting to send** screen
(`/pending`), where the agent can retry or discard it.

Logging out with an unsaved call is blocked. Logging out with queued outcomes asks for
confirmation.

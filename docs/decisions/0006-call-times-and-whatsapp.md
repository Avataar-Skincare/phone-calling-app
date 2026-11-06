# 0006: Talk, ringing and total time on every call; WhatsApp button; no outcomes, stage or task changes in the app

- **Status:** Accepted
- **Date:** 2026-11-06
- **Builds on:** [0005](0005-log-calls-as-manual-outbound-call.md) (Manual Outbound Call activity)
- **Decided by:** Vishal

## Context

ADR 0005 logs a "Manual Outbound Call" activity after every call, with talk time on iPhone only,
because Android reports no "answered" moment. The business wants three times for every call on
both platforms:

- **talk time**: how long the client talked;
- **ringing time**: how long it rang before that;
- **total**: how long the call lasted, as in ADR 0005 (dialing start → end).

## Decision

1. **Times** (`callTimes()` in `src/lib/callState.ts`):
   - total = call end − call start, ADR 0005's definition, on both platforms. The start is the
     phone's "dialing" event, not the tap on Call: the gap before it (iPhone's confirm prompt,
     the dialer when Call permission is off, app delay) is not ringing and would inflate it. The
     end is the phone's own "call ended" event, not when the agent returns to the app. When no
     start event arrived (permission off, app killed), the tap time is used instead.
   - talk = iPhone: end − answer (from `CXCallObserver`), 0 if never answered. Android: the call
     log's `DURATION` for that call, 0 if not answered.
   - ringing = total − talk.
2. **Android reads the call log** (`READ_CALL_LOG`) for that one value: the newest outgoing call
   to the number since the tap, matched on the last 10 digits, retried for up to 4 s because the
   phone writes the entry just after the call. Without the permission, talk and ringing are
   unknown and only the total is sent.
3. **Sent with the ADR 0005 activity**, adding to its fields:

   | Field                   | Value                                             |
   | ----------------------- | ------------------------------------------------- |
   | `call_duration_seconds` | total, start → end (unchanged from ADR 0005)      |
   | `call_talk_seconds`     | talk, on Android too                              |
   | `call_ring_seconds`     | ringing (new)                                     |
   | `call_tapped_at`        | tap time, ISO UTC (new, for information only)     |
   | `call_answered`         | `yes` / `no` on both platforms when talk is known |

   A tap → end total was considered and dropped: on iPhone it counted the confirm prompt as
   ringing.

4. **No outcome screen.** After a call the app shows a dismissible summary ("Connected · Talk time
   1 min 20 s · Ringing 12 s · Total 1 min 32 s", or "Not answered · Rang for 31 s"). Calls not
   yet in Compass show as a strip with Retry / Discard instead of a separate "Waiting to send"
   screen.
5. **WhatsApp button** next to every Call button: opens `https://wa.me/<number>`, a chat with the
   client. Nothing is logged for it.
6. **No stage or task changes in the app** (2026-11-06). Agents change stage, record outcomes and
   complete tasks only on the Compass website, on desktop. The app shows stages and tasks but has
   no Change Stage and no Mark as completed; it never calls `POST /opportunities/:id/stage` or
   `POST /tasks/:id/update`. The app's job is to call, log the call, and open WhatsApp: its only
   write to Compass is the Manual Outbound Call activity (ADR 0005).

## Consequences

- **Google Play:** `READ_CALL_LOG` is kept. Google allows it only for default dialer apps or
  approved exceptions, declared in the Play Console permissions declaration. We try **Play Console
  internal testing** first; if Google rejects the declaration, we fall back to installing the APK
  directly (EAS internal distribution). CI requires the permission and still refuses write access
  to the call log, contacts and outgoing-call interception.
- A task (e.g. First Call) stays on the agent's lists in the app until it is completed on the
  website.
- Agents are asked for a third Android permission ("Call logs"). If they refuse, calls still work
  and are logged with the total only.
- Compass needs the extra keys in the `manual_outbound_call` attributes template if they should
  appear in its activity details by name (keys beyond the template are stored anyway, per ADR 0005).

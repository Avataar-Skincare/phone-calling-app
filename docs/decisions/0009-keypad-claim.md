# 0009: Keypad dialing claims the lead before it dials

- **Status:** Accepted
- **Date:** 2026-11-13
- **Builds on:** [0005](0005-log-calls-as-manual-outbound-call.md), [0006](0006-call-times-and-whatsapp.md), [0007](0007-call-recording-upload.md)
- **Amends:** the statements in 0005–0007 about which writes the app makes to Compass. This is a third.
- **Number:** the task brief called this 0008, but [0008](0008-call-log-access-required.md) was already taken.

## Context

Management sends callers phone numbers on WhatsApp. Today the agent has to find the lead in Compass,
get it assigned, and only then call it from the app. The call should be the trigger: whoever dials
the number takes the lead.

## Decision

1. **A Keypad screen** (home header button). The agent pastes (long-press → Paste in the field) or
   types a number, or uses the on-screen pad, and taps **Call**.
2. **Claim first.** The app sends `POST /mobile-dialer/claim` with the number as typed (Compass
   strips spaces, dashes and +91). Compass moves the number's Sales opportunity to the caller
   ("Owner changed due to manual dialing"), creates a lead owned by the caller when the number is
   unknown, or changes nothing (`already_owner`, `no_opportunity`, `not_sales`). The app waits for
   the reply for **3 seconds at most**.
3. **Always dial.** Whatever the claim does (error, timeout, `not_sales`, `no_opportunity`), the call
   goes through the normal flow (`useCallLead`). The claim's `opportunity_id` and `lead_id` are put
   on the call session when Compass returns them, so the call is logged on that opportunity
   ("Manual Outbound Call", ADR 0005) and recording upload (ADR 0007) work as for list calls.
4. **Sales only is enforced by Compass**, not the app. A non-Sales caller gets `not_sales` and
   nothing moves.
5. **The agent is told what happened** in an inline message that stays on the screen after the call.
6. **List calls don't claim.** Only the Keypad does; the lead is already the agent's there.

## Consequences

- Third write to Compass besides the call log and recording upload.
- A claim that finishes after the 3 s cap still takes effect on Compass, while the app has already
  shown "Couldn't reach Compass — lead not moved". Rare; the lead is then the caller's anyway.
- The call is logged without an opportunity when the claim failed; Compass then matches the phone
  number as for any call.
- JavaScript only: no native change, no new permission.

# 0001: Calls go out on the agent's own SIM

- **Status:** Accepted
- **Date:** 2026-11-04 (confirmed 2026-11-05: agents use their own numbers)

## Context

Agents need to call Compass leads from a phone. Three options were considered:

- **A. The phone's own SIM.** The app starts an ordinary mobile call.
- **B. Skytel call-back.** The in-house FreeSWITCH dialer rings the agent's mobile, then bridges the
  customer, keeping company caller ID and recording.
- **C. In-app VoIP.** A SIP softphone inside the app.

B and C need backend changes (call-origination changes in Skytel, authentication on its APIs, push
notifications) and C needs TURN servers and CallKit / ConnectionService work.

## Decision

Option A. Calls use the agent's own SIM and number.

## Consequences

- No backend change is needed to place calls; the app ships faster.
- Customers see the agent's number. There is no recording or AI quality analysis for app calls.
- Android can dial instantly; iOS always shows a system "Call" prompt.
- Android can't tell whether a call was answered; the agent records it in the outcome sheet.
- Agents who use the app must have their Compass `telephony_extension` cleared, or Skytel will
  also dial their leads (Compass only pushes tasks to Skytel for agents with an extension).
- `placeCall` sits behind one function (`src/features/calling/callFlow.ts`), so option B can
  replace it later without changing screens.

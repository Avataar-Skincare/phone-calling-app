# 0002: Save outcomes through Compass's activity form

- **Status:** Accepted
- **Date:** 2026-11-04

## Context

After each call the outcome has to reach Compass: stage, notes, next follow-up, and the call
itself. Compass already has a JWT-protected form that agents use on the web after a call:
`GET/POST /opportunities/:id/activity-form`. Skytel's call log endpoint
(`/external-calls/activities/log-call`) is unauthenticated and built for the dialer.

## Decision

The app saves outcomes through `POST /opportunities/:id/activity-form`, building its form from
`GET /opportunities/:id/activity-form/config`. Call details (start, end, duration, answered, SIM,
`call_source: mobile_app`) travel as extra keys in `sub_form_data`, which Compass stores on the
activity, or in `concerns_raised` for stages that log no activity.

## Consequences

- No Compass change for v1. The app's form always matches the web's, because both read the same
  config.
- Stage changes, follow-up tasks, closing older tasks and Journey triggers behave exactly as on the
  web.
- The form doesn't emit `activity.logged`, so the call counter and the "we tried to reach you"
  WhatsApp don't fire for app calls. A JWT-protected call-log endpoint in Compass would add them;
  that's a later, backend change.

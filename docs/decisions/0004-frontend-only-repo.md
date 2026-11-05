# 0004: Frontend-only repo; Compass stays the only backend

- **Status:** Accepted
- **Date:** 2026-11-05

## Context

The app reads and writes the same leads, tasks and activities as the Compass web app. A separate
backend would duplicate data and rules (ownership, stages, task automation) that Compass already
owns.

## Decision

This repo contains only the mobile app. It talks directly to the Compass API. Any backend change
the app needs (for example a call-log endpoint) is made in `leadsquared-avataar-server`.

## Consequences

- One source of truth; the web and the app always agree.
- App and backend release independently.
- Backend changes are planned with the Compass backend owners; the app never works around a missing
  endpoint with its own server.

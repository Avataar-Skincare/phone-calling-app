# Compass API

Backend: `Avataar-Skincare/leadsquared-avataar-server` (NestJS). All routes are under `/api`.

| Environment | Base URL                              |
| ----------- | ------------------------------------- |
| All builds  | `https://compass.avataarskin.com/api` |

## Conventions

- Success bodies are **plain JSON** (no `{ success, data }` envelope).
- Errors are NestJS bodies: `{ statusCode, message, error }`, where `message` is a string or a list
  of validation messages. `src/api/client.ts` turns them into `ApiError(status, message)`.
- Every endpoint except login needs `Authorization: Bearer <token>`.
- Compass applies its own scope rules: agents see and change only opportunities they own; team leads
  see their team; supervisors and administrators see everything. A lead that was reassigned returns
  **403**.
- The call log's `call_*_at` times are sent as IST `2026-11-06 18:21:50` (date, space, time to the
  second): Compass's format for activity times, and readable in its activity details, which show
  the raw value.

v1 of the app needs **no Compass changes**. Every endpoint below already exists.

## Login

| Endpoint                | Body              | Returns           | Notes                                                                                                    |
| ----------------------- | ----------------- | ----------------- | -------------------------------------------------------------------------------------------------------- |
| `POST /auth/send-otp`   | `{ phoneNumber }` | `{ token }`       | 10-digit number of an existing Compass user, else **404**. 4-digit code by SMS and WhatsApp, valid 5 min |
| `POST /auth/verify-otp` | `{ token, otp }`  | `{ token, user }` | JWT valid 15 h, no refresh endpoint. **400** for a wrong or expired code                                 |

`user`: `{ id, name, email, phone, role, teamId, departmentId, telephonyExtension }`.
`role` is one of `administrator`, `supervisor`, `tl`, `agent`.

## Lead lists (Smart Views)

The home screen is Compass's Smart Views page: Sales / Customer Support tabs (shown to everyone,
Sales first, like the web), the 14 view tabs, and each view's own filters, defaults and sort.
Per-view rules live in `src/features/leads/viewConfig.ts` (tested in `viewConfig.test.ts`).

| Endpoint                                          | Used for                                                                             |
| ------------------------------------------------- | ------------------------------------------------------------------------------------ |
| `GET /opportunities/departments`                  | `[{ id, code, label }]`, maps `user.departmentId` to a code                          |
| `GET /smart-views/definitions`                    | `[{ key, label, department: "sales" or "cs", type: "lead" or "task", description }]` |
| `GET /smart-views/counts?department=sales`        | `{ [viewKey]: total }` (tab counts; slow, never retried)                             |
| `GET /smart-views/data?view=&page=&limit=&…`      | `{ data: Row[], meta: { total, page, limit, total_pages } }`                         |
| `GET /smart-views/opportunity-stages?department=` | Stage filter options                                                                 |
| `GET /settings/sources/dropdown`                  | Source filter options                                                                |
| `GET /agents/dropdown`                            | Owner filter options (hidden for agents; team leads see their team)                  |

`/smart-views/data` filter parameters, sent only when set (exactly as the web sends them):
`search`, `owner`, `sort_by`, `sort_order`, `stage` / `stages`, `source`, `date_type`, `schedule`
(`today`, `this_week`, …, `custom` with `date_from` / `date_to` as ISO UTC), `status`, `task_type`,
`activity_codes`. Page size 20 / 50 / 100 (Compass's "Rows per page").

Row shapes differ by view type. `src/features/leads/leadItem.ts` maps them all to `LeadItem`.

- **Lead views** (`hot_leads`, `warm_leads`, `important_customers`, …): lead `id`, names,
  `primary_phone`, `lead_source`, `lead_score`, `opportunity_id`, `opportunity_stage`, `owner`,
  `created_at`, `updated_at`, `last_important_activity`.
- **Task views** (`first_call_tasks`, `hot_and_warm_tasks`, …): task `id`, `title`, `due_at`,
  `task_type`, `status`, `created_by`, `assigned_to`, nested `lead { … primary_phone }`,
  `opportunity_id`, `opportunity_stage`, `department`.

## Opportunity page

Tapping a lead shows Compass's opportunity
page: header, profile panel (Call, WhatsApp, four tiles, Properties) and seven tabs. The page is
read-only: stages, outcomes and tasks are changed on the Compass website only (ADR 0006). The app's
only writes to Compass are the call log and the recording upload below. Each card
and tab loads from its own endpoint, as on the web.

| Endpoint                                                                    | Where                                                |
| --------------------------------------------------------------------------- | ---------------------------------------------------- |
| `GET /opportunities/:id`                                                    | Header, profile, Properties, Stage History, stages   |
| `GET /opportunities/:id/lead-sources`                                       | Overview · Lead Sources                              |
| `GET /opportunities/:id/sales-overview`                                     | Overview · Last Add to Cart, Haut AI, Photos (Sales) |
| `GET /opportunities/:id/cs-overview`                                        | Overview · Basic Info, Complaint Status (CS)         |
| `GET /opportunities/:id/recent-whatsapp`                                    | Overview · WhatsApp                                  |
| `GET /leads/:leadId/virtual-consultations`                                  | Overview · Virtual Consultation                      |
| `GET /leads/:leadId/package-details`                                        | Overview · Packages                                  |
| `GET /leads/:leadId/recent-service`                                         | Overview · Recent Service                            |
| `GET /leads/:leadId/latest-sessions`                                        | Overview · Latest Sessions                           |
| `GET /leads/:leadId`                                                        | Activities tab (all departments)                     |
| `GET /tasks?opportunity_id=&status=&sort_by=due_at&sort_order=ASC&limit=50` | Tasks tab                                            |
| `GET /ameyo/opportunities/:id/calls?page=&limit=`                           | Calls tab (20 a page) and Overview call card (3)     |
| `GET /leads/:leadId/purchase-history`                                       | Purchase History tab                                 |
| `GET /leads/:leadId/appointments?page=&limit=10`                            | Appointments tab                                     |

`lead.phone` on the opportunity is the first stored number, not necessarily the primary one, so
the app prefers the `primary_phone` it already has from the list row. Call recordings open in the
browser (`recording_url` is relative to the Compass host).

Not in the app yet (Compass web only): Create Task, Activity Form, Book
Appointment, WhatsApp chat, Assign Owner, Edit Name, AI call analysis, in-app recording playback.

## After a call: Manual Outbound Call

`POST /activities/log` with the agent's token ([ADR 0005](decisions/0005-log-calls-as-manual-outbound-call.md),
[0006](decisions/0006-call-times-and-whatsapp.md)); body built by `src/lib/callLog.ts`:

```json
{
  "phone": "9876500001",
  "activity_type": "manual_outbound_call",
  "opportunity_id": "7001",
  "occurred_at": "2026-11-06T10:16:32.000Z",
  "data": {
    "agent_user_id": "31",
    "agent_name": "Test Agent",
    "call_tapped_at": "2026-11-06 15:45:00",
    "call_started_at": "2026-11-06 15:45:01",
    "call_ended_at": "2026-11-06 15:46:32",
    "call_duration_seconds": 91,
    "call_talk_seconds": 80,
    "call_ring_seconds": 11,
    "call_answered": "yes",
    "call_end_estimated": "no",
    "call_platform": "android",
    "call_source": "mobile_app",
    "app_session_id": "mw4rlagj-53mkq6"
  }
}
```

`occurred_at` is the call's end time. Compass uses it as the activity time when it is at most 2
days old and not in the future, otherwise its own clock, so a call queued offline still shows at the
time it happened (Compass `feat/activity-log-occurred-at`). **Compass must be deployed with that
change before an app build sends this field**: older Compass rejects unknown fields with a 400.

Replies **200 even on failure**: `{ "activity_id": null, "message": "<reason>" }`. Success has a
non-null `activity_id`. The `manual_outbound_call` activity type must exist in each Compass
(Settings → Activity Types, see ADR 0005). `/opportunities/:id/activity-form` is no longer used.

## Call recording upload

[ADR 0007](decisions/0007-call-recording-upload.md); `src/api/recordings.ts`,
`src/features/recordings/uploadRecording.ts`. `:activityId` is the `activity_id` of the call's log.
All with the agent's token except step 2.

1. `POST /mobile-dialer/recordings/:activityId/upload-url`, body
   `{ "content_type": "audio/mp4", "size_bytes": 2100000 }` replies
   `{ "upload_url": "<presigned S3 URL>", "method": "PUT", "headers": { "Content-Type": "audio/mp4" }, "key": "recordings/manual/8001.m4a", "expires_at": "<ISO>" }`.
   Rules: the agent's own `manual_outbound_call`, at most 7 days old; audio only (`audio/mp4`,
   `m4a`, `x-m4a`, `aac`, `mpeg`, `mp3`, `wav`, `x-wav`, `wave`, `amr`, `3gpp`, `ogg`, `opus`,
   `webm`); 1 byte to 25 MB (26,214,400).
   Errors are NestJS `{ statusCode, message: { code, message } | string }`: 400 `UNSUPPORTED_TYPE`,
   `BAD_SIZE`, `NOT_AN_APP_CALL`, `TOO_OLD`; 403 `NOT_YOUR_CALL`; 404 `CALL_NOT_FOUND`. The app shows
   the server's `message` text.
2. `PUT <upload_url>` straight to S3 from native code: the raw file bytes, exactly
   `Content-Type: <headers["Content-Type"]>` and `Content-Length: <size_bytes>` (both are signed),
   **no Authorization header**. The link is valid 10 minutes. A non-2xx is shown as "Upload refused
   by storage (403)".
3. `POST /mobile-dialer/recordings/:activityId/complete`, body `{ "key": "<key from step 1>" }`
   replies `{ "recording_url": "...", "size_bytes": 2100000 }`. 400 `NOT_UPLOADED` (S3 doesn't have
   the file yet), `KEY_MISMATCH`.

# Compass API

Backend: `Avataar-Skincare/leadsquared-avataar-server` (NestJS). All routes are under `/api`.

| Environment | Base URL                                 |
| ----------- | ---------------------------------------- |
| Testing     | `https://test-leads.avataarskin.com/api` |
| Production  | `https://compass.avataarskin.com/api`    |

## Conventions

- Success bodies are **plain JSON** (no `{ success, data }` envelope).
- Errors are NestJS bodies: `{ statusCode, message, error }`, where `message` is a string or a list
  of validation messages. `src/api/client.ts` turns them into `ApiError(status, message)`.
- Every endpoint except login needs `Authorization: Bearer <token>`.
- Compass applies its own scope rules: agents see and change only opportunities they own; team leads
  see their team; supervisors and administrators see everything. A lead that was reassigned returns
  **403**.
- Dates are ISO 8601. The web form sends follow-up times as UTC (`Date.toISOString()`); the app
  does the same.

v1 of the app needs **no Compass changes**. Every endpoint below already exists.

## Login

| Endpoint                | Body              | Returns           | Notes                                                                                                    |
| ----------------------- | ----------------- | ----------------- | -------------------------------------------------------------------------------------------------------- |
| `POST /auth/send-otp`   | `{ phoneNumber }` | `{ token }`       | 10-digit number of an existing Compass user, else **404**. 4-digit code by SMS and WhatsApp, valid 5 min |
| `POST /auth/verify-otp` | `{ token, otp }`  | `{ token, user }` | JWT valid 15 h, no refresh endpoint. **400** for a wrong or expired code                                 |

`user`: `{ id, name, email, phone, role, teamId, departmentId, telephonyExtension }`.
`role` is one of `administrator`, `supervisor`, `tl`, `agent`.

## Lead lists (Smart Views)

| Endpoint                                           | Returns                                                                              |
| -------------------------------------------------- | ------------------------------------------------------------------------------------ |
| `GET /smart-views/definitions`                     | `[{ key, label, department: "sales" or "cs", type: "lead" or "task", description }]` |
| `GET /smart-views/counts?department=sales`         | `{ [viewKey]: total }`                                                               |
| `GET /smart-views/data?view=&page=&limit=&search=` | `{ data: Row[], meta: { total, page, limit, total_pages } }`                         |
| `GET /opportunities/departments`                   | `[{ id, code, label }]`, used to map `user.departmentId` to a code                   |

Row shapes differ by view type. `src/features/leads/leadItem.ts` maps both to `LeadItem`.

- **Lead views** (`hot_leads`, `warm_leads`, `important_customers`, …): lead `id`, names,
  `primary_phone`, `lead_source`, `opportunity_id`, `opportunity_stage`, `owner`.
- **Task views** (`first_call_tasks`, `hot_and_warm_tasks`, …): task `id`, `due_at`, `task_type`,
  `status`, nested `lead { id, first_name, last_name, primary_phone }`, `opportunity_id`,
  `opportunity_stage`, `department`.

## Lead screen

`GET /opportunities/:id` returns the lead, stage, owner, department, available stages and the
latest **50** activities. `lead.phone` is the first stored number, not necessarily the primary
one, so the app prefers the `primary_phone` it already has from the list row.

## Saving a call outcome

### `GET /opportunities/:id/activity-form/config`

```jsonc
{
  "opportunity_id": "77120",
  "department_code": "sales",
  "current_stage_code": "new_lead",
  "lead_data": { "lead_id": "48213", "first_name": "Priya", "phone_number": "98XXXXX214", "…": "…" },
  "available_stages": [
    { "id": "1", "code": "new_lead", "label": "New Lead", "stage_type": "active", "sort_order": 10 },
  ],
  "form_configs": {
    "not_connected": {
      "sub_form_name": "Phone Call Not Connected",
      "activity_type_code": "phone_call_not_connected",
      "top_level_fields": [],
      "sub_form_fields": [
        {
          "key": "select_outcome",
          "label": "Select Outcome",
          "type": "dropdown",
          "required": true,
          "options": [
            "Busy",
            "No Answer",
            "Not Reachable",
            "Switched Off",
            "Wrong Number",
            "Call Back Later",
            "Not Interested",
          ],
        },
        {
          "key": "next_follow_up_datetime",
          "label": "Next Follow Up",
          "type": "datetime",
          "required": true,
          "options": null,
        },
        { "key": "notes", "label": "Notes", "type": "text", "required": true, "options": null },
      ],
    },
  },
}
```

Field `type` is one of `text`, `number`, `datetime`, `dropdown`. Stages with no form have
`activity_type_code: null` and no fields.

### `POST /opportunities/:id/activity-form`

```jsonc
{
  "stage_code": "not_connected",
  "submitted_by_user_id": "31",
  "concerns_raised": "optional free text",
  "top_level_data": {},
  "sub_form_data": {
    "select_outcome": "No Answer",
    "next_follow_up_datetime": "2026-11-09T11:00:00.000Z",
    "notes": "…",
  },
}
```

What Compass does, in one transaction:

1. Validates required fields and dropdown values for that stage. **Extra keys are stored** on the
   activity unchanged (the app adds call details this way).
2. Moves the opportunity to `stage_code` if it changed; `concerns_raised` becomes the stage-change
   reason. Fires `opportunity.stage.changed` (Journeys, Meta events, closing the First Call task).
3. Logs the stage's activity (`phone_call_connected`, `phone_call_not_connected`, …) when the stage
   has an `activity_type_code`.
4. Creates a Follow Up task from the `datetime` field the server marks `creates_task`. The new task
   closes older pending tasks on that opportunity.

Two consequences for the app:

- A stage **without** an activity type logs no call activity, so call details go into
  `concerns_raised` instead.
- Re-selecting the **current** stage when it has no form records nothing at all. The app blocks it.

### Not available in v1

The form does **not** emit `activity.logged`, so the call counter and the "we tried to reach you"
WhatsApp (both listen for that event) don't fire for app calls. Bringing them in needs a
JWT-protected call-log endpoint in Compass. See [ADR 0002](decisions/0002-save-outcomes-through-activity-form.md).

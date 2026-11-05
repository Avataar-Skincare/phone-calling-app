/// <reference types="jest" />
/// <reference types="node" />
/**
 * Fake Compass API for unit and integration tests.
 *
 * Install with `fakeCompass()`. Routes answer from the fixtures below (shapes copied from real
 * Compass testing responses, names and numbers made up). Every request is recorded so tests can
 * assert exactly what the app sent. Override any route per test with `server.on(...)`.
 */
import type { ActivityFormConfig, OpportunityDetail, SmartViewDef, VerifyOtpResponse } from "@/types/compass";

export const API = "https://test-leads.avataarskin.com/api";

// ── Fixtures ────────────────────────────────────────────────

export const agent: VerifyOtpResponse["user"] = {
  id: "31",
  name: "Test Agent",
  email: null,
  phone: "9000000001",
  role: "agent",
  teamId: null,
  departmentId: "1",
  telephonyExtension: null,
};

/** Unsigned JWT whose payload expires far in the future. */
export const jwt = (exp = 4_102_444_800) =>
  `eyJhbGciOiJIUzI1NiJ9.${Buffer.from(JSON.stringify({ sub: "31", exp })).toString("base64url")}.sig`;

export const departments = [
  { id: "1", code: "sales", label: "Sales" },
  { id: "2", code: "cs", label: "Customer Support" },
  { id: "3", code: "central", label: "Central" },
];

export const definitions: SmartViewDef[] = [
  { key: "first_call_tasks", label: "First Call", department: "sales", type: "task" },
  { key: "hot_leads", label: "Hot Leads", department: "sales", type: "lead" },
  { key: "complaint_open", label: "Complaint open", department: "cs", type: "lead" },
];

export const firstCallRows = [
  {
    id: 9001,
    title: "First call",
    status: "pending",
    due_at: "2020-01-01T05:30:00.000Z",
    task_type: { code: "first_call", label: "First Call" },
    lead: { id: 501, first_name: "Asha", last_name: "Rao", primary_phone: "9876500001" },
    assigned_to: { id: 31, name: "Test Agent", extension: null },
    opportunity_id: 7001,
    opportunity_stage: { code: "new_lead", label: "New Lead" },
    department: { code: "sales", label: "Sales" },
  },
  {
    id: 9002,
    title: "First call",
    status: "pending",
    due_at: "2099-01-01T05:30:00.000Z",
    task_type: { code: "first_call", label: "First Call" },
    lead: { id: 502, first_name: "Kiran", last_name: null, primary_phone: null },
    assigned_to: { id: 31, name: "Test Agent", extension: null },
    opportunity_id: 7002,
    opportunity_stage: { code: "new_lead", label: "New Lead" },
    department: { code: "sales", label: "Sales" },
  },
];

export const hotLeadRows = [
  {
    id: 503,
    first_name: "Meera",
    last_name: "Iyer",
    primary_phone: "9876500003",
    lead_source: "facebook_lead_ads",
    opportunity_id: 7003,
    opportunity_stage: { code: "hot_in_consideration", label: "Hot - In Consideration" },
    owner: { id: 31, name: "Test Agent" },
  },
];

export const opportunity = (id = "7001"): OpportunityDetail => ({
  id,
  opportunity_name: null,
  department: { id: "1", code: "sales", label: "Sales" },
  stage: { id: "1", code: "new_lead", label: "New Lead", stage_type: "active" },
  owner: { id: "31", name: "Test Agent" },
  lead: {
    id: "501",
    first_name: "Asha",
    last_name: "Rao",
    email: null,
    city: "Pune",
    lead_score: 40,
    lead_source: "facebook_lead_ads",
    phone: "9876500001",
  },
  created_at: "2026-11-01T05:30:00.000Z",
  updated_at: "2026-11-01T05:30:00.000Z",
  activities: [
    {
      id: "1",
      type: { code: "lead_capture", label: "Lead Capture" },
      title: null,
      score: 0,
      data: null,
      added_by_type: "system",
      added_by: null,
      occurred_at: "2026-11-01T05:30:00.000Z",
      created_at: "2026-11-01T05:30:00.000Z",
    },
  ],
  total_activities: 1,
});

export const formConfig = (opportunityId = "7001"): ActivityFormConfig => ({
  opportunity_id: opportunityId,
  opportunity_name: null,
  department_code: "sales",
  department_label: "Sales",
  current_stage_code: "new_lead",
  lead_data: {
    lead_id: "501",
    first_name: "Asha",
    email: null,
    phone_number: "9876500001",
    whatsapp_number: null,
    gender: null,
    city: null,
  },
  available_stages: [
    { id: "1", code: "new_lead", label: "New Lead", stage_type: "active", sort_order: 10 },
    { id: "2", code: "not_connected", label: "Not Connected", stage_type: "active", sort_order: 20 },
    { id: "9", code: "not_interested", label: "Not Interested", stage_type: "inactive", sort_order: 90 },
  ],
  form_configs: {
    new_lead: { sub_form_name: null, activity_type_code: null, top_level_fields: [], sub_form_fields: [] },
    not_connected: {
      sub_form_name: "Phone Call Not Connected",
      activity_type_code: "phone_call_not_connected",
      top_level_fields: [],
      sub_form_fields: [
        {
          key: "select_outcome",
          label: "Select Outcome",
          type: "dropdown",
          required: true,
          options: ["Busy", "No Answer"],
        },
        {
          key: "next_follow_up_datetime",
          label: "Next Follow Up",
          type: "datetime",
          required: true,
          options: null,
        },
        { key: "notes", label: "Notes", type: "text", required: true, options: null },
      ],
    },
    not_interested: {
      sub_form_name: null,
      activity_type_code: null,
      top_level_fields: [],
      sub_form_fields: [],
    },
  },
});

// ── Fake server ─────────────────────────────────────────────

export interface RecordedRequest {
  method: string;
  path: string;
  query: Record<string, string>;
  body: unknown;
  headers: Record<string, string>;
}

type Reply = { status?: number; body?: unknown } | "network-error";
type Handler = (req: RecordedRequest) => Reply | Promise<Reply>;

export function fakeCompass() {
  const routes = new Map<string, Handler>();
  const requests: RecordedRequest[] = [];
  const key = (method: string, path: string) => `${method} ${path}`;

  const on = (method: string, path: string | RegExp, handler: Handler | Reply) => {
    const h: Handler = typeof handler === "function" ? handler : () => handler;
    routes.set(key(method, path instanceof RegExp ? `re:${path.source}` : path), h);
  };

  // Defaults: a logged-in Sales agent with two tabs of work.
  on("POST", "/auth/send-otp", { body: { token: "otp-token" } });
  on("POST", "/auth/verify-otp", (req) =>
    (req.body as { otp?: string }).otp === "1234"
      ? { body: { token: jwt(), user: agent } }
      : { status: 400, body: { statusCode: 400, message: "Invalid OTP" } },
  );
  on("GET", "/opportunities/departments", { body: departments });
  on("GET", "/smart-views/definitions", { body: definitions });
  on("GET", "/smart-views/counts", { body: { first_call_tasks: 2, hot_leads: 1 } });
  on("GET", "/smart-views/data", (req) => {
    const rows = req.query.view === "hot_leads" ? hotLeadRows : firstCallRows;
    return { body: { data: rows, meta: { total: rows.length, page: 1, limit: 25, total_pages: 1 } } };
  });
  on("GET", /^\/opportunities\/\d+$/, (req) => ({ body: opportunity(req.path.split("/").pop()) }));
  on("GET", /^\/opportunities\/\d+\/activity-form\/config$/, (req) => ({
    body: formConfig(req.path.split("/")[2]),
  }));
  on("POST", /^\/opportunities\/\d+\/activity-form$/, { status: 201, body: { success: true } });

  const fetchMock = jest.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = new URL(String(input));
    const path = url.pathname.replace(/^\/api/, "");
    const req: RecordedRequest = {
      method: (init?.method ?? "GET").toUpperCase(),
      path,
      query: Object.fromEntries(url.searchParams),
      body: init?.body ? JSON.parse(String(init.body)) : undefined,
      headers: (init?.headers ?? {}) as Record<string, string>,
    };
    requests.push(req);

    let handler = routes.get(key(req.method, path));
    if (!handler) {
      for (const [k, h] of routes) {
        const [m, p] = [k.slice(0, k.indexOf(" ")), k.slice(k.indexOf(" ") + 1)];
        if (m === req.method && p.startsWith("re:") && new RegExp(p.slice(3)).test(path)) handler = h;
      }
    }
    if (!handler) throw new Error(`fakeCompass: no route for ${req.method} ${path}`);

    const reply = await handler(req);
    if (reply === "network-error") throw new TypeError("Network request failed");
    const status = reply.status ?? 200;
    const text = reply.body === undefined ? "" : JSON.stringify(reply.body);
    return {
      ok: status >= 200 && status < 300,
      status,
      text: async () => text,
    } as unknown as Response;
  });

  global.fetch = fetchMock as unknown as typeof fetch;

  return {
    on,
    requests,
    fetch: fetchMock,
    /** Requests matching a method and path (exact string or regex). */
    find: (method: string, path: string | RegExp) =>
      requests.filter(
        (r) => r.method === method && (typeof path === "string" ? r.path === path : path.test(r.path)),
      ),
  };
}

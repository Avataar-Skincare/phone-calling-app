/**
 * Smart View configuration, mirroring Compass web (leadsquared-avataar-client
 * src/features/smart-views/views/*.tsx). One entry per view: which filters it shows, their
 * defaults (some depend on the user's role), how it sorts, and how its rows are drawn.
 *
 * Pure data and functions, covered by viewConfig.test.ts. Keep in step with Compass when a view
 * changes there.
 */
import type { CompassRole, DepartmentCode } from "@/types/compass";

export type FilterControl =
  | "search"
  | "stages" // multi-select stage (post_vc_weight_loss)
  | "stage" // single stage
  | "source"
  | "owner"
  | "dateType"
  | "schedule"
  | "taskType"
  | "status"
  | "activities"; // important_customers activity codes

export type RowKind = "opportunity" | "task" | "important" | "csMissed";

/** Where a single/multi stage filter gets its options. */
export type StageOptions =
  | { from: "department"; department: DepartmentCode } // /smart-views/opportunity-stages?department=
  | { from: "active" } // /smart-views/opportunity-stages (all active stages)
  | { from: "fixed"; options: Option[] };

export interface Option {
  value: string;
  label: string;
}

export interface SortField {
  value: string;
  label: string;
}

export interface ViewConfig {
  key: string;
  kind: RowKind;
  controls: FilterControl[];
  stageOptions?: StageOptions;
  /** Only options matching this are offered in the source filter (landing_page_leads). */
  sourceFilter?: RegExp;
  sortFields: SortField[];
  defaultSortBy: string;
  defaultSortOrder: "ASC" | "DESC";
  defaults: (role: CompassRole) => Partial<Filters>;
  /** Send date_type only when it differs from the server default (hot/warm views). */
  dateTypeOnlyWhenNotDefault?: boolean;
}

/** Everything a view's filter bar can set. Empty string = not set. */
export interface Filters {
  search: string;
  stages: string[];
  stage: string;
  source: string;
  owner: string;
  dateType: string;
  schedule: string;
  dateFrom: string; // YYYY-MM-DD, only with schedule=custom
  dateTo: string;
  taskType: string;
  status: string;
  activities: string[];
  sortBy: string;
  sortOrder: "ASC" | "DESC" | "";
}

export const EMPTY_FILTERS: Filters = {
  search: "",
  stages: [],
  stage: "",
  source: "",
  owner: "",
  dateType: "",
  schedule: "",
  dateFrom: "",
  dateTo: "",
  taskType: "",
  status: "",
  activities: [],
  sortBy: "",
  sortOrder: "",
};

// ── Option lists (same strings as Compass) ─────────────────

export const DATE_TYPE_OPTIONS: Option[] = [
  { value: "last_activity", label: "Last Activity" },
  { value: "created_on", label: "Created On" },
  { value: "modified_on", label: "Modified On" },
  { value: "last_call", label: "Last Connected Call" },
];

export const SCHEDULE_OPTIONS: Option[] = [
  { value: "all_time", label: "All Time" },
  { value: "yesterday", label: "Yesterday" },
  { value: "today", label: "Today" },
  { value: "tomorrow", label: "Tomorrow" },
  { value: "last_7_days", label: "Last 7 Days" },
  { value: "last_30_days", label: "Last 30 Days" },
  { value: "last_week", label: "Last Week" },
  { value: "this_week", label: "This Week" },
  { value: "next_week", label: "Next Week" },
  { value: "last_month", label: "Last Month" },
];

export const STATUS_OPTIONS: Option[] = [
  { value: "pending_and_overdue", label: "Pending and Overdue" },
  { value: "pending", label: "Pending" },
  { value: "overdue", label: "Overdue" },
  { value: "completed", label: "Completed" },
  { value: "all", label: "All" },
];

export const ACTIVITY_OPTIONS: Option[] = [
  { value: "add_to_cart", label: "Add to Cart" },
  { value: "haut_ai_score", label: "AI Skin Analysis" },
  { value: "doctor_consultation", label: "VC Done" },
  { value: "whatsapp_inbound", label: "Inbound WhatsApp" },
];

/** Compass has no task-type endpoint; this is its hard-coded list (services/tasks.api.ts). */
export const TASK_TYPE_OPTIONS: Option[] = [
  { value: "all", label: "All Task Types" },
  { value: "follow_up", label: "Follow Up" },
  { value: "virtual_consultation", label: "Virtual Consultation" },
  { value: "first_call", label: "First Call" },
  { value: "schedule_service", label: "Schedule Service" },
  { value: "balance_payment", label: "Balance Payment" },
  { value: "resolved_complaint", label: "Resolved Complaint" },
  { value: "follow_up_vc", label: "Follow up for Virtual Consultation" },
  { value: "follow_up_re_created", label: "Follow up (re-created)" },
  { value: "follow_up_whatsapp", label: "Follow Up (Whatsapp)" },
  { value: "follow_up_ai_test", label: "Follow Up - AI Test" },
  { value: "follow_up_chatbot", label: "Follow_up_Chatbot" },
  { value: "first_call_chatbot", label: "First_call_Chatbot" },
  { value: "first_call_chatbot_callback", label: "First Call - Chatbot Callback" },
  { value: "follow_up_priority", label: "Follow up (priority)" },
  { value: "follow_up_on_time", label: "Follow up (on time)" },
  { value: "slot_booking", label: "Slot booking" },
  { value: "package_change", label: "Package change" },
  { value: "refund_required", label: "Refund required" },
  { value: "therapist_complaint", label: "Therapist complaint" },
  { value: "ops_complaint", label: "Ops complaint" },
  { value: "callback", label: "Callback" },
  { value: "payment_link", label: "Payment link" },
  { value: "other", label: "Other" },
];

const HOT_STAGES: Option[] = [
  { value: "hot_in_consideration", label: "Hot - In Consideration" },
  { value: "hot_appt_scheduled_not_paid", label: "Hot - Appt Scheduled Not Paid" },
];
const WARM_STAGES: Option[] = [
  { value: "warm_consultation_pending", label: "Warm - Consultation Pending" },
  { value: "warm_consultation_done", label: "Warm - Consultation Done" },
];

export const POST_VC_DEFAULT_STAGES = ["warm_consultation_done", "hot_in_consideration"];

// ── Sort fields ─────────────────────────────────────────────

const OPP_SORTS: SortField[] = [
  { value: "updated_at", label: "Modified On" },
  { value: "created_at", label: "Created On" },
  { value: "lead_score", label: "Lead Score" },
  { value: "first_name", label: "Lead Name" },
];
const TASK_SORTS: SortField[] = [{ value: "due_at", label: "Due Date" }];

// ── Views ──────────────────────────────────────────────────

const LEAD_BAR: FilterControl[] = ["search", "stage", "source", "owner", "dateType", "schedule"];
const INBOUND_BAR: FilterControl[] = ["stage", "owner", "schedule"];
const TASK_BAR: FilterControl[] = ["search", "taskType", "status", "owner", "schedule"];
/** Agents filter on Created On by default; everyone else on Last Activity. */
const agentCreatedElseActivity = (role: CompassRole) => (role === "agent" ? "created_on" : "last_activity");

const opp = (over: Partial<ViewConfig> & Pick<ViewConfig, "key" | "controls" | "defaults">): ViewConfig => ({
  kind: "opportunity",
  sortFields: OPP_SORTS,
  defaultSortBy: "updated_at",
  defaultSortOrder: "DESC",
  ...over,
});

const task = (key: string, controls: FilterControl[], schedule: string): ViewConfig => ({
  key,
  kind: "task",
  controls,
  sortFields: TASK_SORTS,
  defaultSortBy: "due_at",
  defaultSortOrder: "ASC",
  defaults: () => ({ status: "pending_and_overdue", schedule }),
});

export const VIEW_CONFIGS: Record<string, ViewConfig> = {
  post_vc_weight_loss: opp({
    key: "post_vc_weight_loss",
    controls: ["search", "stages", "source", "owner", "dateType", "schedule"],
    stageOptions: { from: "department", department: "sales" },
    defaults: () => ({ stages: POST_VC_DEFAULT_STAGES, dateType: "created_on", schedule: "today" }),
  }),
  important_customers: {
    key: "important_customers",
    kind: "important",
    controls: ["activities", "stage", "owner", "schedule"],
    stageOptions: { from: "active" },
    sortFields: [],
    defaultSortBy: "",
    defaultSortOrder: "DESC",
    defaults: () => ({ activities: ACTIVITY_OPTIONS.map((o) => o.value), schedule: "last_7_days" }),
  },
  landing_page_leads: opp({
    key: "landing_page_leads",
    controls: LEAD_BAR,
    stageOptions: { from: "active" },
    sourceFilter: /landing/i,
    defaults: (role) => ({ dateType: agentCreatedElseActivity(role), schedule: "all_time" }),
  }),
  hot_and_warm_tasks: task("hot_and_warm_tasks", TASK_BAR, "this_week"),
  first_call_tasks: task(
    "first_call_tasks",
    TASK_BAR.filter((c) => c !== "taskType"),
    "this_week",
  ),
  hot_leads: opp({
    key: "hot_leads",
    controls: LEAD_BAR,
    stageOptions: { from: "fixed", options: HOT_STAGES },
    dateTypeOnlyWhenNotDefault: true,
    defaults: (role) => ({ dateType: agentCreatedElseActivity(role), schedule: "this_week" }),
  }),
  warm_leads: opp({
    key: "warm_leads",
    controls: LEAD_BAR,
    stageOptions: { from: "fixed", options: WARM_STAGES },
    dateTypeOnlyWhenNotDefault: true,
    defaults: (role) => ({ dateType: agentCreatedElseActivity(role), schedule: "this_week" }),
  }),
  hot_leads_not_called: opp({
    key: "hot_leads_not_called",
    controls: LEAD_BAR,
    stageOptions: { from: "fixed", options: HOT_STAGES },
    dateTypeOnlyWhenNotDefault: true,
    defaults: (role) => ({ dateType: agentCreatedElseActivity(role), schedule: "this_week" }),
  }),
  inbound_phone_call: opp({
    key: "inbound_phone_call",
    controls: INBOUND_BAR,
    stageOptions: { from: "active" },
    defaults: () => ({ schedule: "this_week" }),
  }),
  cs_missed_inbound: opp({
    key: "cs_missed_inbound",
    kind: "csMissed",
    controls: INBOUND_BAR,
    stageOptions: { from: "active" },
    sortFields: [{ value: "cs_missed_at", label: "Missed Call Date" }, ...OPP_SORTS],
    defaultSortBy: "cs_missed_at",
    defaults: () => ({ schedule: "all_time" }),
  }),
  cs_missed_inbound_tasks: task(
    "cs_missed_inbound_tasks",
    TASK_BAR.filter((c) => c !== "taskType"),
    "all_time",
  ),
  complaint_open: opp({ key: "complaint_open", controls: [], defaults: () => ({}) }),
  complaint_action_pending: opp({ key: "complaint_action_pending", controls: [], defaults: () => ({}) }),
  complaint_dnp_whatsapp: opp({ key: "complaint_dnp_whatsapp", controls: [], defaults: () => ({}) }),
};

/** A view Compass added that the app doesn't know yet: show it as a plain list with search. */
export function viewConfig(key: string, type: "lead" | "task" = "lead"): ViewConfig {
  return (
    VIEW_CONFIGS[key] ??
    (type === "task"
      ? task(key, ["search"], "all_time")
      : opp({ key, controls: ["search"], defaults: () => ({}) }))
  );
}

/** The view's starting filters for this user. */
export function defaultFilters(config: ViewConfig, role: CompassRole): Filters {
  return { ...EMPTY_FILTERS, ...config.defaults(role) };
}

/** Controls actually shown to this user (agents never see the owner filter). */
export function visibleControls(config: ViewConfig, role: CompassRole): FilterControl[] {
  return config.controls.filter((c) => !(c === "owner" && role === "agent"));
}

/** Compass shows "All Time" in the date dropdown to agents only. */
export function scheduleOptions(role: CompassRole): Option[] {
  return role === "agent" ? SCHEDULE_OPTIONS : SCHEDULE_OPTIONS.filter((o) => o.value !== "all_time");
}

/**
 * Query string for GET /smart-views/data, exactly as Compass web builds it. Empty values are
 * left out (the client only appends non-empty values).
 */
export function buildViewQuery(
  config: ViewConfig,
  f: Filters,
  role: CompassRole,
  page: number,
  limit: number,
): Record<string, string> {
  const q: Record<string, string> = { view: config.key, page: String(page), limit: String(limit) };
  const has = (c: FilterControl) => config.controls.includes(c);
  const set = (k: string, v: string | undefined) => {
    if (v) q[k] = v;
  };

  if (has("search")) set("search", f.search.trim());
  if (has("stages")) set("stages", (f.stages.length ? f.stages : POST_VC_DEFAULT_STAGES).join(","));
  if (has("stage")) set("stage", f.stage);
  if (has("source")) set("source", f.source);
  if (has("owner") && role !== "agent") set("owner", f.owner);
  if (has("dateType")) {
    if (!(config.dateTypeOnlyWhenNotDefault && f.dateType === "last_activity")) set("date_type", f.dateType);
  }
  if (has("schedule")) {
    set("schedule", f.schedule);
    if (f.schedule === "custom") {
      set("date_from", f.dateFrom);
      set("date_to", f.dateTo);
    }
  }
  if (has("taskType") && f.taskType && f.taskType !== "all") set("task_type", f.taskType);
  if (has("status")) set("status", f.status);
  if (has("activities"))
    set(
      "activity_codes",
      (f.activities.length ? f.activities : ACTIVITY_OPTIONS.map((o) => o.value)).join(","),
    );

  if (config.sortFields.length) {
    set("sort_by", f.sortBy);
    q.sort_order = f.sortOrder || config.defaultSortOrder;
  }
  return q;
}

/** Compass column-header sort toggle: same field DESC → ASC, otherwise DESC. */
export function nextSort(current: Pick<Filters, "sortBy" | "sortOrder">, field: string, config: ViewConfig) {
  const activeField = current.sortBy || config.defaultSortBy;
  const activeOrder = current.sortOrder || config.defaultSortOrder;
  return {
    sortBy: field,
    sortOrder: activeField === field && activeOrder === "DESC" ? "ASC" : "DESC",
  } as const;
}

/** Label for a schedule value; custom ranges read "from – to". */
export function scheduleLabel(f: Pick<Filters, "schedule" | "dateFrom" | "dateTo">): string {
  if (f.schedule === "custom" && f.dateFrom && f.dateTo) return `${f.dateFrom} – ${f.dateTo}`;
  return SCHEDULE_OPTIONS.find((o) => o.value === f.schedule)?.label ?? "All Time";
}

/** Trigger text for a multi-select: first label, then "+N" for the rest (Compass style). */
export function multiLabel(values: string[], options: Option[], placeholder: string): string {
  if (!values.length) return placeholder;
  const first = options.find((o) => o.value === values[0])?.label ?? values[0]!;
  return values.length > 1 ? `${first} +${values.length - 1}` : first;
}

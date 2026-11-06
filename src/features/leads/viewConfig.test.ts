/// <reference types="jest" />
import {
  buildViewQuery,
  defaultFilters,
  multiLabel,
  nextSort,
  POST_VC_DEFAULT_STAGES,
  scheduleLabel,
  scheduleOptions,
  STATUS_OPTIONS,
  viewConfig,
  VIEW_CONFIGS,
  visibleControls,
} from "./viewConfig";

const ALL_KEYS = [
  "post_vc_weight_loss",
  "important_customers",
  "landing_page_leads",
  "hot_and_warm_tasks",
  "first_call_tasks",
  "hot_leads",
  "warm_leads",
  "hot_leads_not_called",
  "inbound_phone_call",
  "cs_missed_inbound",
  "cs_missed_inbound_tasks",
  "complaint_open",
  "complaint_action_pending",
  "complaint_dnp_whatsapp",
];

describe("view catalogue", () => {
  it("has every Compass smart view", () => {
    expect(Object.keys(VIEW_CONFIGS).sort()).toEqual([...ALL_KEYS].sort());
  });

  it("falls back to a plain searchable list for an unknown view", () => {
    expect(viewConfig("new_view").controls).toEqual(["search"]);
    expect(viewConfig("new_task_view", "task").kind).toBe("task");
  });
});

describe("defaults (Compass web)", () => {
  it.each([
    [
      "post_vc_weight_loss",
      "agent",
      { stages: POST_VC_DEFAULT_STAGES, dateType: "created_on", schedule: "today" },
    ],
    ["important_customers", "agent", { schedule: "last_7_days" }],
    ["landing_page_leads", "agent", { dateType: "created_on", schedule: "all_time" }],
    ["landing_page_leads", "administrator", { dateType: "last_activity", schedule: "all_time" }],
    ["hot_leads", "agent", { dateType: "created_on", schedule: "this_week" }],
    ["warm_leads", "tl", { dateType: "last_activity", schedule: "this_week" }],
    ["hot_and_warm_tasks", "agent", { status: "pending_and_overdue", schedule: "this_week" }],
    ["first_call_tasks", "agent", { status: "pending_and_overdue", schedule: "this_week" }],
    ["inbound_phone_call", "agent", { schedule: "this_week" }],
    ["cs_missed_inbound", "agent", { schedule: "all_time" }],
    ["cs_missed_inbound_tasks", "agent", { status: "pending_and_overdue", schedule: "all_time" }],
  ] as const)("%s for %s", (key, role, expected) => {
    expect(defaultFilters(viewConfig(key), role)).toMatchObject(expected);
  });

  it("selects all four high-intent activities by default", () => {
    expect(defaultFilters(viewConfig("important_customers"), "agent").activities).toHaveLength(4);
  });
});

describe("visible controls", () => {
  it("hides the owner filter from agents only", () => {
    expect(visibleControls(viewConfig("hot_leads"), "agent")).not.toContain("owner");
    expect(visibleControls(viewConfig("hot_leads"), "tl")).toContain("owner");
  });

  it("shows no filters on complaint views and no task type on First Call", () => {
    expect(visibleControls(viewConfig("complaint_open"), "administrator")).toEqual([]);
    expect(viewConfig("first_call_tasks").controls).not.toContain("taskType");
    expect(viewConfig("hot_and_warm_tasks").controls).toContain("taskType");
  });

  it('offers "All Time" to agents only', () => {
    expect(scheduleOptions("agent")[0]).toEqual({ value: "all_time", label: "All Time" });
    expect(scheduleOptions("supervisor").map((o) => o.value)).not.toContain("all_time");
  });
});

describe("buildViewQuery", () => {
  it("post-VC sends its default stages and date type", () => {
    const c = viewConfig("post_vc_weight_loss");
    expect(buildViewQuery(c, defaultFilters(c, "agent"), "agent", 1, 20)).toEqual({
      view: "post_vc_weight_loss",
      page: "1",
      limit: "20",
      stages: "warm_consultation_done,hot_in_consideration",
      date_type: "created_on",
      schedule: "today",
      sort_order: "DESC",
    });
  });

  it("falls back to the default stages when the selection is cleared", () => {
    const c = viewConfig("post_vc_weight_loss");
    const q = buildViewQuery(c, { ...defaultFilters(c, "agent"), stages: [] }, "agent", 1, 20);
    expect(q.stages).toBe(POST_VC_DEFAULT_STAGES.join(","));
  });

  it("hot/warm views omit date_type when it is Last Activity", () => {
    const c = viewConfig("hot_leads");
    expect(
      buildViewQuery(c, defaultFilters(c, "administrator"), "administrator", 1, 20).date_type,
    ).toBeUndefined();
    expect(buildViewQuery(c, defaultFilters(c, "agent"), "agent", 1, 20).date_type).toBe("created_on");
  });

  it("sends every set lead filter, and the custom date range", () => {
    const c = viewConfig("landing_page_leads");
    const f = {
      ...defaultFilters(c, "administrator"),
      search: " Asha ",
      stage: "cold",
      source: "landing-lhr",
      owner: "31",
      schedule: "custom",
      dateFrom: "2026-11-01",
      dateTo: "2026-11-06",
      sortBy: "lead_score",
      sortOrder: "ASC" as const,
    };
    expect(buildViewQuery(c, f, "administrator", 2, 50)).toEqual({
      view: "landing_page_leads",
      page: "2",
      limit: "50",
      search: "Asha",
      stage: "cold",
      source: "landing-lhr",
      owner: "31",
      date_type: "last_activity",
      schedule: "custom",
      date_from: "2026-11-01",
      date_to: "2026-11-06",
      sort_by: "lead_score",
      sort_order: "ASC",
    });
  });

  it("never sends an owner for an agent", () => {
    const c = viewConfig("hot_leads");
    expect(
      buildViewQuery(c, { ...defaultFilters(c, "agent"), owner: "99" }, "agent", 1, 20).owner,
    ).toBeUndefined();
  });

  it("task views send status and task type, ASC by default, and skip task_type=all", () => {
    const c = viewConfig("hot_and_warm_tasks");
    const f = defaultFilters(c, "agent");
    expect(buildViewQuery(c, { ...f, taskType: "follow_up" }, "agent", 1, 20)).toEqual({
      view: "hot_and_warm_tasks",
      page: "1",
      limit: "20",
      status: "pending_and_overdue",
      schedule: "this_week",
      task_type: "follow_up",
      sort_order: "ASC",
    });
    expect(buildViewQuery(c, { ...f, taskType: "all" }, "agent", 1, 20).task_type).toBeUndefined();
  });

  it("important customers sends activity codes and never sorts", () => {
    const c = viewConfig("important_customers");
    const q = buildViewQuery(c, defaultFilters(c, "tl"), "tl", 1, 20);
    expect(q.activity_codes).toBe("add_to_cart,haut_ai_score,doctor_consultation,whatsapp_inbound");
    expect(q.sort_order).toBeUndefined();
    expect(q.schedule).toBe("last_7_days");
  });

  it("complaint views send only paging and sort", () => {
    const c = viewConfig("complaint_open");
    expect(buildViewQuery(c, defaultFilters(c, "agent"), "agent", 1, 20)).toEqual({
      view: "complaint_open",
      page: "1",
      limit: "20",
      sort_order: "DESC",
    });
  });
});

describe("helpers", () => {
  it("toggles sort like Compass column headers", () => {
    const c = viewConfig("hot_leads");
    expect(nextSort({ sortBy: "", sortOrder: "" }, "updated_at", c)).toEqual({
      sortBy: "updated_at",
      sortOrder: "ASC",
    });
    expect(nextSort({ sortBy: "updated_at", sortOrder: "ASC" }, "updated_at", c)).toEqual({
      sortBy: "updated_at",
      sortOrder: "DESC",
    });
    expect(nextSort({ sortBy: "updated_at", sortOrder: "DESC" }, "lead_score", c)).toEqual({
      sortBy: "lead_score",
      sortOrder: "DESC",
    });
  });

  it("labels schedules and multi-selects", () => {
    expect(scheduleLabel({ schedule: "this_week", dateFrom: "", dateTo: "" })).toBe("This Week");
    expect(scheduleLabel({ schedule: "custom", dateFrom: "2026-11-01", dateTo: "2026-11-06" })).toBe(
      "2026-11-01 – 2026-11-06",
    );
    expect(scheduleLabel({ schedule: "", dateFrom: "", dateTo: "" })).toBe("All Time");
    expect(multiLabel(["pending"], STATUS_OPTIONS, "Any")).toBe("Pending");
    expect(multiLabel(["pending", "overdue"], STATUS_OPTIONS, "Any")).toBe("Pending +1");
    expect(multiLabel([], STATUS_OPTIONS, "Any")).toBe("Any");
  });
});

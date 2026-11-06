/// <reference types="jest" />
import type { LeadViewRow, TaskViewRow } from "@/types/compass";
import { formatSource, fullName, mergePages, taskStatusLabel, toLeadItem } from "./leadItem";

const leadRow: LeadViewRow = {
  id: 48213,
  first_name: "Priya",
  last_name: "Sharma",
  primary_phone: "9871107094",
  lead_source: "laser-short-journey",
  lead_stage: { code: "prospect", label: "Prospect" },
  lead_score: 130,
  opportunity_id: 77120,
  opportunity_stage: { code: "hot_in_consideration", label: "Hot" },
  owner: { id: 31, name: "J Shalini" },
  created_at: "2026-11-04T05:30:00.000Z",
  updated_at: "2026-11-05T05:30:00.000Z",
};

const taskRow: TaskViewRow = {
  id: 90311,
  title: "First call: Priya",
  status: "pending",
  due_at: "2026-11-09T06:00:00.000Z",
  task_type: { code: "first_call", label: "First Call" },
  lead: { id: 48213, first_name: "Priya", last_name: null, primary_phone: "9871107094" },
  assigned_to: { id: 31, name: "J Shalini", extension: null },
  created_by: { id: 1, name: "System" },
  opportunity_id: 77120,
  opportunity_stage: { code: "new_lead", label: "New Lead" },
  department: { code: "sales", label: "Sales" },
};

describe("toLeadItem", () => {
  it("maps a lead-view row with every Compass column", () => {
    expect(toLeadItem(leadRow, "lead")).toEqual({
      key: "o-77120",
      leadId: "48213",
      opportunityId: "77120",
      name: "Priya Sharma",
      phone: "9871107094",
      stage: { code: "hot_in_consideration", label: "Hot" },
      source: "facial-short-journey",
      leadScore: 130,
      owner: "J Shalini",
      createdAt: "2026-11-04T05:30:00.000Z",
      updatedAt: "2026-11-05T05:30:00.000Z",
      missedCallAt: null,
      importantActivity: null,
      task: null,
    });
  });

  it("carries the missed-call date and the last high-intent activity", () => {
    const item = toLeadItem(
      {
        ...leadRow,
        cs_missed_at: "2026-11-05T10:00:00.000Z",
        last_important_activity: { code: "add_to_cart", occurred_at: "2026-11-05T09:00:00.000Z" },
      },
      "lead",
    );
    expect(item.missedCallAt).toBe("2026-11-05T10:00:00.000Z");
    expect(item.importantActivity).toEqual({ code: "add_to_cart", occurredAt: "2026-11-05T09:00:00.000Z" });
  });

  it("falls back to the lead stage when there is no opportunity stage", () => {
    expect(toLeadItem({ ...leadRow, opportunity_stage: null }, "lead").stage).toEqual({
      code: "prospect",
      label: "Prospect",
    });
  });

  it("maps a task-view row with the task columns", () => {
    expect(toLeadItem(taskRow, "task")).toMatchObject({
      key: "t-90311",
      opportunityId: "77120",
      name: "Priya",
      owner: "J Shalini",
      task: {
        id: "90311",
        type: "First Call",
        title: "First call: Priya",
        status: "pending",
        dueAt: "2026-11-09T06:00:00.000Z",
        createdBy: "System",
        assignedTo: "J Shalini",
      },
    });
  });

  it("names a lead like Compass: name, else phone, else Unknown Lead", () => {
    expect(toLeadItem({ ...leadRow, first_name: null, last_name: null }, "lead").name).toBe("9871107094");
    expect(toLeadItem({ ...taskRow, lead: null }, "task").name).toBe("Unknown Lead");
  });
});

describe("helpers", () => {
  it("fullName trims and joins", () => {
    expect(fullName("  Rahul ", " Verma ")).toBe("Rahul Verma");
    expect(fullName(null, "")).toBe("Unnamed lead");
  });

  it("formatSource keeps Compass's stored value", () => {
    expect(formatSource("slimming-short-journey")).toBe("slimming-short-journey");
    expect(formatSource("  ")).toBeNull();
  });

  it("taskStatusLabel shows overdue for a pending task past its due time", () => {
    const now = Date.parse("2026-11-10T00:00:00Z");
    expect(taskStatusLabel({ status: "pending", dueAt: "2026-11-09T06:00:00Z" }, now)).toBe("overdue");
    expect(taskStatusLabel({ status: "pending", dueAt: "2026-11-11T06:00:00Z" }, now)).toBe("pending");
    expect(taskStatusLabel({ status: "completed", dueAt: "2026-11-09T06:00:00Z" }, now)).toBe("completed");
  });

  it("mergePages drops rows repeated across pages and keeps order", () => {
    const a = toLeadItem(leadRow, "lead");
    const b = toLeadItem({ ...leadRow, opportunity_id: 2 }, "lead");
    expect(mergePages([[a, b], [b]]).map((i) => i.key)).toEqual(["o-77120", "o-2"]);
  });
});

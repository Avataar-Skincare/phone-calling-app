/// <reference types="jest" />
import type { LeadViewRow, TaskViewRow } from "@/types/compass";
import { formatSource, fullName, mergePages, toLeadItem } from "./leadItem";

const leadRow: LeadViewRow = {
  id: 48213,
  first_name: "Priya",
  last_name: "Sharma",
  primary_phone: "9871107094",
  lead_source: "facebook_lead_ads",
  lead_stage: { code: "prospect", label: "Prospect" },
  opportunity_id: 77120,
  opportunity_stage: { code: "hot_in_consideration", label: "Hot" },
  owner: { id: 31, name: "Agent" },
};

const taskRow: TaskViewRow = {
  id: 90311,
  title: "First call",
  status: "pending",
  due_at: "2026-11-09T06:00:00.000Z",
  task_type: { code: "first_call", label: "First Call" },
  lead: { id: 48213, first_name: "Priya", last_name: null, primary_phone: "9871107094" },
  assigned_to: { id: 31, name: "Agent", extension: null },
  opportunity_id: 77120,
  opportunity_stage: { code: "new_lead", label: "New Lead" },
  department: { code: "sales", label: "Sales" },
};

describe("toLeadItem", () => {
  it("maps a lead-view row", () => {
    expect(toLeadItem(leadRow, "lead")).toEqual({
      key: "o-77120",
      leadId: "48213",
      opportunityId: "77120",
      name: "Priya Sharma",
      phone: "9871107094",
      stage: { code: "hot_in_consideration", label: "Hot" },
      source: "Facebook lead ads",
      task: null,
    });
  });

  it("falls back to the lead stage when there is no opportunity stage", () => {
    expect(toLeadItem({ ...leadRow, opportunity_stage: null }, "lead").stage).toEqual({
      code: "prospect",
      label: "Prospect",
    });
  });

  it("maps a task-view row", () => {
    expect(toLeadItem(taskRow, "task")).toEqual({
      key: "t-90311",
      leadId: "48213",
      opportunityId: "77120",
      name: "Priya",
      phone: "9871107094",
      stage: { code: "new_lead", label: "New Lead" },
      source: null,
      task: { id: "90311", type: "First Call", dueAt: "2026-11-09T06:00:00.000Z" },
    });
  });

  it("degrades instead of crashing on missing data", () => {
    const bare = toLeadItem({ ...taskRow, lead: null, opportunity_id: null, task_type: null }, "task");
    expect(bare).toMatchObject({ name: "Unnamed lead", phone: null, opportunityId: null });
    expect(bare.task?.type).toBeNull();
  });
});

describe("helpers", () => {
  it("fullName trims and joins", () => {
    expect(fullName("  Rahul ", " Verma ")).toBe("Rahul Verma");
    expect(fullName(null, "")).toBe("Unnamed lead");
  });

  it("formatSource makes codes readable", () => {
    expect(formatSource("Landing_Page-LHR")).toBe("Landing page lhr");
    expect(formatSource("  ")).toBeNull();
  });

  it("mergePages drops rows repeated across pages and keeps order", () => {
    const a = toLeadItem(leadRow, "lead");
    const b = toLeadItem({ ...leadRow, opportunity_id: 2 }, "lead");
    expect(mergePages([[a, b], [b]]).map((i) => i.key)).toEqual(["o-77120", "o-2"]);
  });
});

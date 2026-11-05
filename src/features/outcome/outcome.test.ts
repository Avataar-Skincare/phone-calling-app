/// <reference types="jest" />
import { applyCallEvent, createSession, type CallSession } from "@/lib/callState";
import type { ActivityFormConfig } from "@/types/compass";
import { formConfig } from "../../../tests/support/compass";
import {
  buildPayload,
  callMetadata,
  callSummary,
  fieldsFor,
  orderedStages,
  recordsNothing,
  STAGE_ERROR,
  suggestStage,
  validateOutcome,
} from "./outcome";

// Fixture config plus a stage with a number field.
const config: ActivityFormConfig = {
  ...formConfig(),
  available_stages: [
    ...formConfig().available_stages,
    { id: "3", code: "hot_in_consideration", label: "Hot", stage_type: "active", sort_order: 30 },
  ],
  form_configs: {
    ...formConfig().form_configs,
    hot_in_consideration: {
      sub_form_name: "Phone Call Connected",
      activity_type_code: "phone_call_connected",
      top_level_fields: [],
      sub_form_fields: [
        { key: "budget", label: "Budget", type: "number", required: false, options: null },
        { key: "notes", label: "Notes", type: "text", required: true, options: null },
      ],
    },
  },
};

const T = Date.parse("2026-11-09T05:30:00Z"); // 11:00 IST
const later = new Date(T + 3 * 3_600_000).toISOString();
const target = { name: "Asha", phone: "+919876500001", opportunityId: "7001", leadId: "501", taskId: null };

function iosCall(answered: boolean): CallSession {
  let s = createSession(target, { platform: "ios", tracked: true, simId: null, now: T, id: "c1" });
  s = applyCallEvent(s, { state: "dialing", at: T + 2_000 });
  if (answered) s = applyCallEvent(s, { state: "connected", at: T + 10_000 });
  return applyCallEvent(s, { state: "ended", at: T + 202_000, connected: answered });
}

describe("stages", () => {
  it("orders stages by pipeline position", () => {
    expect(orderedStages(config).map((s) => s.code)).toEqual([
      "new_lead",
      "not_connected",
      "hot_in_consideration",
      "not_interested",
    ]);
  });

  it("lists the fields for a stage", () => {
    expect(fieldsFor(config, "not_connected").map((f) => f.key)).toEqual([
      "select_outcome",
      "next_follow_up_datetime",
      "notes",
    ]);
    expect(fieldsFor(config, null)).toEqual([]);
  });

  it("pre-selects Not Connected only when the phone knows the call wasn't answered", () => {
    expect(suggestStage(config, { connected: false })).toBe("not_connected");
    expect(suggestStage(config, { connected: true })).toBeNull();
    expect(suggestStage(config, { connected: null })).toBeNull();
  });

  it("knows when saving would record nothing", () => {
    expect(recordsNothing(config, "new_lead")).toBe(true);
    expect(recordsNothing(config, "not_interested")).toBe(false); // different stage: it's a stage change
  });
});

describe("validateOutcome", () => {
  it("requires a stage", () => {
    expect(Object.keys(validateOutcome(config, null, {}, T))).toEqual([STAGE_ERROR]);
    expect(Object.keys(validateOutcome(config, "made_up", {}, T))).toEqual([STAGE_ERROR]);
  });

  it("blocks re-saving the current stage when it has no form", () => {
    expect(validateOutcome(config, "new_lead", {}, T)[STAGE_ERROR]).toMatch(/already in New Lead/);
  });

  it("flags every empty required field", () => {
    expect(validateOutcome(config, "not_connected", {}, T)).toEqual({
      select_outcome: "Select Outcome is required.",
      next_follow_up_datetime: "Next Follow Up is required.",
      notes: "Notes is required.",
    });
  });

  it("checks dropdown options, past dates and numbers", () => {
    expect(
      validateOutcome(
        config,
        "not_connected",
        {
          select_outcome: "Maybe",
          next_follow_up_datetime: new Date(T - 3_600_000).toISOString(),
          notes: "x",
        },
        T,
      ),
    ).toEqual({
      select_outcome: "Pick one of the options.",
      next_follow_up_datetime: "Pick a time in the future.",
    });
    expect(validateOutcome(config, "hot_in_consideration", { budget: "abc", notes: "ok" }, T)).toEqual({
      budget: "Enter a number.",
    });
  });

  it("accepts a follow-up a minute in the past (grace period)", () => {
    const justNow = new Date(T - 60_000).toISOString();
    expect(
      validateOutcome(
        config,
        "not_connected",
        { select_outcome: "Busy", next_follow_up_datetime: justNow, notes: "x" },
        T,
      ),
    ).toEqual({});
  });

  it("passes a complete form and a stage without fields", () => {
    expect(
      validateOutcome(
        config,
        "not_connected",
        { select_outcome: "No Answer", next_follow_up_datetime: later, notes: "rang out" },
        T,
      ),
    ).toEqual({});
    expect(validateOutcome(config, "not_interested", {}, T)).toEqual({});
  });
});

describe("call details", () => {
  it("describes an answered iOS call", () => {
    expect(callMetadata(iosCall(true))).toEqual({
      call_source: "mobile_app",
      call_platform: "ios",
      call_answered: "yes",
      call_started_at: new Date(T + 2_000).toISOString(),
      call_ended_at: new Date(T + 202_000).toISOString(),
      call_duration_seconds: "200",
      call_talk_seconds: "192",
    });
  });

  it("marks estimated end times", () => {
    const s = { ...iosCall(false), endApproximate: true };
    expect(callMetadata(s).call_end_estimated).toBe("yes");
  });

  it("summarises a call in one line", () => {
    expect(callSummary(iosCall(false), T)).toBe(
      "Call from Compass Dialer · Today 11:00 am · 3 min 20 s · not answered",
    );
  });
});

describe("buildPayload", () => {
  it("sends fields and call details for a stage that logs an activity", () => {
    const p = buildPayload({
      config,
      stageCode: "not_connected",
      values: { select_outcome: "No Answer", next_follow_up_datetime: later, notes: " rang out " },
      session: iosCall(false),
      userId: "31",
      now: T,
    });
    expect(p).toMatchObject({ stage_code: "not_connected", submitted_by_user_id: "31" });
    expect(p.concerns_raised).toBeUndefined();
    expect(p.top_level_data).toBeUndefined();
    expect(p.sub_form_data).toMatchObject({
      select_outcome: "No Answer",
      notes: "rang out",
      next_follow_up_datetime: later,
      call_answered: "no",
      call_source: "mobile_app",
    });
  });

  it("sends numbers as numbers", () => {
    const p = buildPayload({
      config,
      stageCode: "hot_in_consideration",
      values: { budget: "25000", notes: "wants LHR" },
      session: iosCall(true),
      userId: "31",
      now: T,
    });
    expect(p.sub_form_data?.budget).toBe(25000);
  });

  it("puts the note and call summary in concerns_raised for a stage without an activity", () => {
    const p = buildPayload({
      config,
      stageCode: "not_interested",
      values: {},
      session: iosCall(true),
      userId: "31",
      note: "Moved to another city",
      now: T,
    });
    expect(p.sub_form_data).toBeUndefined();
    expect(p.concerns_raised).toBe(
      "Moved to another city\nCall from Compass Dialer · Today 11:00 am · talked 3 min 12 s · answered",
    );
  });

  it("puts an optional note in concerns_raised for a stage with an activity", () => {
    const p = buildPayload({
      config,
      stageCode: "not_connected",
      values: { select_outcome: "Busy", next_follow_up_datetime: later, notes: "x" },
      session: iosCall(false),
      userId: "31",
      note: "  Asked for a callback in Hindi ",
      now: T,
    });
    expect(p.concerns_raised).toBe("Asked for a callback in Hindi");
  });
});

/// <reference types="jest" />
import { buildCallLogRequest, compassPhone, isRetryable, retryDelayMs, type CallForLog } from "./callLog";

const T = Date.parse("2026-11-06T10:15:00.000Z");
const call: CallForLog = {
  id: "lz3k9a-x7f2qa",
  userId: "42",
  agentName: "Priya Sharma",
  phone: "+919871107094",
  opportunityId: "12345",
  platform: "android",
  simId: "sim-2",
  tappedAt: T,
  startedAt: T + 2_000,
  endedAt: T + 218_000,
  approximate: false,
  totalDurationSeconds: 218,
  talkTimeSeconds: 201,
  ringTimeSeconds: 17,
  answered: true,
};

describe("buildCallLogRequest", () => {
  it("builds the Manual Outbound Call activity Compass expects (ADR 0005)", () => {
    expect(buildCallLogRequest(call)).toEqual({
      phone: "9871107094",
      activity_type: "manual_outbound_call",
      opportunity_id: "12345",
      occurred_at: "2026-11-06T10:18:38.000Z",
      data: {
        agent_user_id: "42",
        agent_name: "Priya Sharma",
        call_tapped_at: "2026-11-06 15:45:00",
        call_started_at: "2026-11-06 15:45:02",
        call_ended_at: "2026-11-06 15:48:38",
        call_duration_seconds: 218,
        call_talk_seconds: 201,
        call_ring_seconds: 17,
        call_answered: "yes",
        call_end_estimated: "no",
        call_platform: "android",
        call_sim: "sim-2",
        call_source: "mobile_app",
        app_session_id: "lz3k9a-x7f2qa",
      },
    });
  });

  it("stamps the activity with the call's end time, not the time it is sent", () => {
    // Offline at the call, sent hours later: Compass should still file it at the call time.
    const body = buildCallLogRequest({ ...call, endedAt: Date.parse("2026-11-06T12:48:00.000Z") });
    expect(body.occurred_at).toBe("2026-11-06T12:48:00.000Z");
    // Same moment as the readable call_ended_at, which is in IST for people
    expect(body.data.call_ended_at).toBe("2026-11-06 18:18:00");
  });

  it("never asks Compass to create a lead", () => {
    expect(buildCallLogRequest(call)).not.toHaveProperty("create_if_missing");
  });

  it("leaves out what isn't known", () => {
    const body = buildCallLogRequest({
      ...call,
      opportunityId: null,
      simId: null,
      startedAt: null,
      talkTimeSeconds: null,
      ringTimeSeconds: null,
      answered: null,
      approximate: true,
    });
    expect(body).not.toHaveProperty("opportunity_id");
    expect(body.data).not.toHaveProperty("call_talk_seconds");
    expect(body.data).not.toHaveProperty("call_ring_seconds");
    expect(body.data).not.toHaveProperty("call_sim");
    expect(body.data).toMatchObject({
      call_started_at: "2026-11-06 15:45:00", // falls back to the tap
      call_answered: "unknown",
      call_end_estimated: "yes",
    });
  });

  it("reports an unanswered call", () => {
    const body = buildCallLogRequest({ ...call, talkTimeSeconds: 0, ringTimeSeconds: 218, answered: false });
    expect(body.data).toMatchObject({ call_talk_seconds: 0, call_ring_seconds: 218, call_answered: "no" });
  });

  it("sends call_log_permission when known (ADR 0008)", () => {
    expect(buildCallLogRequest({ ...call, callLogPermission: "denied" }).data.call_log_permission).toBe(
      "denied",
    );
    expect(buildCallLogRequest({ ...call, callLogPermission: "granted" }).data.call_log_permission).toBe(
      "granted",
    );
  });

  it("omits call_log_permission when null or missing (iOS, older stored calls)", () => {
    expect(buildCallLogRequest({ ...call, callLogPermission: null }).data).not.toHaveProperty(
      "call_log_permission",
    );
    expect(buildCallLogRequest(call).data).not.toHaveProperty("call_log_permission");
  });
});

describe("compassPhone", () => {
  it.each([
    ["+919871107094", "9871107094"],
    ["+14155550123", "4155550123"],
  ])("%s → %s", (input, out) => {
    expect(compassPhone(input)).toBe(out);
  });
});

describe("retries", () => {
  it("backs off 1, 2, 4 … minutes, up to 30", () => {
    expect([1, 2, 3, 6, 10].map(retryDelayMs)).toEqual([60_000, 120_000, 240_000, 1_800_000, 1_800_000]);
  });

  it.each([
    [0, true],
    [401, true],
    [429, true],
    [503, true],
    [400, false],
    [403, false],
    [404, false],
  ])("status %s retryable: %s", (status, retryable) => {
    expect(isRetryable(status)).toBe(retryable);
  });
});

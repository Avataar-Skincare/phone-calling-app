/// <reference types="jest" />
/// <reference types="node" />
/**
 * Sending finished calls to Compass as "Manual Outbound Call" activities (ADR 0005).
 */
import { useCallLog, type FinishedCall } from "@/store/callLog.store";
import { fakeCompass } from "../../../tests/support/compass";
import { resetAppState, signedInAs } from "../../../tests/support/state";
import { discardFailedCalls, flushCallLog, retryAllCalls } from "./sendCalls";

const T = Date.parse("2026-11-06T10:15:00.000Z");
const call = (id: string, over: Partial<FinishedCall> = {}): FinishedCall => ({
  id,
  userId: "31",
  agentName: "Test Agent",
  name: "Asha Rao",
  phone: "+919876500001",
  opportunityId: "7001",
  leadId: "501",
  taskId: null,
  platform: "android",
  simId: null,
  tappedAt: T,
  startedAt: T + 1_000,
  endedAt: T + 90_000,
  approximate: false,
  totalDurationSeconds: 90,
  talkTimeSeconds: 70,
  ringTimeSeconds: 20,
  answered: true,
  status: "pending",
  attempts: 0,
  nextAttemptAt: 0,
  lastError: null,
  activityId: null,
  dismissed: false,
  ...over,
});
const get = (id: string) => useCallLog.getState().calls.find((c) => c.id === id);

beforeEach(async () => {
  await resetAppState();
  signedInAs();
});

it("sends the call with the agent's token and marks it sent", async () => {
  const server = fakeCompass();
  useCallLog.getState().add(call("c1"));
  await flushCallLog();

  const [req] = server.find("POST", "/activities/log");
  expect(req?.headers.authorization ?? req?.headers.Authorization).toMatch(/^Bearer /);
  expect(req?.body).toMatchObject({
    phone: "9876500001",
    activity_type: "manual_outbound_call",
    opportunity_id: "7001",
    data: { call_duration_seconds: 90, call_talk_seconds: 70, call_ring_seconds: 20, call_answered: "yes" },
  });
  expect(get("c1")).toMatchObject({ status: "sent", activityId: "8001" });
});

it("treats 200 with activity_id null as refused (Compass's failure reply)", async () => {
  const server = fakeCompass();
  server.on("POST", "/activities/log", {
    body: {
      lead_id: null,
      activity_id: null,
      lead_created: false,
      message: 'Activity type "manual_outbound_call" not found',
    },
  });
  useCallLog.getState().add(call("c1"));
  await flushCallLog();
  expect(get("c1")).toMatchObject({
    status: "failed",
    lastError: 'Activity type "manual_outbound_call" not found',
  });
});

it("keeps the call and backs off when Compass can't be reached", async () => {
  const server = fakeCompass();
  server.on("POST", "/activities/log", "network-error");
  useCallLog.getState().add(call("c1"));
  useCallLog.getState().add(call("c2"));
  const before = Date.now();
  await flushCallLog();

  // Offline: stops after the first, so it doesn't hammer the network
  expect(server.find("POST", "/activities/log")).toHaveLength(1);
  expect(get("c1")).toMatchObject({ status: "pending", attempts: 1 });
  expect(get("c1")!.nextAttemptAt).toBeGreaterThanOrEqual(before + 60_000);

  // Not due yet: nothing is sent
  await flushCallLog();
  expect(server.find("POST", "/activities/log")).toHaveLength(2); // c2 was still due

  // Back online, the agent taps Retry
  server.on("POST", "/activities/log", {
    body: { activity_id: "9", lead_id: "1", lead_created: false, message: "" },
  });
  await retryAllCalls();
  expect(get("c1")?.status).toBe("sent");
  expect(get("c2")?.status).toBe("sent");
});

it("doesn't retry a call Compass rejected as invalid", async () => {
  const server = fakeCompass();
  server.on("POST", "/activities/log", {
    status: 400,
    body: { statusCode: 400, message: ["phone must be longer"] },
  });
  useCallLog.getState().add(call("c1"));
  await flushCallLog();
  expect(get("c1")?.status).toBe("failed");

  discardFailedCalls();
  expect(get("c1")).toBeUndefined();
});

it("sends oldest first, only the logged-in agent's, and only once at a time", async () => {
  const server = fakeCompass();
  useCallLog.getState().add(call("old"));
  useCallLog.getState().add(call("other-agent", { userId: "99" }));
  useCallLog.getState().add(call("new"));
  await Promise.all([flushCallLog(), flushCallLog()]);

  expect(
    server
      .find("POST", "/activities/log")
      .map((r) => (r.body as { data: { app_session_id: string } }).data.app_session_id),
  ).toEqual(["old", "new"]);
  expect(get("other-agent")?.status).toBe("pending");
});

/// <reference types="jest" />
/// <reference types="node" />
import { createSession } from "@/lib/callState";
import { resetAppState } from "../../tests/support/state";
import { useCallStore } from "./call.store";
import { useOutcomeQueue } from "./outcomeQueue.store";
import { useSettingsStore } from "./settings.store";

beforeEach(async () => {
  await resetAppState();
});

const target = { name: "Asha", phone: "+919876500001", opportunityId: "7001", leadId: "501", taskId: null };

describe("call store", () => {
  it("drives a session through the state machine", () => {
    const T = Date.now();
    const s = createSession(target, { platform: "android", tracked: true, simId: null, now: T, id: "s1" });
    const store = useCallStore.getState();

    store.start(s);
    store.setMode("s1", "direct");
    store.applyEvent({ state: "offhook", at: T + 1_000 });
    expect(useCallStore.getState().session).toMatchObject({ status: "in_call", mode: "direct" });

    store.applyEvent({ state: "idle", at: T + 31_000 });
    expect(useCallStore.getState().session).toMatchObject({ status: "ended", endedAt: T + 31_000 });
  });

  it("ignores setMode for a different session", () => {
    const s = createSession(target, { platform: "android", tracked: true, simId: null, id: "s1" });
    useCallStore.getState().start(s);
    useCallStore.getState().setMode("other", "dialer");
    expect(useCallStore.getState().session?.mode).toBeNull();
  });

  it("resume() discards a cancelled call", () => {
    const T = Date.now();
    useCallStore
      .getState()
      .start(createSession(target, { platform: "ios", tracked: true, simId: null, now: T }));
    useCallStore.getState().resume("idle", T + 2_000);
    expect(useCallStore.getState().session).toBeNull();
  });

  it("does nothing without a session", () => {
    useCallStore.getState().applyEvent({ state: "offhook", at: 1 });
    useCallStore.getState().resume("idle", 2);
    expect(useCallStore.getState().session).toBeNull();
  });
});

describe("outcome queue store", () => {
  const base = {
    userId: "31",
    opportunityId: "7001",
    leadName: "Asha",
    payload: { stage_code: "not_connected", submitted_by_user_id: "31" },
    createdAt: 0,
    attempts: 1,
    nextAttemptAt: 0,
    status: "pending" as const,
    lastError: null,
  };

  it("schedules retries with back-off", () => {
    const q = useOutcomeQueue.getState();
    q.add({ ...base, id: "q1" });
    q.retryLater("q1", "Can't reach Compass", 1_000);
    expect(useOutcomeQueue.getState().items[0]).toMatchObject({
      attempts: 2,
      nextAttemptAt: 1_000 + 60_000,
      lastError: "Can't reach Compass",
      status: "pending",
    });
  });

  it("marks rejected items as failed and makes everything due on retry", () => {
    const q = useOutcomeQueue.getState();
    q.add({ ...base, id: "q1", nextAttemptAt: 9e15 });
    q.add({ ...base, id: "q2" });
    q.fail("q2", "Forbidden");
    expect(useOutcomeQueue.getState().items[1]).toMatchObject({ status: "failed", lastError: "Forbidden" });

    q.makeAllDue();
    expect(
      useOutcomeQueue.getState().items.every((i) => i.status === "pending" && i.nextAttemptAt === 0),
    ).toBe(true);
  });

  it("removes items", () => {
    useOutcomeQueue.getState().add({ ...base, id: "q1" });
    useOutcomeQueue.getState().remove("q1");
    expect(useOutcomeQueue.getState().items).toEqual([]);
  });
});

describe("settings store", () => {
  it("remembers the SIM and the permission intro", () => {
    useSettingsStore.getState().setSimId("sim-2");
    useSettingsStore.getState().markPermissionIntroSeen();
    expect(useSettingsStore.getState()).toMatchObject({ simId: "sim-2", permissionIntroSeen: true });
  });
});

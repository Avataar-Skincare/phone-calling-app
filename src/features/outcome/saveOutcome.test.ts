/// <reference types="jest" />
/// <reference types="node" />
/**
 * Integration: saving outcomes and sending the offline queue, against the fake Compass.
 */
import { queryClient } from "@/api/queryClient";
import { useOutcomeQueue } from "@/store/outcomeQueue.store";
import { useAuthStore } from "@/store/auth.store";
import type { ActivityFormPayload } from "@/types/compass";
import { fakeCompass } from "../../../tests/support/compass";
import { resetAppState, signedInAs } from "../../../tests/support/state";
import { flushOutcomeQueue, saveOutcome } from "./saveOutcome";

const payload: ActivityFormPayload = {
  stage_code: "not_connected",
  submitted_by_user_id: "31",
  sub_form_data: { select_outcome: "No Answer", notes: "rang out", call_source: "mobile_app" },
};
const args = { opportunityId: "7001", leadName: "Asha Rao", userId: "31", payload };

beforeEach(async () => {
  await resetAppState();
  signedInAs();
});

describe("saveOutcome", () => {
  it("posts the activity form and refreshes lists", async () => {
    const server = fakeCompass();
    const invalidate = jest.spyOn(queryClient, "invalidateQueries");

    await expect(saveOutcome(args)).resolves.toEqual({ kind: "saved" });

    const [req] = server.find("POST", "/opportunities/7001/activity-form");
    expect(req?.body).toEqual(payload);
    expect(req?.headers.Authorization).toMatch(/^Bearer /);
    expect(invalidate).toHaveBeenCalledWith({ queryKey: ["smart-views"] });
    expect(invalidate).toHaveBeenCalledWith({ queryKey: ["opportunity", "7001"] });
    expect(useOutcomeQueue.getState().items).toEqual([]);
  });

  it("queues the outcome when Compass can't be reached", async () => {
    const server = fakeCompass();
    server.on("POST", /activity-form$/, "network-error");

    await expect(saveOutcome(args)).resolves.toEqual({ kind: "queued" });
    expect(useOutcomeQueue.getState().items).toEqual([
      expect.objectContaining({
        userId: "31",
        opportunityId: "7001",
        leadName: "Asha Rao",
        payload,
        attempts: 1,
        status: "pending",
        lastError: expect.stringMatching(/Can't reach Compass/),
      }),
    ]);
  });

  it("queues on a server error or a 401 (sent again after login)", async () => {
    const server = fakeCompass();
    server.on("POST", /activity-form$/, { status: 503, body: { message: "down" } });
    await expect(saveOutcome(args)).resolves.toEqual({ kind: "queued" });

    server.on("POST", /activity-form$/, { status: 401, body: { message: "Unauthorized" } });
    await expect(saveOutcome(args)).resolves.toEqual({ kind: "queued" });
    expect(useOutcomeQueue.getState().items).toHaveLength(2);
  });

  it("returns Compass's reason when it rejects the outcome, and queues nothing", async () => {
    const server = fakeCompass();
    server.on("POST", /activity-form$/, {
      status: 400,
      body: { statusCode: 400, message: 'Sub-form field "notes" is required' },
    });
    await expect(saveOutcome(args)).resolves.toEqual({
      kind: "rejected",
      status: 400,
      message: 'Sub-form field "notes" is required',
    });
    expect(useOutcomeQueue.getState().items).toEqual([]);
  });

  it("reports a reassigned lead (403) as rejected", async () => {
    const server = fakeCompass();
    server.on("POST", /activity-form$/, { status: 403, body: { message: "Forbidden resource" } });
    await expect(saveOutcome(args)).resolves.toMatchObject({ kind: "rejected", status: 403 });
  });
});

describe("flushOutcomeQueue", () => {
  const queued = (id: string, over: object = {}) => ({
    id,
    userId: "31",
    opportunityId: "7001",
    leadName: "Asha Rao",
    payload,
    createdAt: Number(id.replace(/\D/g, "")),
    attempts: 1,
    nextAttemptAt: 0,
    status: "pending" as const,
    lastError: "Can't reach Compass",
    ...over,
  });

  it("sends due items oldest first and removes them", async () => {
    const server = fakeCompass();
    useOutcomeQueue.setState({ items: [queued("q2", { opportunityId: "7002" }), queued("q1")] });

    await flushOutcomeQueue();

    expect(server.find("POST", /activity-form$/).map((r) => r.path)).toEqual([
      "/opportunities/7001/activity-form",
      "/opportunities/7002/activity-form",
    ]);
    expect(useOutcomeQueue.getState().items).toEqual([]);
  });

  it("only sends the logged-in agent's items and skips ones not yet due", async () => {
    const server = fakeCompass();
    useOutcomeQueue.setState({
      items: [queued("q1", { userId: "99" }), queued("q2", { nextAttemptAt: Date.now() + 60_000 })],
    });

    await flushOutcomeQueue();
    expect(server.find("POST", /activity-form$/)).toHaveLength(0);
    expect(useOutcomeQueue.getState().items).toHaveLength(2);
  });

  it("backs off on a temporary failure and fails on a rejection", async () => {
    const server = fakeCompass();
    server.on("POST", "/opportunities/7001/activity-form", "network-error");
    server.on("POST", "/opportunities/7002/activity-form", {
      status: 403,
      body: { message: "Forbidden resource" },
    });
    useOutcomeQueue.setState({ items: [queued("q1"), queued("q2", { opportunityId: "7002" })] });

    await flushOutcomeQueue();

    const [a, b] = useOutcomeQueue.getState().items;
    expect(a).toMatchObject({ id: "q1", status: "pending", attempts: 2 });
    expect(a!.nextAttemptAt).toBeGreaterThan(Date.now());
    expect(b).toMatchObject({ id: "q2", status: "failed", lastError: "Forbidden resource" });
  });

  it("does nothing when nobody is logged in", async () => {
    const server = fakeCompass();
    useAuthStore.setState({ session: null });
    useOutcomeQueue.setState({ items: [queued("q1")] });

    await flushOutcomeQueue();
    expect(server.requests).toHaveLength(0);
  });

  it("never sends the same item twice when called concurrently", async () => {
    const server = fakeCompass();
    useOutcomeQueue.setState({ items: [queued("q1")] });

    await Promise.all([flushOutcomeQueue(), flushOutcomeQueue(), flushOutcomeQueue()]);
    expect(server.find("POST", /activity-form$/)).toHaveLength(1);
  });
});

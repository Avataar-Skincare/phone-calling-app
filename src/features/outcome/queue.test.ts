/// <reference types="jest" />
import { classifyFailure, dueItems, retryDelayMs, type QueuedOutcome } from "./queue";

describe("retryDelayMs", () => {
  it("backs off 30 s, 1, 2, 4, 8 min, then every 10 min", () => {
    expect([1, 2, 3, 4, 5, 6, 9].map(retryDelayMs)).toEqual([
      30_000, 60_000, 120_000, 240_000, 480_000, 600_000, 600_000,
    ]);
  });
});

describe("classifyFailure", () => {
  it.each([
    [0, "retry", "no network"],
    [401, "retry", "logged out mid-save"],
    [408, "retry", "timeout"],
    [429, "retry", "rate limited"],
    [500, "retry", "server error"],
    [504, "retry", "gateway timeout"],
    [400, "reject", "validation"],
    [403, "reject", "lead reassigned"],
    [404, "reject", "not found"],
  ])("%s → %s (%s)", (status, kind) => {
    expect(classifyFailure(status)).toBe(kind);
  });
});

describe("dueItems", () => {
  const T = 1_800_000_000_000;
  const item = (id: string, over: Partial<QueuedOutcome>): QueuedOutcome => ({
    id,
    userId: "31",
    opportunityId: "1",
    leadName: "x",
    payload: { stage_code: "not_connected", submitted_by_user_id: "31" },
    createdAt: 0,
    attempts: 1,
    nextAttemptAt: 0,
    status: "pending",
    lastError: null,
    ...over,
  });

  it("returns only this user's pending, due items, oldest first", () => {
    const items = [
      item("b", { createdAt: 2 }),
      item("a", { createdAt: 1 }),
      item("other-user", { userId: "99" }),
      item("failed", { status: "failed" }),
      item("not-yet", { nextAttemptAt: T + 1 }),
    ];
    expect(dueItems(items, "31", T).map((i) => i.id)).toEqual(["a", "b"]);
  });
});

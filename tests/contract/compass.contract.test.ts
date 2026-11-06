/// <reference types="jest" />
/// <reference types="node" />
/**
 * Contract: the real Compass API still returns what the app relies on.
 *
 * READ-ONLY. Logs in and makes GET requests; never changes data.
 * See jest.contract.config.js for the environment variables.
 */
import { toLeadItem } from "@/features/leads/leadItem";
import type {
  Department,
  OpportunityDetail,
  Paginated,
  SmartViewDef,
  VerifyOtpResponse,
} from "@/types/compass";

// test-leads.avataarskin.com is the SAME Compass as compass.avataarskin.com (one server, one
// database): these tests read live data. They must stay read-only.
const API = (process.env.COMPASS_API_URL ?? "https://test-leads.avataarskin.com/api").replace(/\/+$/, "");
const PHONE = process.env.COMPASS_TEST_PHONE;
const OTP = process.env.COMPASS_TEST_OTP;
const run = PHONE && OTP ? describe : describe.skip;

if (/compass\.avataarskin\.com/.test(API)) {
  throw new Error("Contract tests must not run against production Compass.");
}

async function call<T>(method: "GET" | "POST", path: string, opts: { token?: string; body?: unknown } = {}) {
  const res = await fetch(`${API}${path}`, {
    method,
    headers: {
      Accept: "application/json",
      ...(opts.body ? { "Content-Type": "application/json" } : {}),
      ...(opts.token ? { Authorization: `Bearer ${opts.token}` } : {}),
    },
    body: opts.body ? JSON.stringify(opts.body) : undefined,
  });
  const text = await res.text();
  return { status: res.status, body: (text ? JSON.parse(text) : null) as T };
}

run("Compass contract (read-only)", () => {
  let token = "";
  let user: VerifyOtpResponse["user"];
  let defs: SmartViewDef[] = [];
  let opportunityId = "";

  beforeAll(async () => {
    const sent = await call<{ token: string }>("POST", "/auth/send-otp", { body: { phoneNumber: PHONE } });
    expect(sent.status).toBe(201);
    const verified = await call<VerifyOtpResponse>("POST", "/auth/verify-otp", {
      body: { token: sent.body.token, otp: OTP },
    });
    expect(verified.status).toBe(201);
    token = verified.body.token;
    user = verified.body.user;
  });

  it("login returns a JWT and the user fields the app reads", () => {
    expect(token.split(".")).toHaveLength(3);
    expect(user).toEqual(
      expect.objectContaining({
        id: expect.anything(),
        name: expect.any(String),
        phone: expect.any(String),
        role: expect.stringMatching(/^(administrator|supervisor|tl|agent)$/),
      }),
    );
    expect(user).toHaveProperty("departmentId");
    expect(user).toHaveProperty("telephonyExtension");
  });

  it("rejects a wrong code with 400", async () => {
    const sent = await call<{ token: string }>("POST", "/auth/send-otp", { body: { phoneNumber: PHONE } });
    const bad = await call<{ message: string }>("POST", "/auth/verify-otp", {
      body: { token: sent.body.token, otp: "0000" === OTP ? "9999" : "0000" },
    });
    expect(bad.status).toBe(400);
    expect(typeof bad.body.message).toBe("string");
  });

  it("rejects requests without a token with 401", async () => {
    expect((await call("GET", "/smart-views/definitions")).status).toBe(401);
  });

  it("departments include Sales and CS, and the user's department id resolves", async () => {
    const res = await call<Department[]>("GET", "/opportunities/departments", { token });
    expect(res.status).toBe(200);
    const codes = res.body.map((d) => d.code);
    expect(codes).toEqual(expect.arrayContaining(["sales", "cs"]));
    if (user.departmentId != null) {
      expect(res.body.some((d) => String(d.id) === String(user.departmentId))).toBe(true);
    }
  });

  it("smart view definitions have the fields the tabs use", async () => {
    const res = await call<SmartViewDef[]>("GET", "/smart-views/definitions", { token });
    expect(res.status).toBe(200);
    defs = res.body;
    expect(defs.length).toBeGreaterThan(0);
    for (const d of defs) {
      expect(d).toEqual(
        expect.objectContaining({
          key: expect.any(String),
          label: expect.any(String),
          department: expect.stringMatching(/^(sales|cs)$/),
          type: expect.stringMatching(/^(lead|task)$/),
        }),
      );
    }
    expect(defs.some((d) => d.type === "lead")).toBe(true);
    expect(defs.some((d) => d.type === "task")).toBe(true);
  });

  it.each(["lead", "task"] as const)("a %s view pages and maps to list rows", async (type) => {
    const view = defs.find((d) => d.type === type && d.department === "sales")!;
    const res = await call<Paginated<never>>("GET", `/smart-views/data?view=${view.key}&page=1&limit=3`, {
      token,
    });
    expect(res.status).toBe(200);
    expect(res.body.meta).toEqual(
      expect.objectContaining({
        total: expect.any(Number),
        page: 1,
        limit: 3,
        total_pages: expect.any(Number),
      }),
    );
    for (const row of res.body.data) {
      const item = toLeadItem(row, type);
      expect(item.key).toMatch(/^[ot]-/);
      expect(item.name.length).toBeGreaterThan(0);
      if (type === "task") expect(item.task?.id).toBeTruthy();
      if (item.opportunityId && !opportunityId) opportunityId = item.opportunityId;
    }
  });

  it("the lead screen endpoint returns lead, stage and activities", async () => {
    expect(opportunityId).not.toBe("");
    const res = await call<OpportunityDetail>("GET", `/opportunities/${opportunityId}`, { token });
    expect(res.status).toBe(200);
    expect(res.body).toEqual(
      expect.objectContaining({
        id: expect.anything(),
        lead: expect.objectContaining({ id: expect.anything() }),
        activities: expect.any(Array),
        total_activities: expect.any(Number),
      }),
    );
    expect(res.body.activities.length).toBeLessThanOrEqual(50);
  });
});

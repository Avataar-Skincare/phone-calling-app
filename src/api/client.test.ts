/// <reference types="jest" />
/// <reference types="node" />
import { fakeCompass } from "../../tests/support/compass";
import { resetAppState, signedInAs } from "../../tests/support/state";
import { api, ApiError, setUnauthorizedHandler } from "./client";

beforeEach(async () => {
  await resetAppState();
});

describe("api client", () => {
  it("calls the Compass base URL with the query string and the agent's token", async () => {
    const server = fakeCompass();
    signedInAs();
    server.on("GET", "/thing", { body: { ok: true } });

    await expect(api.get("/thing", { a: 1, b: "x y", empty: "", gone: undefined })).resolves.toEqual({
      ok: true,
    });

    const [req] = server.requests;
    expect(req?.query).toEqual({ a: "1", b: "x y" });
    expect(req?.headers.Authorization).toMatch(/^Bearer ey/);
  });

  it("sends no token on login calls", async () => {
    const server = fakeCompass();
    signedInAs();
    await api.post("/auth/send-otp", { phoneNumber: "9000000001" }, { anon: true });
    expect(server.requests[0]?.headers.Authorization).toBeUndefined();
    expect(server.requests[0]?.headers["Content-Type"]).toBe("application/json");
  });

  it("turns a NestJS error into a readable ApiError", async () => {
    const server = fakeCompass();
    server.on("POST", "/x", {
      status: 400,
      body: { statusCode: 400, message: ["a is required", "b is wrong"] },
    });
    await expect(api.post("/x", {})).rejects.toMatchObject({
      name: "ApiError",
      status: 400,
      message: "a is required\nb is wrong",
    });
  });

  it("explains server errors without leaking internals", async () => {
    const server = fakeCompass();
    server.on("GET", "/x", { status: 504, body: undefined });
    await expect(api.get("/x")).rejects.toMatchObject({
      status: 504,
      message: "Compass had a problem. Try again in a minute.",
    });
  });

  it("reports an unreachable Compass as status 0", async () => {
    const server = fakeCompass();
    server.on("GET", "/x", "network-error");
    const err = await api.get("/x").catch((e: ApiError) => e);
    expect(err).toBeInstanceOf(ApiError);
    expect((err as ApiError).isNetwork).toBe(true);
    expect((err as ApiError).message).toMatch(/Can't reach Compass/);
  });

  it("calls the unauthorized handler on a 401, but not for login calls", async () => {
    const server = fakeCompass();
    const onUnauthorized = jest.fn();
    setUnauthorizedHandler(onUnauthorized);
    server.on("GET", "/x", { status: 401, body: { statusCode: 401, message: "Unauthorized" } });
    server.on("POST", "/auth/verify-otp", { status: 401, body: { message: "nope" } });

    await expect(api.get("/x")).rejects.toMatchObject({ status: 401 });
    expect(onUnauthorized).toHaveBeenCalledTimes(1);

    await expect(api.post("/auth/verify-otp", {}, { anon: true })).rejects.toMatchObject({ status: 401 });
    expect(onUnauthorized).toHaveBeenCalledTimes(1);
  });

  it("aborts a request that takes longer than 20 seconds", async () => {
    jest.useFakeTimers();
    try {
      global.fetch = jest.fn(
        (_url: RequestInfo | URL, init?: RequestInit) =>
          new Promise((_resolve, reject) => {
            init?.signal?.addEventListener("abort", () => reject(new Error("aborted")));
          }),
      ) as unknown as typeof fetch;
      const pending = api.get("/slow");
      jest.advanceTimersByTime(20_000);
      await expect(pending).rejects.toMatchObject({ status: 0 });
    } finally {
      jest.useRealTimers();
    }
  });
});

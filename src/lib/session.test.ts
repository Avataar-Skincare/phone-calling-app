/// <reference types="jest" />
/// <reference types="node" />
import type { CompassUser } from "@/types/compass";
import { buildSession, isSessionExpired, jwtExpiryMs, parseStoredSession, SESSION_TTL_MS } from "./session";

const user: CompassUser = {
  id: "31",
  name: "Test Agent",
  email: null,
  phone: "9000000001",
  role: "agent",
  teamId: null,
  departmentId: 1,
  telephonyExtension: null,
};
const payload = Buffer.from(JSON.stringify({ sub: "31", exp: 1800000000 })).toString("base64url");
const token = `eyJhbGciOiJIUzI1NiJ9.${payload}.sig`;

describe("jwtExpiryMs", () => {
  it("reads the exp claim in milliseconds", () => {
    expect(jwtExpiryMs(token)).toBe(1800000000 * 1000);
  });

  it("returns null for anything that isn't a readable JWT", () => {
    expect(jwtExpiryMs("not-a-jwt")).toBeNull();
    expect(jwtExpiryMs("a.%%%.c")).toBeNull();
    expect(jwtExpiryMs("a.e30.c")).toBeNull(); // {} has no exp
  });
});

describe("buildSession", () => {
  it("uses the token's exp", () => {
    expect(buildSession(token, user, 0).expiresAt).toBe(1800000000 * 1000);
  });

  it("falls back to 15 hours without exp", () => {
    expect(buildSession("x.e30.y", user, 1000).expiresAt).toBe(1000 + SESSION_TTL_MS);
  });
});

describe("isSessionExpired", () => {
  it("is valid until a minute before expiry", () => {
    expect(isSessionExpired({ expiresAt: 10 * 60_000 }, 0)).toBe(false);
    expect(isSessionExpired({ expiresAt: 10 * 60_000 }, 9 * 60_000 - 1)).toBe(false);
  });

  it("is expired within the last minute", () => {
    expect(isSessionExpired({ expiresAt: 10 * 60_000 }, 9 * 60_000 + 1)).toBe(true);
  });
});

describe("parseStoredSession", () => {
  it("round-trips a stored session", () => {
    const s = buildSession(token, user);
    expect(parseStoredSession(JSON.stringify(s))).toEqual(s);
  });

  it("rejects missing or malformed data", () => {
    expect(parseStoredSession(null)).toBeNull();
    expect(parseStoredSession("{broken")).toBeNull();
    expect(parseStoredSession(JSON.stringify({ token: "x" }))).toBeNull();
  });
});

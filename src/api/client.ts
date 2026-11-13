import { env } from "@/config/env";
import { useAuthStore } from "@/store/auth.store";
import type { NestErrorBody } from "@/types/compass";

/**
 * Thin fetch wrapper for the Compass API.
 *
 * Compass (NestJS) returns plain JSON bodies on success, not a { success, data } envelope,
 * and { statusCode, message, error } on failure, where `message` may be a string or a list of
 * validation messages.
 */

export class ApiError extends Error {
  constructor(
    /** HTTP status, or 0 when the request never reached Compass. */
    public readonly status: number,
    message: string,
  ) {
    super(message);
    this.name = "ApiError";
  }
  get isNetwork() {
    return this.status === 0;
  }
}

const TIMEOUT_MS = 20_000;

let onUnauthorized: (() => void) | null = null;
/** Registered by lib/auth: a 401 on an authenticated request ends the session. */
export function setUnauthorizedHandler(fn: () => void): void {
  onUnauthorized = fn;
}

interface RequestOptions {
  method?: "GET" | "POST";
  body?: unknown;
  query?: Record<string, string | number | undefined | null>;
  /** Send without the token (login endpoints). */
  anon?: boolean;
}

function buildUrl(path: string, query?: RequestOptions["query"]): string {
  const url = `${env.compassApiUrl}${path.startsWith("/") ? path : `/${path}`}`;
  if (!query) return url;
  const qs = Object.entries(query)
    .filter(([, v]) => v !== undefined && v !== null && v !== "")
    .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(String(v))}`)
    .join("&");
  return qs ? `${url}?${qs}` : url;
}

function messageFrom(body: NestErrorBody | null, status: number): string {
  const m = body?.message;
  if (Array.isArray(m) && m.length) return m.join("\n");
  if (typeof m === "string" && m) return m;
  // Some endpoints reply { message: { code, message } } (mobile-dialer recordings).
  if (m && typeof m === "object" && !Array.isArray(m) && typeof m.message === "string" && m.message) {
    return m.message;
  }
  if (status >= 500) return "Compass had a problem. Try again in a minute.";
  return body?.error || `Request failed (${status})`;
}

async function request<T>(path: string, opts: RequestOptions = {}): Promise<T> {
  const token = opts.anon ? null : (useAuthStore.getState().session?.token ?? null);
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

  let res: Response;
  try {
    res = await fetch(buildUrl(path, opts.query), {
      method: opts.method ?? "GET",
      headers: {
        Accept: "application/json",
        ...(opts.body !== undefined ? { "Content-Type": "application/json" } : {}),
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
      signal: controller.signal,
    });
  } catch {
    throw new ApiError(0, "Can't reach Compass. Check your internet connection and try again.");
  } finally {
    clearTimeout(timer);
  }

  const text = await res.text();
  let json: unknown = null;
  if (text) {
    try {
      json = JSON.parse(text);
    } catch {
      json = null;
    }
  }

  if (!res.ok) {
    if (res.status === 401 && !opts.anon) onUnauthorized?.();
    throw new ApiError(res.status, messageFrom(json as NestErrorBody | null, res.status));
  }
  return json as T;
}

export const api = {
  get: <T>(path: string, query?: RequestOptions["query"]) => request<T>(path, { query }),
  post: <T>(path: string, body?: unknown, opts?: Pick<RequestOptions, "anon">) =>
    request<T>(path, { method: "POST", body, ...opts }),
};

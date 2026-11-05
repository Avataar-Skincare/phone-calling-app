#!/usr/bin/env node
/**
 * Generate expo-router's typed routes (.expo/types/router.d.ts) without a manual `npm start`.
 *
 * Expo only writes the file from its dev server, so this starts Metro in CI mode, waits until the
 * file is (re)written, and stops it. Used by `npm run typecheck` locally and in CI.
 */
import { spawn } from "node:child_process";
import { existsSync, statSync } from "node:fs";
import { resolve } from "node:path";

const FILE = resolve(".expo/types/router.d.ts");
const TIMEOUT_MS = 120_000;
const startedAt = Date.now();

const fresh = () => existsSync(FILE) && statSync(FILE).mtimeMs >= startedAt - 1_000;

const child = spawn("npx", ["expo", "start", "--offline", "--port", "8099"], {
  env: { ...process.env, CI: "1", EXPO_NO_TELEMETRY: "1" },
  stdio: ["ignore", "ignore", "pipe"],
  detached: true,
});

let stderr = "";
child.stderr.on("data", (d) => (stderr += d));

function stop(code, message) {
  clearInterval(poll);
  try {
    process.kill(-child.pid, "SIGTERM");
  } catch {
    // already exited
  }
  if (message) console[code === 0 ? "log" : "error"](message);
  process.exit(code);
}

const poll = setInterval(() => {
  if (fresh()) stop(0, "typegen: route types generated");
  else if (Date.now() - startedAt > TIMEOUT_MS)
    stop(1, `typegen: timed out after ${TIMEOUT_MS / 1000}s\n${stderr}`);
}, 250);

child.on("exit", (code) => {
  if (fresh()) stop(0, "typegen: route types generated");
  else stop(1, `typegen: expo exited (${code}) before writing route types\n${stderr}`);
});

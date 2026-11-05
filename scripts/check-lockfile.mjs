#!/usr/bin/env node
/**
 * Fail if package-lock.json is missing a required (non-optional) peer dependency.
 *
 * EAS Build runs `npm ci`, which rejects a lock file that lacks a required peer of any locked
 * package. Some local npm setups don't add such peers, so the lock looks fine here and only fails
 * in the cloud. This catches it before a build is uploaded.
 */
import { readFileSync } from "node:fs";

const lock = JSON.parse(readFileSync("package-lock.json", "utf8")).packages ?? {};
const locked = new Set(
  Object.keys(lock)
    .filter(Boolean)
    .map((p) => p.slice(p.lastIndexOf("node_modules/") + "node_modules/".length)),
);

const missing = [];
for (const [path, meta] of Object.entries(lock)) {
  const optional = meta.peerDependenciesMeta ?? {};
  for (const dep of Object.keys(meta.peerDependencies ?? {})) {
    if (!optional[dep]?.optional && !locked.has(dep)) {
      missing.push(`${dep} (required by ${path.replace(/^.*node_modules\//, "") || "root"})`);
    }
  }
}

if (missing.length) {
  console.error("package-lock.json is missing required peer dependencies:\n  " + missing.join("\n  "));
  console.error("Add them to package.json (devDependencies is fine) and run npm install.");
  process.exit(1);
}
console.log("check-lockfile: all required peer dependencies are in package-lock.json");

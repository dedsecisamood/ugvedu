#!/usr/bin/env node
/**
 * E2E runner shim. Invokes the Python-Playwright scripts under tests/e2e/*.py
 * in sequence and forwards their exit codes.
 *
 * Exit code 77 from a script = SKIP (no signed-in session, no outstanding
 * balance, etc.) — treated as a non-failure so `npm test` stays green on
 * hermetic CI. Any other non-zero code fails the run.
 */
import { spawnSync } from "node:child_process";
import { readdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const scripts = readdirSync(here).filter((f) => f.endsWith(".py")).sort();

let hardFail = 0;
let skipped = 0;
let passed = 0;

for (const s of scripts) {
  const full = join(here, s);
  process.stdout.write(`\n── e2e: ${s} ──\n`);
  const res = spawnSync("python3", [full], { stdio: "inherit" });
  if (res.status === 0) passed++;
  else if (res.status === 77) skipped++;
  else hardFail++;
}

process.stdout.write(
  `\nE2E summary: ${passed} passed, ${skipped} skipped, ${hardFail} failed\n`,
);
process.exit(hardFail === 0 ? 0 : 1);

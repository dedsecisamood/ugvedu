#!/usr/bin/env node
/**
 * db:reset — wipes seeded demo rows and re-applies scripts/seed.sql
 * against the current Lovable Cloud database.
 *
 * Usage:
 *   npm run db:reset
 *
 * Requires DATABASE_URL (Postgres connection string) in the environment.
 * The seed script is fully idempotent: it deletes existing demo rows
 * (students, enrollments, grades, payments, notices, semester_results,
 * demo auth users) before re-inserting them, so it is safe to run
 * repeatedly. Runs in a single transaction — either everything applies
 * or nothing does.
 *
 * NOTE: On Lovable Cloud the database URL is not exposed to end users;
 * this script is intended for local development against a self-hosted
 * Postgres copy. On the hosted stack, re-run the seed by invoking the
 * same `scripts/seed.sql` through the Lovable Cloud SQL runner.
 */

import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const seedPath = resolve(__dirname, "seed.sql");

if (!existsSync(seedPath)) {
  console.error(`✖ Cannot find ${seedPath}`);
  process.exit(1);
}

const dbUrl = process.env.DATABASE_URL;
if (!dbUrl) {
  console.error("✖ DATABASE_URL is not set.");
  console.error("  Set it to your Postgres connection string, then re-run.");
  console.error(
    "  On Lovable Cloud, run scripts/seed.sql via the SQL runner instead.",
  );
  process.exit(1);
}

console.log("→ Applying scripts/seed.sql …");
const started = Date.now();
const result = spawnSync(
  "psql",
  ["--single-transaction", "-v", "ON_ERROR_STOP=1", "-f", seedPath, dbUrl],
  { stdio: "inherit" },
);
const elapsed = ((Date.now() - started) / 1000).toFixed(2);

if (result.status !== 0) {
  console.error(`✖ Seed failed after ${elapsed}s`);
  process.exit(result.status ?? 1);
}
console.log(`✓ Database reset & seeded in ${elapsed}s`);

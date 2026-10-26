import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const migrationPath = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  "002_application_settings.sql",
);
const migration = await readFile(migrationPath, "utf8");

test("application settings migration validates existing schema before DDL", () => {
  const begin = migration.indexOf("BEGIN;");
  const preflight = migration.indexOf("DO $preflight$");
  const createTable = migration.indexOf("CREATE TABLE IF NOT EXISTS application_settings");
  const commit = migration.lastIndexOf("COMMIT;");

  assert.ok(begin >= 0 && preflight > begin && createTable > preflight && commit > createTable);
  assert.ok(migration.includes("v_relkind <> 'r'"));
  assert.ok(migration.includes("v_actual_count <> 3"));
  assert.ok(migration.includes("setting_value jsonb NOT NULL"));
  assert.ok(migration.includes("setting_key text PRIMARY KEY"));
  assert.ok(migration.includes("updated_at timestamptz NOT NULL DEFAULT now()"));
  assert.doesNotMatch(migration, /\bDROP\s+(TABLE|INDEX|CONSTRAINT|SCHEMA)\b/i);
  assert.doesNotMatch(migration, /\bALTER\s+TABLE\b/i);
  assert.doesNotMatch(migration, /INSERT INTO application_settings/i);
});

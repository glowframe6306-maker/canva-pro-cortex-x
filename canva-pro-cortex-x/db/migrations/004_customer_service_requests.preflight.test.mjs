import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const migrationPath = path.join(path.dirname(fileURLToPath(import.meta.url)), "004_customer_service_requests.sql");
const migration = await readFile(migrationPath, "utf8");

test("customer service migration validates an existing relation before creating storage", () => {
  const begin = migration.indexOf("BEGIN;");
  const preflight = migration.indexOf("DO $preflight$");
  const createTable = migration.indexOf("CREATE TABLE IF NOT EXISTS customer_service_requests");
  const commit = migration.lastIndexOf("COMMIT;");

  assert.ok(begin >= 0 && preflight > begin && createTable > preflight && commit > createTable);
  assert.ok(migration.includes("v_relkind <> 'r'"));
  assert.ok(migration.includes("v_column_count <> 4"));
  assert.ok(migration.includes("v_constraint_count <> 3"));
  assert.ok(migration.includes("id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY"));
  assert.ok(migration.includes("request_id text NOT NULL UNIQUE"));
  assert.ok(migration.includes("request_data jsonb NOT NULL CHECK (jsonb_typeof(request_data) = 'object')"));
  assert.ok(migration.includes("created_at timestamptz NOT NULL DEFAULT now()"));
  assert.ok(migration.includes("ON customer_service_requests (created_at)"));
  assert.doesNotMatch(migration, /\bDROP\s+(TABLE|INDEX|CONSTRAINT|SCHEMA)\b/i);
  assert.doesNotMatch(migration, /\bALTER\s+TABLE\b/i);
  assert.doesNotMatch(migration, /\bINSERT\s+INTO\b/i);
});

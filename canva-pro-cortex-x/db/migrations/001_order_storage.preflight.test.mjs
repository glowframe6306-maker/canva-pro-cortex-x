import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const migrationPath = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  "001_order_storage.sql",
);
const migration = await readFile(migrationPath, "utf8");

test("migration preflight runs inside the transaction before DDL", () => {
  const begin = migration.indexOf("BEGIN;");
  const preflight = migration.indexOf("DO $preflight$");
  const firstDdl = migration.indexOf("CREATE TABLE IF NOT EXISTS");
  const commit = migration.lastIndexOf("COMMIT;");

  assert.ok(begin >= 0 && preflight > begin && firstDdl > preflight && commit > firstDdl);
  assert.match(migration, /COMMIT;\s*$/);
});

test("preflight checks table kind, exact column sets, types, nullability, and constraints", () => {
  for (const marker of [
    "c.relkind",
    "partially initialized",
    "unexpected column count",
    "format_type(a.atttypid, a.atttypmod)",
    "a.attnotnull = v_column.is_not_null",
    "unexpected constraint set",
    "pg_get_constraintdef(c.oid)",
    "c.convalidated",
    "pg_catalog.pg_get_expr(d.adbin, d.adrelid)",
    "a.attidentity <> v_column.identity_kind",
    "i.indisready",
  ]) {
    assert.ok(migration.includes(marker), `missing preflight marker: ${marker}`);
  }
});

test("constraint counts exclude PostgreSQL NOT NULL constraints", () => {
  assert.match(
    migration,
    /SELECT count\(\*\) INTO v_actual_count\s+FROM pg_catalog\.pg_constraint AS c\s+WHERE c\.conrelid = v_relation\s+AND c\.contype <> 'n';/,
  );
  assert.ok(migration.includes("v_actual_definition IS DISTINCT FROM v_constraint.normalized_definition"));
});

test("preflight validates the named trial-email expression index", () => {
  assert.ok(migration.includes("orders_free_trial_email_unique"));
  assert.ok(migration.includes("i.indisunique"));
  assert.ok(migration.includes("i.indisvalid"));
  assert.ok(migration.includes("i.indisready"));
  assert.ok(migration.includes("lowerbtrimcanva_email"));
});

test("migration does not contain destructive schema operations", () => {
  assert.doesNotMatch(migration, /\bDROP\s+(TABLE|INDEX|CONSTRAINT|SCHEMA)\b/i);
  assert.doesNotMatch(migration, /\bALTER\s+TABLE\b/i);
});

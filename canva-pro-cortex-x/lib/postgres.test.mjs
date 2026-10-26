import assert from "node:assert/strict";
import test from "node:test";

import { getPostgresClient } from "./postgres.ts";

test("PostgreSQL client reports missing database configuration without connecting", () => {
  delete process.env.POSTGRES_URL;
  delete process.env.DATABASE_URL;

  assert.throws(
    () => getPostgresClient(),
    (error) => error instanceof Error
      && error.message === "PostgreSQL is not configured. Set POSTGRES_URL or DATABASE_URL.",
  );
});

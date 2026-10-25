import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import {
  classifyTelegramResponse,
  getIdempotencyAction,
  getMissingTelegramConfiguration,
  getSafeOrderSubmissionDiagnostic,
  getTelegramErrorCode,
  hashOrderSubmission,
} from "./order-submission.ts";

const routePath = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
  "app",
  "api",
  "orders",
  "route.ts",
);
const orderRoute = await readFile(routePath, "utf8");

test("order submission hash is stable regardless of field order", () => {
  const first = hashOrderSubmission([["customerEmail", "buyer@example.test"], ["selectedPlan", "monthly"]]);
  const reordered = hashOrderSubmission([["selectedPlan", "monthly"], ["customerEmail", "buyer@example.test"]]);

  assert.equal(first, reordered);
});

test("client-generated timestamps do not break retries", () => {
  assert.equal(
    hashOrderSubmission([["customerEmail", "buyer@example.test"], ["orderDate", "2026-10-25T10:00:00.000Z"]]),
    hashOrderSubmission([["customerEmail", "buyer@example.test"], ["orderDate", "2026-10-25T10:01:00.000Z"]]),
  );
});

test("order submission hash includes receipt bytes and field values", () => {
  const fields = [["customerEmail", "buyer@example.test"]];

  assert.notEqual(hashOrderSubmission(fields, Buffer.from("receipt-a")), hashOrderSubmission(fields, Buffer.from("receipt-b")));
  assert.notEqual(hashOrderSubmission(fields), hashOrderSubmission([["customerEmail", "other@example.test"]]));
});

test("delivery idempotency only automatically retries known-unsent states", () => {
  assert.equal(getIdempotencyAction("PENDING"), "deliver");
  assert.equal(getIdempotencyAction("FAILED"), "deliver");
  assert.equal(getIdempotencyAction("SENT"), "already-delivered");
  assert.equal(getIdempotencyAction("SENDING"), "in-progress");
  assert.equal(getIdempotencyAction("UNKNOWN"), "manual-reconciliation");
});

test("ambiguous Telegram responses are never treated as retry-safe failures", () => {
  assert.equal(classifyTelegramResponse(true, { ok: true }), "SENT");
  assert.equal(classifyTelegramResponse(false, { ok: false }), "FAILED");
  assert.equal(classifyTelegramResponse(false, null), "UNKNOWN");
  assert.equal(classifyTelegramResponse(true, {}), "UNKNOWN");
});

test("order failure diagnostics distinguish database configuration and ENOENT without exposing messages", () => {
  const databaseError = new Error("PostgreSQL is not configured. Set POSTGRES_URL or DATABASE_URL.");
  const filesystemError = Object.assign(new Error("private path must not be logged"), { code: "ENOENT" });
  const unknownError = new Error("secret value must not be logged");

  assert.deepEqual(getSafeOrderSubmissionDiagnostic(databaseError), {
    category: "DATABASE_CONFIGURATION",
    errorName: "Error",
  });
  assert.deepEqual(getSafeOrderSubmissionDiagnostic(filesystemError), {
    category: "FILESYSTEM",
    errorName: "Error",
    code: "ENOENT",
  });
  assert.deepEqual(getSafeOrderSubmissionDiagnostic(unknownError), {
    category: "UNKNOWN",
    errorName: "Error",
  });
});

test("PostgreSQL failures are categorized using SQLSTATE only", () => {
  const databaseError = Object.assign(new Error("sensitive database detail"), { code: "42P01" });

  assert.deepEqual(getSafeOrderSubmissionDiagnostic(databaseError), {
    category: "DATABASE",
    errorName: "Error",
    code: "42P01",
  });
});

test("Telegram diagnostics retain numeric error codes without exposing response descriptions", () => {
  assert.equal(getTelegramErrorCode({ error_code: 400, description: "private response detail" }), 400);
  assert.equal(getTelegramErrorCode({ error_code: "400" }), undefined);
  assert.equal(getTelegramErrorCode(null), undefined);
});

test("missing Telegram configuration reports only names and is specific to the delivery type", () => {
  assert.deepEqual(getMissingTelegramConfiguration(false, false, true), ["TELEGRAM_BOT_TOKEN"]);
  assert.deepEqual(getMissingTelegramConfiguration(true, true, false), ["FREE_TRIAL_CHAT_ID"]);
  assert.deepEqual(getMissingTelegramConfiguration(false, true, true), []);
});

test("order persistence and idempotency lookup happen before Telegram configuration is required", () => {
  assert.ok(orderRoute.indexOf("getOrderByIdempotencyKey(idempotencyKey)") < orderRoute.indexOf("getMissingTelegramConfiguration("));
  assert.ok(orderRoute.indexOf("createOrderIdempotently(storedOrder") < orderRoute.indexOf("getMissingTelegramConfiguration("));
  assert.ok(orderRoute.includes('getIdempotencyAction(existingSubmission.telegramDeliveryStatus)'));
});

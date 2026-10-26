import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import {
  classifyTelegramResponse,
  getMissingOrderFields,
  getIdempotencyAction,
  getMissingTelegramConfiguration,
  getSafeOrderSubmissionDiagnostic,
  getTelegramErrorCode,
  hashOrderSubmission,
  isOrderSubmissionDelivered,
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

test("order validation rejects missing paid and trial fields before persistence", () => {
  assert.deepEqual(
    getMissingOrderFields(false, { customerName: "Buyer", customerEmail: "buyer@example.test" }),
    ["customerPhone", "selectedPlan", "planPrice", "paymentMethod", "paymentDetails", "orderDate"],
  );
  assert.deepEqual(
    getMissingOrderFields(true, { customerName: "Buyer", customerEmail: "buyer@example.test" }),
    ["customerPhone", "canvaEmail"],
  );
  assert.deepEqual(
    getMissingOrderFields(false, {
      customerName: "Buyer",
      customerPhone: "123",
      customerEmail: "buyer@example.test",
      selectedPlan: "monthly",
      planPrice: "500",
      paymentMethod: "Bank Transfer",
      paymentDetails: "reference",
      orderDate: "2026-10-25T10:00:00.000Z",
    }),
    [],
  );
  assert.deepEqual(
    getMissingOrderFields(true, {
      customerName: "Buyer",
      customerEmail: "buyer@example.test",
      customerPhone: "123",
      canvaEmail: "buyer@canva.example",
    }),
    [],
  );
});

test("delivery idempotency only automatically retries known-unsent states", () => {
  assert.equal(getIdempotencyAction("PENDING"), "deliver");
  assert.equal(getIdempotencyAction("FAILED"), "deliver");
  assert.equal(getIdempotencyAction("SENT"), "already-delivered");
  assert.equal(getIdempotencyAction("SENDING"), "in-progress");
  assert.equal(getIdempotencyAction("UNKNOWN"), "manual-reconciliation");
});

test("successful order responses require confirmed required Telegram deliveries", () => {
  assert.equal(isOrderSubmissionDelivered(true, "SENT", "PENDING"), true);
  assert.equal(isOrderSubmissionDelivered(false, "SENT", "SENT"), true);
  assert.equal(isOrderSubmissionDelivered(false, "SENT", "FAILED"), false);
  assert.equal(isOrderSubmissionDelivered(false, "FAILED", "SENT"), false);
  assert.equal(isOrderSubmissionDelivered(false, "UNKNOWN", "UNKNOWN"), false);
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

  const missingSettingsError = Object.assign(new Error("private settings detail"), {
    name: "MissingApplicationSettingError",
  });
  assert.deepEqual(getSafeOrderSubmissionDiagnostic(missingSettingsError), {
    category: "APPLICATION_CONFIGURATION",
    errorName: "MissingApplicationSettingError",
  });
  const invalidSettingsError = Object.assign(new Error("private stored-value detail"), {
    name: "InvalidApplicationSettingError",
  });
  assert.deepEqual(getSafeOrderSubmissionDiagnostic(invalidSettingsError), {
    category: "APPLICATION_CONFIGURATION",
    errorName: "InvalidApplicationSettingError",
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
  const validation = orderRoute.indexOf("getMissingOrderFields(isTrial, body)");
  assert.ok(orderRoute.indexOf("getOrderByIdempotencyKey(idempotencyKey)") < orderRoute.indexOf("getMissingTelegramConfiguration("));
  assert.ok(orderRoute.indexOf("createOrderIdempotently(storedOrder") < orderRoute.indexOf("getMissingTelegramConfiguration("));
  assert.ok(validation >= 0 && validation < orderRoute.indexOf("getOrderByIdempotencyKey(idempotencyKey)"));
  assert.match(orderRoute, /status: 400/);
  assert.match(orderRoute, /isOrderSubmissionDelivered\(/);
  assert.ok(orderRoute.includes('getIdempotencyAction(existingSubmission.telegramDeliveryStatus)'));
});

test("orders and receipts are persisted before Telegram delivery is attempted", () => {
  const orderPersisted = orderRoute.indexOf("createOrderIdempotently(storedOrder");
  const receiptPersisted = orderRoute.indexOf("await saveReceiptFile({");
  const telegramAttempted = orderRoute.indexOf("telegramResponse = await fetch");
  const telegramConfirmed = orderRoute.indexOf('setDeliveryStatus(order.orderId, "telegram", telegramOutcome)');

  assert.ok(orderPersisted >= 0);
  assert.ok(receiptPersisted > orderPersisted);
  assert.ok(telegramAttempted > receiptPersisted);
  assert.ok(telegramConfirmed > telegramAttempted);
  assert.ok(orderRoute.lastIndexOf("return buildSuccessResponse(order, isTrial)") > telegramConfirmed);
});

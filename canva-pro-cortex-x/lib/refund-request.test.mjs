import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import {
  createRefundStore,
} from "./refund-store.ts";
import { sendRefundTelegramMessage } from "./refund-telegram.ts";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const route = await readFile(path.join(root, "app", "api", "refunds", "route.ts"), "utf8");
const storeSource = await readFile(path.join(root, "lib", "refund-store.ts"), "utf8");
const telegram = await readFile(path.join(root, "lib", "refund-telegram.ts"), "utf8");
const migration = await readFile(path.join(root, "db", "migrations", "003_refund_request_storage.sql"), "utf8");

const request = {
  refundRequestId: "REF-2026-000001",
  refundCode: "RFD-ABC123",
  orderNumber: "MI-20261027-0001",
  referenceNumber: "MI-CP-000001",
  customerName: "Example Customer",
  email: "customer@example.test",
  whatsapp: "+94770000000",
  canvaEmail: "canva@example.test",
  refundReason: "Other",
  additionalDetails: "Test detail",
  submittedAt: "2026-10-27T00:00:00.000Z",
  status: "PENDING",
  telegramNotificationStatus: "PENDING",
  nextMessageStatus: "PENDING",
};

function fakeRow(overrides = {}) {
  return {
    request_data: request,
    status: "PENDING",
    telegram_notification_status: "PENDING",
    next_message_status: "PENDING",
    ...overrides,
  };
}

test("valid refund request is persisted in PostgreSQL without filesystem storage", async () => {
  let captured;
  const store = createRefundStore({
    async query(sql, params) {
      captured = { sql, params };
      return [fakeRow()];
    },
  });
  const saved = await store.saveRefundRequest(request);

  assert.equal(saved.created, true);
  assert.equal(saved.request.refundRequestId, request.refundRequestId);
  assert.equal(saved.request.status, "PENDING");
  assert.match(captured.sql, /INSERT INTO refund_requests/);
  assert.deepEqual(captured.params.slice(0, 3), [request.refundRequestId, request.orderNumber, "PENDING"]);
  assert.doesNotMatch(storeSource, /node:fs|DEFAULT_PAYMENTS_DIR|ensureRefundDatabase/);
});

test("duplicate active order reuses the existing refund record", async () => {
  const statements = [];
  const store = createRefundStore({
    async query(sql) {
      statements.push(sql);
      return statements.length === 1 ? [] : [fakeRow({ telegram_notification_status: "FAILED" })];
    },
  });
  const saved = await store.saveRefundRequest(request);

  assert.equal(saved.created, false);
  assert.equal(saved.request.refundRequestId, request.refundRequestId);
  assert.equal(saved.request.telegramNotificationStatus, "FAILED");
  assert.equal(statements.length, 2);
  assert.match(statements[0], /ON CONFLICT DO NOTHING/);
  assert.match(statements[1], /status IN \('PENDING', 'UNDER_REVIEW', 'APPROVED'\)/);
});

test("persistence failures propagate instead of creating a success-shaped response", async () => {
  const store = createRefundStore({
    async query() {
      throw Object.assign(new Error("private database detail"), { code: "42P01" });
    },
  });
  await assert.rejects(
    store.saveRefundRequest(request),
    /private database detail/,
  );
  assert.match(route, /error: "Unable to process refund request\."/);
  assert.match(route, /ok: false,[\s\S]*?REFUND REQUEST COULD NOT BE SENT/);
});

test("database claims prevent concurrent duplicate Telegram notifications", async () => {
  let claimSql = "";
  let statusSql = "";
  const store = createRefundStore({
    async query(sql) {
      if (sql.includes("jsonb_set")) statusSql = sql;
      else claimSql = sql;
      return [];
    },
  });
  const claimed = await store.claimRefundDelivery(request.refundRequestId, "telegram");
  assert.equal(claimed, false);
  assert.match(claimSql, /telegram_notification_status IN \('PENDING', 'FAILED'\)/);
  assert.doesNotMatch(claimSql, /UNKNOWN/);

  await store.setRefundDeliveryStatus(request.refundRequestId, "telegram", "SENT");
  assert.match(statusSql, /request_data = jsonb_set/);
  assert.match(statusSql, /telegram_notification_status = \$2/);
});

test("refund Telegram success is confirmed only by an affirmative mocked API response", async () => {
  let requestDetails;
  const result = await sendRefundTelegramMessage(
    async (url, options) => {
      requestDetails = { url, options };
      return Response.json({ ok: true }, { status: 200 });
    },
    "mock-token",
    "mock-chat",
    "Refund request",
  );
  assert.deepEqual(result, { status: "SENT", httpStatus: 200 });
  assert.equal(requestDetails.url, "https://api.telegram.org/botmock-token/sendMessage");
  assert.deepEqual(JSON.parse(requestDetails.options.body), {
    chat_id: "mock-chat",
    text: "Refund request",
    parse_mode: "MarkdownV2",
    disable_web_page_preview: true,
  });
});

test("Telegram rejection and network ambiguity are never reported as delivered", async () => {
  const rejected = await sendRefundTelegramMessage(
    async () => Response.json({ ok: false, error_code: 403, description: "private rejection" }, { status: 403 }),
    "mock-token",
    "mock-chat",
    "Refund request",
  );
  assert.deepEqual(rejected, { status: "FAILED", httpStatus: 403, errorCode: 403 });

  const unknown = await sendRefundTelegramMessage(
    async () => { throw new TypeError("private network detail"); },
    "mock-token",
    "mock-chat",
    "Refund request",
  );
  assert.deepEqual(unknown, { status: "UNKNOWN", errorName: "TypeError" });
  assert.doesNotMatch(JSON.stringify(unknown), /private network detail|private rejection/);

  const malformed = await sendRefundTelegramMessage(
    async () => new Response("not-json", { status: 200 }),
    "mock-token",
    "mock-chat",
    "Refund request",
  );
  assert.deepEqual(malformed, { status: "UNKNOWN", errorName: "SyntaxError" });
});

test("refund request validation and eligibility checks happen before persistence", () => {
  const validation = route.indexOf("if (!orderNumber)");
  const orderLookup = route.indexOf("getOrderByOrderNumber(orderNumber)");
  const eligibility = route.indexOf("if (submittedAt > refundEligibleUntil)");
  const persistence = route.indexOf("saveRefundRequest(refundRequest)");
  assert.ok(validation >= 0 && validation < orderLookup);
  assert.ok(orderLookup < eligibility);
  assert.ok(eligibility < persistence);
  assert.match(route, /REFUND_BOT_TOKEN = process\.env\.REFUND_BOT_TOKEN/);
  assert.match(route, /REFUND_CHAT_ID = process\.env\.REFUND_CHAT_ID/);
});

test("migration enforces one active refund per order and persistent delivery state", () => {
  assert.match(migration, /refund_request_id text NOT NULL UNIQUE/);
  assert.match(migration, /telegram_notification_status text NOT NULL DEFAULT 'PENDING'/);
  assert.match(migration, /next_message_status text NOT NULL DEFAULT 'PENDING'/);
  assert.match(migration, /ON refund_requests \(order_number\)[\s\S]*?WHERE status IN \('PENDING', 'UNDER_REVIEW', 'APPROVED'\)/);
  assert.doesNotMatch(migration, /\b(DROP|TRUNCATE|DELETE)\b/i);
});

test("refunds use their dedicated configured Telegram bot and destination", () => {
  assert.match(telegram, /https:\/\/api\.telegram\.org\/bot\$\{botToken\}\/sendMessage/);
  assert.match(route, /REFUND_CHAT_ID/);
  assert.doesNotMatch(route, /TELEGRAM_BOT_TOKEN/);
});

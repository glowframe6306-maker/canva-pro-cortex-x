import assert from "node:assert/strict";
import test from "node:test";

import {
  createCustomerServiceSubmissionHandler,
  CustomerServiceOperationError,
} from "./customer-service-submission.ts";

const requestBody = {
  fullName: "Test User",
  whatsappNumber: "+123456789",
  email: "test@example.test",
  canvaEmail: "canva@example.test",
  reason: "Other",
  message: "Test-only request",
};

function createDependencies(overrides = {}) {
  const events = [];
  const dependencies = {
    botToken: "mock-token",
    chatId: "mock-chat",
    timeZone: "UTC",
    now: () => new Date("2026-03-04T00:00:00.000Z"),
    formatDateTime: () => ({ date: "2026-03-04", time: "00:00" }),
    async generateRequestId() {
      events.push("id");
      return "CS-20260304-0001";
    },
    async sendTelegram(token, chatId, text) {
      events.push("telegram");
      events.push({ token, chatId, text });
      return { httpOk: true, payload: { ok: true } };
    },
    async saveRequest(request) {
      events.push("save");
      events.push(request);
    },
    ...overrides,
  };
  return { dependencies, events, submit: createCustomerServiceSubmissionHandler(dependencies) };
}

test("customer service submission preserves the response and persists only after Telegram accepts", async () => {
  const { events, submit } = createDependencies();

  const response = await submit(requestBody);

  assert.deepEqual(response, {
    status: 200,
    body: {
      ok: true,
      requestId: "CS-20260304-0001",
      createdDate: "2026-03-04",
      createdTime: "00:00",
      status: "REQUEST_SENT",
    },
  });
  assert.deepEqual(events.filter((event) => typeof event === "string"), ["id", "telegram", "save"]);
  const telegramCall = events.find((event) => typeof event === "object" && "token" in event);
  assert.equal(telegramCall.token, "mock-token");
  assert.equal(telegramCall.chatId, "mock-chat");
  assert.match(telegramCall.text, /Test User/);
  assert.equal(events.at(-1).telegramSent, true);
});

test("customer service validation failures do not allocate, send, or persist", async () => {
  const { events, submit } = createDependencies();

  const response = await submit({ ...requestBody, email: "invalid" });

  assert.equal(response.status, 400);
  assert.deepEqual(response.body, { ok: false, error: "Please enter a valid email address." });
  assert.deepEqual(events, []);
});

test("Telegram rejection returns the existing failure contract and does not persist", async () => {
  const { events, submit } = createDependencies({
    async sendTelegram() {
      events.push("telegram");
      return { httpOk: false, payload: { ok: false, description: "Rejected by test mock" } };
    },
  });

  const response = await submit(requestBody);

  assert.equal(response.status, 502);
  assert.deepEqual(response.body, {
    ok: false,
    error: "Unable to send your request right now. Please try again.",
  });
  assert.deepEqual(events.filter((event) => typeof event === "string"), ["id", "telegram"]);
  assert.equal(response.log.category, "TELEGRAM");
});

test("request-ID and persistence failures are categorized separately from Telegram", async () => {
  const idFailure = createDependencies({
    async generateRequestId() {
      throw new Error("database unavailable");
    },
  });
  await assert.rejects(idFailure.submit(requestBody), (error) =>
    error instanceof CustomerServiceOperationError && error.category === "PERSISTENCE",
  );

  const saveFailure = createDependencies({
    async saveRequest() {
      throw new Error("database unavailable");
    },
  });
  await assert.rejects(saveFailure.submit(requestBody), (error) =>
    error instanceof CustomerServiceOperationError && error.category === "PERSISTENCE",
  );
});

test("missing Telegram configuration keeps the existing 503 response", async () => {
  const { events, submit } = createDependencies({ botToken: undefined });

  const response = await submit(requestBody);

  assert.equal(response.status, 503);
  assert.deepEqual(response.body, {
    ok: false,
    error: "Unable to send your request right now. Please try again.",
  });
  assert.deepEqual(events, []);
});

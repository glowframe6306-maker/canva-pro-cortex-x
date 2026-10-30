import assert from "node:assert/strict";
import test from "node:test";

import {
  createCustomerServiceSubmissionHandler,
  CustomerServiceOperationError,
  getCustomerServiceErrorDiagnostic,
  logCustomerServiceFailure,
} from "./customer-service-submission.ts";

const requestBody = {
  fullName: "Test User",
  whatsappNumber: "+123456789",
  email: "test@example.test",
  canvaEmail: "canva@example.test",
  reason: "Other",
  message: "Test-only request",
};

class NeonDbError extends Error {}

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
    error instanceof CustomerServiceOperationError && error.category === "PERSISTENCE" && error.stage === "REQUEST_ID",
  );

  const saveFailure = createDependencies({
    async saveRequest() {
      throw new Error("database unavailable");
    },
  });
  await assert.rejects(saveFailure.submit(requestBody), (error) =>
    error instanceof CustomerServiceOperationError && error.category === "PERSISTENCE" && error.stage === "PERSISTENCE",
  );
});

test("database error diagnostics expose SQLSTATE and stage without logging error messages or request data", () => {
  const databaseError = Object.assign(
    new NeonDbError("email customer@example.test, password secret-value"),
    { code: "23502", cause: Object.assign(new Error("private underlying details"), { code: "XX000" }) },
  );
  const error = new CustomerServiceOperationError("PERSISTENCE", databaseError, "PERSISTENCE");

  const diagnostic = getCustomerServiceErrorDiagnostic(error);

  assert.deepEqual(diagnostic, {
    category: "PERSISTENCE",
    stage: "PERSISTENCE",
    errorClass: "NeonDbError",
    sqlState: "23502",
  });
  assert.doesNotMatch(JSON.stringify(diagnostic), /customer@example\.test|secret-value|private underlying details/);
});

test("customer-service diagnostics log only fixed metadata for a wrapped request-ID failure", async () => {
  const requestId = "CS-private-request-id";
  const cause = Object.assign(
    new NeonDbError(`Sensitive details: ${JSON.stringify({ requestId, ...requestBody })}; private-message-sentinel`),
    { code: "23502", stack: `private stack ${JSON.stringify(requestBody)}` },
  );
  const { submit } = createDependencies({
    async generateRequestId() {
      throw cause;
    },
  });
  let wrapped;
  await assert.rejects(submit(requestBody), (error) => {
    wrapped = error;
    return error instanceof CustomerServiceOperationError
      && error.category === "PERSISTENCE"
      && error.stage === "REQUEST_ID";
  });
  assert.equal(wrapped.cause, cause);

  const originalConsoleError = console.error;
  const loggedArguments = [];
  console.error = (...args) => loggedArguments.push(args);

  try {
    logCustomerServiceFailure(wrapped);
  } finally {
    console.error = originalConsoleError;
  }

  assert.equal(loggedArguments.length, 1);
  assert.equal(loggedArguments[0][0], "CUSTOMER_SERVICE_FAILURE");
  assert.deepEqual(loggedArguments[0][1], {
    category: "PERSISTENCE",
    stage: "REQUEST_ID",
    errorClass: "NeonDbError",
    sqlState: "23502",
  });
  for (const sensitiveValue of [requestId, ...Object.values(requestBody), "private-message-sentinel", "private stack"]) {
    assert.equal(JSON.stringify(loggedArguments).includes(sensitiveValue), false);
  }
});
test("request diagnostics reject unsafe error codes and identify the request-ID stage", () => {
  const cause = Object.assign(new Error("private"), { code: "NOT A SQLSTATE" });
  const error = new CustomerServiceOperationError("PERSISTENCE", cause, "REQUEST_ID");

  assert.deepEqual(getCustomerServiceErrorDiagnostic(error), {
    category: "PERSISTENCE",
    stage: "REQUEST_ID",
    errorClass: "Error",
  });
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

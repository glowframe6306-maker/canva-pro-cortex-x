import assert from "node:assert/strict";
import test from "node:test";

import { createCustomerServiceStore, CustomerServiceRequestIdPhaseError } from "./customer-service-store.ts";
import {
  CustomerServiceOperationError,
  getCustomerServiceErrorDiagnostic,
} from "./customer-service-submission.ts";

const requestDate = new Date("2026-03-04T00:00:00.000Z");

async function assertRequestIdPhase(promise, phase, causeClass, sqlState) {
  await assert.rejects(promise, (error) => {
    assert.ok(error instanceof CustomerServiceRequestIdPhaseError);
    assert.equal(error.cause.constructor, causeClass);
    const diagnostic = getCustomerServiceErrorDiagnostic(
      new CustomerServiceOperationError("PERSISTENCE", error, "REQUEST_ID"),
    );
    assert.deepEqual(diagnostic, {
      category: "PERSISTENCE",
      stage: "REQUEST_ID",
      errorClass: causeClass.name,
      phase,
      ...(sqlState ? { sqlState } : {}),
    });
    return true;
  });
}

test("customer service request IDs use the PostgreSQL identity sequence and configured date zone", async () => {
  const calls = [];
  const store = createCustomerServiceStore(() => ({
    async query(statement, parameters) {
      calls.push({ statement, parameters });
      return [{ next_id: "27" }];
    },
  }));

  const requestId = await store.generateRequestId(requestDate, "Asia/Colombo");

  assert.equal(requestId, "CS-20260304-0027");
  assert.match(calls[0].statement, /nextval\(pg_get_serial_sequence\('customer_service_requests', 'id'\)\)/);
});

test("request-ID generation reports the database-client creation phase", async () => {
  const cause = new RangeError("private client error");
  const store = createCustomerServiceStore(() => {
    throw cause;
  });

  await assertRequestIdPhase(store.generateRequestId(requestDate, "UTC"), "DATABASE_CLIENT", RangeError);
});

test("request-ID generation reports the sequence-query phase", async () => {
  const cause = Object.assign(new RangeError("private query error"), { code: "23505" });
  const store = createCustomerServiceStore(() => ({
    async query() {
      throw cause;
    },
  }));

  await assertRequestIdPhase(
    store.generateRequestId(requestDate, "UTC"),
    "SEQUENCE_QUERY",
    RangeError,
    "23505",
  );
});

test("request-ID generation reports invalid sequence results separately", async () => {
  const store = createCustomerServiceStore(() => ({
    async query() {
      return [];
    },
  }));

  await assertRequestIdPhase(store.generateRequestId(requestDate, "UTC"), "SEQUENCE_RESULT", Error);
});

test("request-ID generation reports the date-format phase", async () => {
  const store = createCustomerServiceStore(() => ({
    async query() {
      return [{ next_id: "27" }];
    },
  }));

  await assertRequestIdPhase(
    store.generateRequestId(requestDate, "Invalid/Timezone"),
    "DATE_FORMAT",
    RangeError,
  );
});

test("customer service requests are persisted as JSON with their unique request ID and timestamp", async () => {
  const request = {
    requestId: "CS-20260304-0027",
    fullName: "Test User",
    whatsappNumber: "+123456789",
    email: "test@example.test",
    canvaEmail: "canva@example.test",
    reason: "Other",
    message: "Test-only request",
    createdAt: "2026-03-04T00:00:00.000Z",
    createdDate: "2026-03-04",
    createdTime: "05:30",
    status: "REQUEST_SENT",
    telegramSent: true,
  };
  let call;
  const store = createCustomerServiceStore(() => ({
    async query(statement, parameters) {
      call = { statement, parameters };
      return [{ request_id: request.requestId }];
    },
  }));

  await store.saveRequest(request);

  assert.match(call.statement, /INSERT INTO customer_service_requests/);
  assert.match(call.statement, /request_data, created_at/);
  assert.deepEqual(call.parameters, [request.requestId, JSON.stringify(request), request.createdAt]);
});

test("customer service request reads return rows in database order", async () => {
  const request = { requestId: "CS-20260304-0001", status: "REQUEST_SENT" };
  let statement;
  const store = createCustomerServiceStore(() => ({
    async query(query) {
      statement = query;
      return [{ request_data: request }];
    },
  }));

  assert.deepEqual(await store.getRequests(), [request]);
  assert.match(statement, /ORDER BY created_at ASC/);
});

test("customer service storage rejects missing sequence results and empty insert results", async () => {
  const store = createCustomerServiceStore(() => ({
    async query(statement) {
      return statement.startsWith("SELECT") ? [] : [];
    },
  }));

  await assert.rejects(
    store.generateRequestId(requestDate, "UTC"),
    (error) => error instanceof CustomerServiceRequestIdPhaseError
      && error.phase === "SEQUENCE_RESULT"
      && error.cause.message === "Unable to allocate a customer service request ID.",
  );
  await assert.rejects(
    store.saveRequest({ requestId: "CS-20260304-0001", createdAt: new Date().toISOString() }),
    /was not persisted/,
  );
});

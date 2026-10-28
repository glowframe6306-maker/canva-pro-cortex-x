import assert from "node:assert/strict";
import test from "node:test";

import { createCustomerServiceStore } from "./customer-service-store.ts";

test("customer service request IDs use the PostgreSQL identity sequence and configured date zone", async () => {
  const calls = [];
  const store = createCustomerServiceStore({
    async query(statement, parameters) {
      calls.push({ statement, parameters });
      return [{ next_id: "27" }];
    },
  });

  const requestId = await store.generateRequestId(new Date("2026-03-04T00:00:00.000Z"), "Asia/Colombo");

  assert.equal(requestId, "CS-20260304-0027");
  assert.match(calls[0].statement, /nextval\(pg_get_serial_sequence\('customer_service_requests', 'id'\)\)/);
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
  const store = createCustomerServiceStore({
    async query(statement, parameters) {
      call = { statement, parameters };
      return [{ request_id: request.requestId }];
    },
  });

  await store.saveRequest(request);

  assert.match(call.statement, /INSERT INTO customer_service_requests/);
  assert.match(call.statement, /request_data, created_at/);
  assert.deepEqual(call.parameters, [request.requestId, JSON.stringify(request), request.createdAt]);
});

test("customer service request reads return rows in database order", async () => {
  const request = { requestId: "CS-20260304-0001", status: "REQUEST_SENT" };
  let statement;
  const store = createCustomerServiceStore({
    async query(query) {
      statement = query;
      return [{ request_data: request }];
    },
  });

  assert.deepEqual(await store.getRequests(), [request]);
  assert.match(statement, /ORDER BY created_at ASC/);
});

test("customer service storage rejects missing sequence results and empty insert results", async () => {
  const store = createCustomerServiceStore({
    async query(statement) {
      return statement.startsWith("SELECT") ? [] : [];
    },
  });

  await assert.rejects(
    store.generateRequestId(new Date("2026-03-04T00:00:00.000Z"), "UTC"),
    /Unable to allocate a customer service request ID/,
  );
  await assert.rejects(
    store.saveRequest({ requestId: "CS-20260304-0001", createdAt: new Date().toISOString() }),
    /was not persisted/,
  );
});

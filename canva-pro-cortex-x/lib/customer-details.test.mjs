import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { validateCustomerDetails } from "./customer-details.ts";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const routePath = path.join(root, "app", "api", "orders", "route.ts");
const routeSource = await readFile(routePath, "utf8");

const validInput = {
  fullName: "  Buyer Name  ",
  email: "  Buyer@Example.test ",
  whatsapp: " 077 123 4567 ",
};

test("customer validation rejects missing and whitespace-only full names", () => {
  for (const fullName of ["", "   ", "\t\n"]) {
    const result = validateCustomerDetails({ ...validInput, fullName });
    assert.equal(result.ok, false);
    assert.equal(result.errors.fullName, "Please enter your full name.");
  }
});

test("customer validation normalizes Sri Lankan national and international numbers", () => {
  for (const [whatsapp, expected] of [
    ["077 123 4567", "+94771234567"],
    ["+94 (77) 123-4567", "+94771234567"],
    ["0094 77 123 4567", "+94771234567"],
    ["+44 7911 123456", "+447911123456"],
    ["+1 (202) 555-0123", "+12025550123"],
  ]) {
    const result = validateCustomerDetails({ ...validInput, whatsapp });
    assert.equal(result.ok, true, whatsapp);
    assert.equal(result.whatsapp, expected, whatsapp);
  }
});

test("customer validation rejects implausible numbers and unrecognized calling codes", () => {
  for (const whatsapp of ["123", "+999123456789", "+94 77 123", "+44 0000 123456", "++94771234567"]) {
    const result = validateCustomerDetails({ ...validInput, whatsapp });
    assert.equal(result.ok, false, whatsapp);
    assert.match(result.errors.whatsapp, /valid WhatsApp number/);
  }
});

test("customer validation requires a WhatsApp number", () => {
  for (const whatsapp of ["", "   "]) {
    const result = validateCustomerDetails({ ...validInput, whatsapp });
    assert.equal(result.ok, false);
    assert.equal(result.errors.whatsapp, "Please enter your WhatsApp number.");
  }
});

test("customer validation requires a well-formed email and normalizes its case and whitespace", () => {
  const valid = validateCustomerDetails(validInput);
  assert.equal(valid.ok, true);
  assert.equal(valid.fullName, "Buyer Name");
  assert.equal(valid.email, "buyer@example.test");

  for (const email of ["", "   ", "buyer@", "buyer.example.test", "buyer..name@example.test", "buyer @example.test"]) {
    const result = validateCustomerDetails({ ...validInput, email });
    assert.equal(result.ok, false, email);
    assert.match(result.errors.email, /email address/);
  }
});

test("server validates customer details before idempotency lookup or order persistence", () => {
  const validationIndex = routeSource.indexOf("validateCustomerDetails({");
  const idempotencyIndex = routeSource.indexOf("getOrderByIdempotencyKey(idempotencyKey)");
  const persistenceIndex = routeSource.indexOf("createOrderIdempotently(storedOrder");

  assert.ok(validationIndex >= 0);
  assert.ok(validationIndex < idempotencyIndex);
  assert.ok(validationIndex < persistenceIndex);
  assert.match(routeSource, /customerName = customerDetails\.fullName/);
  assert.match(routeSource, /customerEmail = customerDetails\.email/);
  assert.match(routeSource, /customerPhone = customerDetails\.whatsapp/);
  assert.match(routeSource, /fieldErrors: customerDetails\.errors/);
});

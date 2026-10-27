import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import {
  validateCustomerDetails,
  validateCustomerDetailsAndContinue,
} from "./customer-details.ts";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const routePath = path.join(root, "app", "api", "orders", "route.ts");
const clientPath = path.join(root, "components", "micortex-app.tsx");
const routeSource = await readFile(routePath, "utf8");
const clientSource = await readFile(clientPath, "utf8");

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

test("invalid customer details block checkout continuation", () => {
  let continued = false;
  const result = validateCustomerDetailsAndContinue(
    { ...validInput, email: "not-an-email" },
    () => {
      continued = true;
    },
  );

  assert.equal(result.ok, false);
  assert.equal(result.errors.email, "Please enter a valid email address.");
  assert.equal(continued, false);
});

test("valid details normalize before allowing checkout continuation", () => {
  let continuedWith;
  const result = validateCustomerDetailsAndContinue(validInput, (details) => {
    continuedWith = details;
  });

  assert.equal(result.ok, true);
  assert.deepEqual(continuedWith, {
    ok: true,
    fullName: "Buyer Name",
    email: "buyer@example.test",
    whatsapp: "+94771234567",
  });
});

test("revalidating after correcting invalid details allows continuation", () => {
  let continued = false;
  const firstAttempt = validateCustomerDetailsAndContinue(
    { ...validInput, whatsapp: "123" },
    () => {
      continued = true;
    },
  );
  assert.equal(firstAttempt.ok, false);
  assert.equal(continued, false);

  const secondAttempt = validateCustomerDetailsAndContinue(validInput, () => {
    continued = true;
  });
  assert.equal(secondAttempt.ok, true);
  assert.equal(continued, true);
});

test("details NEXT button and Enter key use the same validated navigation handler", () => {
  assert.match(clientSource, /onClick=\{handleCustomerDetailsNext\}/);
  assert.match(clientSource, /event\.key === "Enter" && event\.target instanceof HTMLInputElement/);
  assert.match(clientSource, /event\.preventDefault\(\);\s*handleCustomerDetailsNext\(\);/);
  assert.match(clientSource, /validateCustomerDetailsAndContinue\(orderForm/);
  assert.match(clientSource, /setStep\("payment"\)/);
});

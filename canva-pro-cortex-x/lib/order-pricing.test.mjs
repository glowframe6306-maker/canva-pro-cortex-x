import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import ts from "typescript";

import { getOrderPricingFields } from "./order-pricing.ts";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const routePath = path.join(root, "app", "api", "orders", "route.ts");
const clientPath = path.join(root, "components", "micortex-app.tsx");
const telegramPath = path.join(root, "lib", "telegram-messages.ts");
const [orderRoute, client, telegramSource] = await Promise.all([
  readFile(routePath, "utf8"),
  readFile(clientPath, "utf8"),
  readFile(telegramPath, "utf8"),
]);

function loadTelegramMessages() {
  const compiled = ts.transpileModule(telegramSource, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  const loaded = { exports: {} };
  const mocks = {
    "@/lib/expiry-calculator": {
      getPlanDurationDisplay: () => "1 month",
      getDateTimeInTimezone: () => ({ date: "2026-10-27", time: "12:00:00" }),
    },
  };
  new Function("require", "module", "exports", compiled)(
    (name) => {
      if (Object.hasOwn(mocks, name)) return mocks[name];
      throw new Error(`Unexpected dependency in telegram message test: ${name}`);
    },
    loaded,
    loaded.exports,
  );
  return loaded.exports;
}

const { buildNewOrderMessage } = loadTelegramMessages();

function pricing(overrides = {}) {
  return {
    planId: "monthly",
    mainPrice: 1000,
    promotionPrice: 1000,
    promotionDiscount: 0,
    promoCode: null,
    promoDiscount: 0,
    finalPrice: 1000,
    hasActivePromotion: false,
    discountStacking: false,
    priceSource: "main",
    ...overrides,
  };
}

function telegramOrder(pricingState, overrides = {}) {
  return {
    orderId: "ORDER-TEST",
    selectedPlan: "monthly",
    customerName: "Test Buyer",
    customerEmail: "buyer@example.test",
    customerPhone: "000",
    canvaEmail: "buyer@canva.example",
    paymentDetails: "TEST-REFERENCE",
    receiptFilename: "receipt.png",
    paymentMethod: "Bank Transfer",
    paymentStatus: "PENDING",
    createdDate: "2026-10-27",
    createdTime: "12:00:00",
    expiryDate: "2026-11-27",
    expiryTime: "12:00:00",
    ...getOrderPricingFields(pricingState),
    ...overrides,
  };
}

test("checkout submits the promo code and server pricing ignores client totals", () => {
  assert.match(client, /formData\.append\("promoCode", customerPromo\?\.code \|\| ""\)/);
  assert.match(orderRoute, /resolvePlanPricing\(selectedPlanKey, enteredPromoCode \|\| undefined\)/);
  assert.match(orderRoute, /\.\.\.getOrderPricingFields\(priceState\)/);
  assert.doesNotMatch(orderRoute, /body\.planPrice/);
});

test("valid promo order message uses validated promo and final payable price", () => {
  const order = telegramOrder(pricing({
    promoCode: "SAVE20",
    promoDiscount: 200,
    finalPrice: 800,
    priceSource: "promo-code",
  }));
  const message = buildNewOrderMessage(order);

  assert.match(message, /Main Price: LKR 1,000/);
  assert.match(message, /🎟️ PROMO CODE APPLIED/);
  assert.match(message, /Promo Code: SAVE20/);
  assert.match(message, /Promo Discount Amount: LKR 200/);
  assert.match(message, /Final Payable Price: LKR 800/);
});

test("order without a promo displays no promo and the server-calculated full price", () => {
  const message = buildNewOrderMessage(telegramOrder(pricing()));

  assert.doesNotMatch(message, /PROMO CODE APPLIED|Promo Code:/);
  assert.match(message, /Discount: LKR 0/);
  assert.match(message, /Final Payable Price: LKR 1,000/);
});

test("invalid promo is not persisted or shown as applied", () => {
  const message = buildNewOrderMessage(telegramOrder(pricing()));

  assert.doesNotMatch(message, /INVALID|PROMO CODE APPLIED|Promo Code:/);
  assert.match(message, /Final Payable Price: LKR 1,000/);
});

test("promotion-only pricing keeps its existing precedence and total", () => {
  const state = pricing({
    promotionPrice: 850,
    promotionDiscount: 150,
    finalPrice: 850,
    hasActivePromotion: true,
    priceSource: "promotion",
  });
  const order = telegramOrder(state, { promotionName: "Seasonal" });
  const message = buildNewOrderMessage(order);

  assert.equal(order.discountType, "PROMOTION");
  assert.equal(order.discountAmount, 150);
  assert.match(message, /🎁 PROMOTION APPLIED/);
  assert.match(message, /Promotion Discount Amount: LKR 150/);
  assert.doesNotMatch(message, /PROMO CODE APPLIED/);
  assert.match(message, /Final Payable Price: LKR 850/);
});

test("promotion precedence omits a valid code when the promotion remains the chosen price", () => {
  const state = pricing({
    promotionPrice: 800,
    promotionDiscount: 200,
    promoCode: "SAVE5",
    promoDiscount: 50,
    finalPrice: 800,
    hasActivePromotion: true,
    priceSource: "promotion",
  });
  const order = telegramOrder(state, { promotionName: "Seasonal" });
  const message = buildNewOrderMessage(order);

  assert.equal(order.promoCode, undefined);
  assert.equal(order.discountType, "PROMOTION");
  assert.match(message, /Final Payable Price: LKR 800/);
  assert.doesNotMatch(message, /Promo Code: SAVE5/);
});

test("stacked promotion reports each validated discount and the final total", () => {
  const state = pricing({
    promotionPrice: 900,
    promotionDiscount: 100,
    promoCode: "SAVE10",
    promoDiscount: 100,
    finalPrice: 800,
    hasActivePromotion: true,
    discountStacking: true,
    priceSource: "stacked",
  });
  const order = telegramOrder(state, { promotionName: "Seasonal" });
  const message = buildNewOrderMessage(order);

  assert.equal(order.discountType, "PROMOTION + PROMO_CODE");
  assert.equal(order.discountAmount, 200);
  assert.match(message, /Promotion Discount Amount: LKR 100/);
  assert.match(message, /Promo Discount Amount: LKR 100/);
  assert.match(message, /Total Discount Amount: LKR 200/);
  assert.match(message, /Final Payable Price: LKR 800/);
});

import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import ts from "typescript";

import { getOrderPricingFields } from "./order-pricing.ts";
import { getOrderPricingLines } from "./order-pricing.ts";
import { calculatePlanPricing } from "./pricing-calculation.ts";
import { validatePromoCodeForPlanInList } from "./promo-code-utils.ts";
import {
  InvalidApplicationSettingError,
  MissingApplicationSettingError,
} from "./application-settings-values.ts";

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
    "@/lib/order-pricing": { getOrderPricingLines },
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

const pricingSource = await readFile(path.join(root, "lib", "pricing.ts"), "utf8");
const promotionDatabaseSource = await readFile(path.join(root, "lib", "promotion-database.ts"), "utf8");
let pricingScenario = {};
let configuredPromotions = [];
const promotionDatabaseCompiled = ts.transpileModule(promotionDatabaseSource, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText;
const promotionDatabaseModule = { exports: {} };
const basePlans = [
  { id: "weekly", price: 200 },
  { id: "monthly", price: 1000 },
  { id: "annually", price: 2000 },
  { id: "lifetime", price: 5000 },
];
new Function("require", "module", "exports", promotionDatabaseCompiled)(
  (name) => {
    if (name === "@/components/site-data") return { plans: basePlans };
    if (name === "@/lib/application-settings-store") {
      return {
        getApplicationSetting: async () => {
          if (configuredPromotions === undefined) throw new MissingApplicationSettingError("promotions");
          return configuredPromotions;
        },
        saveApplicationSetting: async (key, value) => {
          if (key === "promotions") configuredPromotions = value;
        },
      };
    }
    if (name === "@/lib/application-settings-values") return { InvalidApplicationSettingError };
    throw new Error(`Unexpected dependency in promotion database test: ${name}`);
  },
  promotionDatabaseModule,
  promotionDatabaseModule.exports,
);
const {
  createPromotion,
  getActivePromotion,
  getPromotionDiagnostics,
  getPromotionOfferForPlan,
} = promotionDatabaseModule.exports;
const pricingCompiled = ts.transpileModule(pricingSource, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText;
const pricingModule = { exports: {} };
const pricingMocks = {
  "@/components/site-data": { plans: basePlans },
  "@/lib/promotion-database": { getActivePromotion, getPromotionOfferForPlan },
  "@/lib/site-settings": {
    getSiteSettings: async () => ({ discountStacking: Boolean(pricingScenario.discountStacking) }),
    normalizePromoCode: (code) => String(code || "").trim().replace(/\s+/g, "").toUpperCase(),
    validatePromoCodeForPlan: async (code, _planId, originalPrice) => {
      if (code !== pricingScenario.validCode) {
        return { valid: false, discount: 0, finalPrice: originalPrice, message: "Invalid or expired promo code." };
      }
      return {
        valid: true,
        discount: pricingScenario.promoDiscount,
        finalPrice: originalPrice - pricingScenario.promoDiscount,
        message: "Promo code applied.",
      };
    },
  },
  "@/lib/pricing-calculation": { calculatePlanPricing },
};
new Function("require", "module", "exports", pricingCompiled)(
  (name) => {
    if (Object.hasOwn(pricingMocks, name)) return pricingMocks[name];
    throw new Error(`Unexpected dependency in pricing test: ${name}`);
  },
  pricingModule,
  pricingModule.exports,
);
const { resolvePlanPricing } = pricingModule.exports;
const { buildNewOrderMessage } = loadTelegramMessages();

async function resolvePricing(scenario, code) {
  pricingScenario = scenario;
  if (Object.hasOwn(scenario, "promotions")) {
    configuredPromotions = scenario.promotions;
  } else if (scenario.promotion) {
    configuredPromotions = [makePromotion(scenario.promotion)];
  } else {
    configuredPromotions = [];
  }
  return resolvePlanPricing("monthly", code);
}

function makePromotion({ price, applicablePlans = ["monthly"], id = "test-promotion", name = "Test Promotion" }) {
  return {
    id,
    enabled: true,
    name,
    title: name,
    applicablePlans,
    planPrices: {
      weekly: { promotionalPrice: 200, enabled: true },
      monthly: { promotionalPrice: price, enabled: true },
      annually: { promotionalPrice: 2000, enabled: true },
      lifetime: { promotionalPrice: 5000, enabled: true },
    },
  };
}

function telegramOrder(pricingState, overrides = {}) {
  return {
    orderId: "ORDER-TEST",
    selectedPlan: "monthly",
    promotionName: pricingState.promotionName,
    promotionId: pricingState.promotionId,
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

test("valid promo order message uses validated promo and final payable price", async () => {
  const state = await resolvePricing({ validCode: "SAVE20", promoDiscount: 200 }, "SAVE20");
  const order = telegramOrder(state);
  const message = buildNewOrderMessage(order);

  assert.match(message, /Original Price: LKR 1,000/);
  assert.match(message, /Promo Code: SAVE20/);
  assert.match(message, /Promo Code Discount Amount: LKR 200/);
  assert.match(message, /Total Discount Amount: LKR 200/);
  assert.match(message, /Final Payable Price: LKR 800/);
  assert.match(message, /Currency: LKR/);
});

test("order without a promo displays no promo and the server-calculated full price", async () => {
  const state = await resolvePricing({}, undefined);
  const message = buildNewOrderMessage(telegramOrder(state));

  assert.match(message, /Promotion: None/);
  assert.match(message, /Promo Code: None/);
  assert.match(message, /Total Discount Amount: LKR 0/);
  assert.match(message, /Final Payable Price: LKR 1,000/);
});

test("invalid promo is not persisted or shown as applied", async () => {
  const state = await resolvePricing({ validCode: "SAVE20", promoDiscount: 200 }, "INVALID");
  const message = buildNewOrderMessage(telegramOrder(state));

  assert.match(message, /Promo Code: None/);
  assert.match(message, /Final Payable Price: LKR 1,000/);
});

test("promotion-only pricing keeps its existing precedence and total", async () => {
  const state = await resolvePricing({ promotion: { price: 850 } }, undefined);
  const order = telegramOrder(state, { promotionName: "Seasonal" });
  const message = buildNewOrderMessage(order);

  assert.equal(order.discountType, "PROMOTION");
  assert.equal(order.discountAmount, 150);
  assert.match(message, /Promotion: Seasonal/);
  assert.match(message, /Promotion Discount Amount: LKR 150/);
  assert.match(message, /Promo Code: None/);
  assert.match(message, /Final Payable Price: LKR 850/);
});

test("active zero-price promotion is not mistaken for a missing promotion", async () => {
  const state = await resolvePricing({
    promotions: [makePromotion({ price: 0, name: "Full Discount" })],
  }, undefined);
  const order = telegramOrder(state, { promotionName: "Full Discount" });
  const message = buildNewOrderMessage(order);

  assert.equal(order.discountType, "PROMOTION");
  assert.equal(order.promotionPrice, 0);
  assert.equal(order.promotionDiscountAmount, 1000);
  assert.equal(order.finalPrice, 0);
  assert.match(message, /Promotion: Full Discount/);
  assert.match(message, /Promotion Discount Amount: LKR 1,000/);
  assert.match(message, /Final Payable Price: LKR 0/);
});

test("promotion precedence omits a valid code when the promotion remains the chosen price", async () => {
  const state = await resolvePricing({
    promotion: { price: 800 },
    validCode: "SAVE5",
    promoDiscount: 50,
  }, "SAVE5");
  const order = telegramOrder(state, { promotionName: "Seasonal" });
  const message = buildNewOrderMessage(order);

  assert.equal(order.promoCode, "SAVE5");
  assert.equal(order.promoCodeApplied, false);
  assert.equal(order.discountType, "PROMOTION");
  assert.match(message, /Promotion: Seasonal/);
  assert.match(message, /Promo Code: SAVE5 \(not applied; promotion price selected\)/);
  assert.match(message, /Final Payable Price: LKR 800/);
});

test("valid promo entry does not hide an active promotion when the promo code wins precedence", async () => {
  const activeOffer = { price: 900, name: "Seasonal" };
  const withoutCode = await resolvePricing({ promotion: activeOffer }, undefined);
  const withValidCode = await resolvePricing({
    promotion: activeOffer,
    validCode: "SAVE30",
    promoDiscount: 150,
  }, "SAVE30");

  assert.equal(withoutCode.promotionId, withValidCode.promotionId);
  assert.equal(withoutCode.promotionPrice, 900);
  assert.equal(withValidCode.promotionPrice, 900);
  assert.equal(withValidCode.priceSource, "promo-code");

  const order = telegramOrder(withValidCode);
  const message = buildNewOrderMessage(order);
  assert.equal(order.promotionApplied, false);
  assert.equal(order.promoCodeApplied, true);
  assert.equal(order.promotionDiscountAmount, 100);
  assert.equal(order.promoDiscountAmount, 150);
  assert.equal(order.discountAmount, 150);
  assert.equal(order.finalPrice, 850);
  assert.match(message, /Promotion: Seasonal \(not applied; promo code price selected\)/);
  assert.match(message, /Promotion Discount Amount: LKR 100 \(not applied\)/);
  assert.match(message, /Promo Code: SAVE30/);
  assert.match(message, /Promo Code Discount Amount: LKR 150/);
  assert.match(message, /Total Discount Amount: LKR 150/);
  assert.match(message, /Final Payable Price: LKR 850/);
});

test("invalid promo entry leaves the same active promotion applied", async () => {
  const activeOffer = { price: 900, name: "Seasonal" };
  const withoutCode = await resolvePricing({ promotion: activeOffer }, undefined);
  const withInvalidCode = await resolvePricing({ promotion: activeOffer }, "EXPIRED");

  assert.equal(withInvalidCode.promotionId, withoutCode.promotionId);
  assert.equal(withInvalidCode.priceSource, "promotion");
  assert.equal(withInvalidCode.promoCode, null);
  const order = telegramOrder(withInvalidCode);
  const message = buildNewOrderMessage(order);
  assert.equal(order.finalPrice, 900);
  assert.equal(order.discountAmount, 100);
  assert.match(message, /Promotion: Seasonal/);
  assert.match(message, /Promotion Discount Amount: LKR 100/);
  assert.match(message, /Promo Code: None/);
  assert.match(message, /Final Payable Price: LKR 900/);
});

test("stacked promotion reports each validated discount and the final total", async () => {
  const state = await resolvePricing({
    promotion: { price: 900 },
    validCode: "SAVE10",
    promoDiscount: 100,
    discountStacking: true,
  }, "SAVE10");
  const order = telegramOrder(state, { promotionName: "Seasonal" });
  const message = buildNewOrderMessage(order);

  assert.equal(order.discountType, "PROMOTION + PROMO_CODE");
  assert.equal(order.promotionApplied, true);
  assert.equal(order.promoCodeApplied, true);
  assert.equal(order.discountAmount, 200);
  assert.match(message, /Promotion Discount Amount: LKR 100/);
  assert.match(message, /Promo Code Discount Amount: LKR 100/);
  assert.match(message, /Total Discount Amount: LKR 200/);
  assert.match(message, /Final Payable Price: LKR 800/);
});

test("a better promo code wins when stacking is prohibited", async () => {
  const state = await resolvePricing({
    promotion: { price: 900 },
    validCode: "SAVE20",
    promoDiscount: 200,
  }, "SAVE20");
  const order = telegramOrder(state, { promotionName: "Seasonal" });
  const message = buildNewOrderMessage(order);

  assert.equal(order.discountType, "PROMO_CODE");
  assert.equal(order.finalPrice, 800);
  assert.match(message, /Promotion: Seasonal \(not applied; promo code price selected\)/);
  assert.match(message, /Promo Code: SAVE20/);
  assert.match(message, /Total Discount Amount: LKR 200/);
});

test("expired and usage-limited promo codes cannot apply a discount", () => {
  const basePromo = {
    code: "SAVE20",
    name: "Save 20",
    enabled: true,
    applicablePlans: ["monthly"],
    discountPercentage: 20,
    usedCount: 0,
  };
  const now = new Date("2026-10-27T00:00:00Z");
  const expired = validatePromoCodeForPlanInList("SAVE20", "monthly", 1000, [{
    ...basePromo,
    expiryDate: "2026-10-26",
    expiryTime: "23:59",
  }], now);
  const exhausted = validatePromoCodeForPlanInList("SAVE20", "monthly", 1000, [{
    ...basePromo,
    usageLimit: 1,
    usedCount: 1,
  }], now);

  assert.equal(expired.valid, false);
  assert.equal(expired.discount, 0);
  assert.equal(exhausted.valid, false);
});

test("missing and invalid promotion settings fail order pricing instead of being treated as absent", async () => {
  await assert.rejects(
    () => resolvePricing({ promotions: undefined }, undefined),
    MissingApplicationSettingError,
  );
  await assert.rejects(
    () => resolvePricing({ promotions: [{ invalid: true }] }, undefined),
    InvalidApplicationSettingError,
  );
});

test("the selected plan's promotion is found even when an earlier active promotion excludes it", async () => {
  const weeklyPromotion = makePromotion({
    id: "weekly-offer",
    name: "Weekly Offer",
    price: 150,
    applicablePlans: ["weekly"],
  });
  const monthlyPromotion = makePromotion({
    id: "monthly-offer",
    name: "Monthly Offer",
    price: 800,
    applicablePlans: ["monthly"],
  });
  const state = await resolvePricing({ promotions: [weeklyPromotion, monthlyPromotion] }, undefined);
  const order = telegramOrder(state);
  const message = buildNewOrderMessage(order);

  assert.equal(state.promotionId, "monthly-offer");
  assert.equal(order.finalPrice, 800);
  assert.match(message, /Promotion: Monthly Offer/);
  assert.match(message, /Final Payable Price: LKR 800/);
});

test("admin-save payload is persisted and resolved from the promotions setting in the order path", async () => {
  configuredPromotions = [];
  const monthlyPlan = basePlans.find((plan) => plan.id === "monthly");
  assert.ok(monthlyPlan);
  const originalPrice = monthlyPlan.price;
  monthlyPlan.price = 500;
  try {
    const saved = await createPromotion({
      name: "Admin Fixture",
      enabled: true,
      startDate: "",
      startTime: "",
      endDate: "",
      endTime: "",
      applicablePlans: ["monthly"],
      planPrices: {
        weekly: { promotionalPrice: 200, enabled: true },
        monthly: { promotionalPrice: 400, enabled: true },
        annually: { promotionalPrice: 2000, enabled: true },
        lifetime: { promotionalPrice: 5000, enabled: true },
      },
    });

    assert.equal(configuredPromotions.length, 1);
    assert.equal(configuredPromotions[0].name, "Admin Fixture");
    assert.deepEqual(configuredPromotions[0].applicablePlans, ["monthly"]);
    assert.equal(configuredPromotions[0].planPrices.monthly.promotionalPrice, 400);
    assert.equal((await getActivePromotion("monthly"))?.id, saved.id);

    const diagnostics = await getPromotionDiagnostics("monthly");
    assert.equal(diagnostics.promotionCount, 1);
    assert.equal(diagnostics.activePromotionCount, 1);
    assert.deepEqual(diagnostics.eligiblePlanIds, ["monthly"]);
    assert.deepEqual(diagnostics.rejectedPromotions, []);

    pricingScenario = {};
    const pricing = await resolvePlanPricing("monthly");
    const order = telegramOrder(pricing);
    const message = buildNewOrderMessage(order);
    assert.equal(order.mainPrice, 500);
    assert.equal(order.finalPrice, 400);
    assert.match(message, /Promotion: Admin Fixture/);
    assert.match(message, /Promotion Discount Amount: LKR 100/);
    assert.match(message, /Final Payable Price: LKR 400/);
  } finally {
    monthlyPlan.price = originalPrice;
  }
});

test("local promotion diagnostics identify a saved campaign that excludes the selected plan", async () => {
  configuredPromotions = [makePromotion({ price: 400, applicablePlans: ["weekly"] })];
  const diagnostics = await getPromotionDiagnostics("monthly");

  assert.equal(diagnostics.promotionCount, 1);
  assert.equal(diagnostics.activePromotionCount, 1);
  assert.deepEqual(diagnostics.eligiblePlanIds, []);
  assert.deepEqual(diagnostics.rejectedPromotions, [{ index: 0, reason: "plan_not_applicable" }]);
});

test("notification pricing details match persisted server-computed order fields", async () => {
  const state = await resolvePricing({
    promotion: { price: 900 },
    validCode: "SAVE10",
    promoDiscount: 100,
    discountStacking: true,
  }, "SAVE10");
  const order = telegramOrder(state, { promotionName: "Seasonal" });
  const message = buildNewOrderMessage(order);

  assert.equal(order.mainPrice - order.finalPrice, order.discountAmount);
  assert.equal(order.finalPrice, Number(order.planPrice));
  assert.match(message, /Original Price: LKR 1,000/);
  assert.match(message, /Total Discount Amount: LKR 200/);
  assert.match(message, /Final Payable Price: LKR 800/);
  assert.match(message, /Currency: LKR/);
});

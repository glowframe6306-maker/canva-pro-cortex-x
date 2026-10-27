import assert from "node:assert/strict";
import test from "node:test";

import { isPromoValidationRequest } from "./promo-validation-request.ts";

test("promo validation accepts a well-formed request", () => {
  assert.equal(
    isPromoValidationRequest({ code: "SAVE", planId: "monthly", originalPrice: 500 }),
    true,
  );
});

test("promo validation rejects missing and incorrectly typed fields", () => {
  for (const request of [
    null,
    [],
    {},
    { code: "SAVE", planId: "monthly" },
    { code: 1, planId: "monthly", originalPrice: 500 },
    { code: "SAVE", planId: false, originalPrice: 500 },
    { code: "SAVE", planId: "monthly", originalPrice: "500" },
    { code: "SAVE", planId: "monthly", originalPrice: Number.NaN },
    { code: "SAVE", planId: "monthly", originalPrice: Number.POSITIVE_INFINITY },
    { code: "SAVE", planId: "monthly", originalPrice: -1 },
  ]) {
    assert.equal(isPromoValidationRequest(request), false);
  }
});

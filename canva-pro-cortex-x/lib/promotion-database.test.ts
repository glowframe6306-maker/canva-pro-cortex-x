import test from "node:test";
import assert from "node:assert/strict";

import { createPromotion, updatePromotion } from "./promotion-database";

const makeValidPromotion = () => ({
  enabled: true,
  name: "Launch Offer",
  title: "Launch Offer",
  description: "Limited-time promotional pricing for selected plans.",
  offerText: "LIMITED-TIME OFFER",
  buttonText: "GET STARTED",
  buttonAction: "scroll-to-plans",
  applicablePlans: ["weekly", "monthly"],
  startDate: "2030-01-01",
  startTime: "09:00",
  endDate: "2030-01-05",
  endTime: "23:59",
  planPrices: {
    weekly: { normalPrice: 200, promotionalPrice: 150, discountAmount: 50, discountPercent: 25, enabled: true },
    monthly: { normalPrice: 500, promotionalPrice: 400, discountAmount: 100, discountPercent: 20, enabled: true },
    annually: { normalPrice: 2000, promotionalPrice: 1800, discountAmount: 200, discountPercent: 10, enabled: true },
    lifetime: { normalPrice: 5000, promotionalPrice: 4500, discountAmount: 500, discountPercent: 10, enabled: true },
  },
});

test("updatePromotion rejects invalid end times and price values", async () => {
  const created = await createPromotion(makeValidPromotion());

  await assert.rejects(
    () => updatePromotion(created.id, {
      ...created,
      name: "   ",
      startDate: "2030-01-10",
      startTime: "10:00",
      endDate: "2030-01-05",
      endTime: "09:00",
      planPrices: {
        weekly: { normalPrice: 200, promotionalPrice: 250, discountAmount: 0, discountPercent: 0, enabled: true },
        monthly: { normalPrice: 500, promotionalPrice: 600, discountAmount: 0, discountPercent: 0, enabled: true },
        annually: { normalPrice: 2000, promotionalPrice: 2500, discountAmount: 0, discountPercent: 0, enabled: true },
        lifetime: { normalPrice: 5000, promotionalPrice: 5500, discountAmount: 0, discountPercent: 0, enabled: true },
      },
    }),
    /Promotion name|End date and time|Promotional price/i,
  );
});
